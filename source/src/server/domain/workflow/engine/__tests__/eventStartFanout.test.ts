import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { disableWorkflowDefinition } from '../../publication/workflowPublicationService';
import { ingestWorkflowEvent } from '../eventIngressService';
import { startWorkflowsForEvent } from '../eventStartFanout';
import { emitWorkflowInstanceFailedEvent, WORKFLOW_INSTANCE_FAILED_EVENT } from '../eventFailureNotify';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { registerCoreActionPack } from '../../actions/corePack';
import { listWorkflowInstances } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { integrationEventPublishExecutor } from '../../actions/corePack/eventActions';
import { baseModel, endNode, failNode, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'event-start-worker';

registerCoreActionPack();

const fakeActionContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

function eventStartModel(eventName: string) {
  return baseModel({
    nodes: [endNode('end-1')],
    edges: [],
    start: { type: 'EVENT', targetNodeKey: 'end-1', eventName },
  });
}

async function publishEventWorkflow(eventName: string) {
  const definition = await createTestWorkflowDefinition({
    key: uniqueKey('event-start'),
    draftDefinitionJson: JSON.stringify(eventStartModel(eventName)),
  });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return { definition, revision };
}

describe.skipIf(!dbReady)('EVENT start fan-out (ingestWorkflowEvent, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('ingest starts every ACTIVE EVENT-bound published definition whose eventName matches, with the payload as workflow input', async () => {
    const eventName = `catalog.item.created.${uniqueKey('evt')}`;
    const { definition } = await publishEventWorkflow(eventName);
    const payload = { sku: 'A-1', qty: 2 };

    const outcome = await ingestWorkflowEvent({
      eventName,
      eventSourceIdentity: 'test-source',
      payload,
      leaseOwnerId: leaseOwner,
    });

    expect(outcome.wasCreated).toBe(true);
    expect(outcome.startFanout?.started).toBeGreaterThanOrEqual(1);

    const instances = await listWorkflowInstances({ workflowDefinitionId: definition.id });
    expect(instances).toHaveLength(1);
    expect(instances[0]!.startType).toBe('EVENT');
    expect(JSON.parse(instances[0]!.inputJson!)).toEqual(payload);

    const endNodeInstance = await getNodeInstanceByOccurrence(instances[0]!.id, 'end-1');
    expect(endNodeInstance!.status).toBe('READY');
  });

  it('skips published MANUAL_API definitions and EVENT definitions bound to a different name', async () => {
    const matching = `order.paid.${uniqueKey('evt')}`;
    const other = `order.shipped.${uniqueKey('evt')}`;
    const { definition: matchingDef } = await publishEventWorkflow(matching);
    const { definition: otherDef } = await publishEventWorkflow(other);

    const manual = await createTestWorkflowDefinition({
      key: uniqueKey('manual'),
      draftDefinitionJson: JSON.stringify(baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } })),
    });
    await publishWorkflowDefinition(manual.id, manual.draftVersion);

    await ingestWorkflowEvent({
      eventName: matching,
      eventSourceIdentity: 'test-source',
      payload: { ok: true },
      leaseOwnerId: leaseOwner,
    });

    expect(await listWorkflowInstances({ workflowDefinitionId: matchingDef.id })).toHaveLength(1);
    expect(await listWorkflowInstances({ workflowDefinitionId: otherDef.id })).toHaveLength(0);
    expect(await listWorkflowInstances({ workflowDefinitionId: manual.id })).toHaveLength(0);
  });

  it('excludeWorkflowDefinitionId skips that subscriber so an event publisher does not restart itself', async () => {
    const eventName = `self.echo.${uniqueKey('evt')}`;
    const { definition } = await publishEventWorkflow(eventName);

    const skipped = await startWorkflowsForEvent({
      eventName,
      payload: { n: 1 },
      excludeWorkflowDefinitionId: definition.id,
    });
    expect(skipped.started).toBe(0);
    expect(await listWorkflowInstances({ workflowDefinitionId: definition.id })).toHaveLength(0);

    const started = await startWorkflowsForEvent({ eventName, payload: { n: 1 } });
    expect(started.started).toBeGreaterThanOrEqual(1);
    expect(await listWorkflowInstances({ workflowDefinitionId: definition.id })).toHaveLength(1);
  });

  it('a failing subscriber does not block other matching EVENT-start workflows', async () => {
    const eventName = `fanout.isolate.${uniqueKey('evt')}`;
    const { definition: good } = await publishEventWorkflow(eventName);

    const badModel = baseModel({
      nodes: [endNode('end-1')],
      start: { type: 'EVENT', targetNodeKey: 'end-1', eventName },
      inputSchema: { type: 'INLINE', schema: { type: 'object', required: ['mustHave'], properties: { mustHave: { type: 'string' } } } },
    });
    const badDef = await createTestWorkflowDefinition({ key: uniqueKey('event-bad'), draftDefinitionJson: JSON.stringify(badModel) });
    const published = await publishWorkflowDefinition(badDef.id, badDef.draftVersion);
    expect(published.revision.publicationStatus).toBe('PUBLISHED');

    const summary = await startWorkflowsForEvent({ eventName, payload: { other: true } });
    expect(summary.failed).toBeGreaterThanOrEqual(1);
    expect(summary.started).toBeGreaterThanOrEqual(1);
    expect(await listWorkflowInstances({ workflowDefinitionId: good.id })).toHaveLength(1);
    expect(await listWorkflowInstances({ workflowDefinitionId: badDef.id })).toHaveLength(0);
  });

  it('does not start a DISABLED EVENT-bound definition', async () => {
    const eventName = `disabled.${uniqueKey('evt')}`;
    const { definition } = await publishEventWorkflow(eventName);
    const reloaded = await (await import('../../workflowDefinitionRepository')).getWorkflowDefinitionById(definition.id);
    await disableWorkflowDefinition(definition.id, reloaded!.stateVersion);

    await startWorkflowsForEvent({ eventName, payload: { x: 1 } });
    expect(await listWorkflowInstances({ workflowDefinitionId: definition.id })).toHaveLength(0);
  });

  it('integration.event-publish ingest starts a matching EVENT workflow and reports startedWorkflows', async () => {
    const eventName = `action.publish.${uniqueKey('evt')}`;
    const { definition } = await publishEventWorkflow(eventName);

    const result = await integrationEventPublishExecutor.execute(fakeActionContext, {}, {
      eventName,
      payload: { from: 'action' },
    });
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toMatchObject({ wasCreated: true, startedWorkflows: expect.any(Number) });
    expect((result.output as { startedWorkflows: number }).startedWorkflows).toBeGreaterThanOrEqual(1);

    const instances = await listWorkflowInstances({ workflowDefinitionId: definition.id });
    expect(instances).toHaveLength(1);
    expect(JSON.parse(instances[0]!.inputJson!)).toEqual({ from: 'action' });
  });

  it('emitWorkflowInstanceFailedEvent starts an EVENT workflow bound to workflow.instance.failed', async () => {
    const recovery = await createTestWorkflowDefinition({
      key: uniqueKey('on-fail'),
      draftDefinitionJson: JSON.stringify(eventStartModel(WORKFLOW_INSTANCE_FAILED_EVENT)),
    });
    const published = await publishWorkflowDefinition(recovery.id, recovery.draftVersion);
    expect(published.revision.publicationStatus).toBe('PUBLISHED');

    const failing = await createTestWorkflowDefinition({
      key: uniqueKey('will-fail'),
      draftDefinitionJson: JSON.stringify(baseModel({
        nodes: [failNode('fail-1', lit('WF_TEST_FAILURE'), lit('boom'))],
        edges: [],
        start: { type: 'MANUAL_API', targetNodeKey: 'fail-1' },
      })),
    });
    const failingPublished = await publishWorkflowDefinition(failing.id, failing.draftVersion);
    const { instance } = await startWorkflowInstance({
      workflowRevisionId: failingPublished.revision.id,
      input: {},
      startedByType: 'USER',
      startedById: 1,
    });
    const failNodeInstance = await getNodeInstanceByOccurrence(instance.id, 'fail-1');
    await dispatchNode({ nodeInstanceId: failNodeInstance!.id, leaseOwnerId: leaseOwner });
    expect((await getWorkflowInstanceById(instance.id))!.status).toBe('FAILED');

    // emit is fire-and-forget from the fail path — call it directly so this test is not racy.
    await emitWorkflowInstanceFailedEvent({ workflowInstanceId: instance.id, errorCode: 'WF_TEST_FAILURE' });

    const recoveryInstances = await listWorkflowInstances({ workflowDefinitionId: recovery.id });
    expect(recoveryInstances.length).toBeGreaterThanOrEqual(1);
    const payload = JSON.parse(recoveryInstances[0]!.inputJson!) as { definitionKey: string; errorCode: string; instanceId: number };
    expect(payload.errorCode).toBe('WF_TEST_FAILURE');
    expect(payload.instanceId).toBe(instance.id);
    expect(typeof payload.definitionKey).toBe('string');
  });
});
