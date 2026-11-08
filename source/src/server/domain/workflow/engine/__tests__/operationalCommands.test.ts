import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { suspendInstance, resumeInstance, cancelInstance, retryEligibleNodeNow, forceNewInvocationForNode, inspectInstance } from '../operationalCommands';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence, claimReadyOrRetryingNode } from '../../workflowNodeInstanceRepository';
import { createStartedAttempt, listAttemptsForNode } from '../../workflowExecutionAttemptRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { computeLogicalInvocationKey } from '../../actions/logicalInvocationKey';
import { baseModel, decisionNode, decisionEdge, decisionDefaultEdge, endNode, actionNode, unconditionalEdge, workflowInputPath, mappingOf, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'test-worker';

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('opcmd'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('operationalCommands (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('Suspend/Resume: dispatch is ineligible while SUSPENDED and resumes normal eligibility after Resume', async () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const { instance } = await publishAndStart(model);
    const suspended = await suspendInstance(instance.id, instance.stateVersion);
    expect(suspended.status).toBe('SUSPENDED');

    const end1 = await getNodeInstanceByOccurrence(instance.id, 'end-1');
    const outcome = await dispatchNode({ nodeInstanceId: end1!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toEqual({ status: 'NOT_ELIGIBLE', reason: 'INSTANCE_NOT_EXECUTABLE' });

    const resumed = await resumeInstance(instance.id, suspended.stateVersion);
    expect(resumed.status).toBe('RUNNING');
    const afterResume = await dispatchNode({ nodeInstanceId: end1!.id, leaseOwnerId: leaseOwner });
    expect(afterResume).toMatchObject({ status: 'DISPATCHED' });
  });

  it('Cancel: cancels the instance, sibling PENDING nodes and any in-flight STARTED attempt', async () => {
    const model = baseModel({
      nodes: [decisionNode('d1'), actionNode('render', { retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }), endNode('end-other'), endNode('end-after-render')],
      edges: [
        decisionEdge('e-other', 'd1', 'end-other', lit(false)),
        decisionDefaultEdge('e-def', 'd1', 'render'),
        unconditionalEdge('e-render-end', 'render', 'end-after-render'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model);
    const d1 = await getNodeInstanceByOccurrence(instance.id, 'd1');
    await dispatchNode({ nodeInstanceId: d1!.id, leaseOwnerId: leaseOwner }); // readies render

    const render = await getNodeInstanceByOccurrence(instance.id, 'render');
    const claimed = await claimReadyOrRetryingNode(render!.id, render!.stateVersion, leaseOwner, 30_000);
    const logicalInvocationId = 'cancel-test-invocation';
    await createStartedAttempt({
      workflowInstanceId: instance.id,
      nodeInstanceId: render!.id,
      actionKey: 'text.template',
      actionVersion: '1',
      logicalInvocationId,
      idempotencyKey: computeLogicalInvocationKey({ workflowInstanceId: String(instance.id), nodeInstanceId: String(render!.id), logicalInvocationId }),
    });

    await cancelInstance(instance.id, instance.stateVersion);

    const reloadedInstance = await getWorkflowInstanceById(instance.id);
    expect(reloadedInstance!.status).toBe('CANCELLED');

    const endOther = await getNodeInstanceByOccurrence(instance.id, 'end-other');
    expect(endOther!.status).toBe('CANCELLED');
    const reloadedRender = await getNodeInstanceByOccurrence(instance.id, 'render');
    expect(reloadedRender!.status).toBe('CANCELLED');

    const attempts = await listAttemptsForNode(render!.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('CANCELLED');

    void claimed;
  });

  it('retryEligibleNodeNow: accelerates a RETRYING node so it is immediately claimable', async () => {
    const model = baseModel({
      nodes: [
        actionNode('bad', { input: mappingOf({ template: lit(123) as never }), retryPolicy: { maxAttempts: 2, strategy: 'FIXED', initialDelayMs: 3_600_000, retryOn: [{ type: 'ERROR_CODE', codes: ['WF_EXEC_ACTION_OUTPUT_INVALID'] }] } }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'bad', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'bad' },
    });
    const { instance } = await publishAndStart(model);
    const bad = await getNodeInstanceByOccurrence(instance.id, 'bad');
    await dispatchNode({ nodeInstanceId: bad!.id, leaseOwnerId: leaseOwner });

    const afterFirst = await getNodeInstanceByOccurrence(instance.id, 'bad');
    expect(afterFirst!.status).toBe('RETRYING');
    // The 1-hour delay would make it not-yet-due; a normal dispatch attempt must not claim it.
    const notYetDue = await dispatchNode({ nodeInstanceId: afterFirst!.id, leaseOwnerId: leaseOwner });
    expect(notYetDue).toEqual({ status: 'NOT_ELIGIBLE', reason: 'ALREADY_WON_OR_INELIGIBLE' });

    const accelerated = await retryEligibleNodeNow(afterFirst!.id, afterFirst!.stateVersion);
    expect(accelerated.status).toBe('RETRYING');

    const nowEligible = await dispatchNode({ nodeInstanceId: accelerated.id, leaseOwnerId: leaseOwner });
    expect(nowEligible).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'FAIL_INSTANCE' } });
  });

  it('forceNewInvocationForNode: requires acknowledgement, discards the stale attempt and starts a fresh logical invocation', async () => {
    const model = baseModel({
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('Hello {{name}}!'), variables: lit({ name: 'World' }) as never }),
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
        }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'render', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
    const { instance } = await publishAndStart(model);
    const render = await getNodeInstanceByOccurrence(instance.id, 'render');
    await claimReadyOrRetryingNode(render!.id, render!.stateVersion, 'crashed-worker', -1000);
    const staleLogicalInvocationId = 'stale-invocation';
    const staleAttempt = await createStartedAttempt({
      workflowInstanceId: instance.id,
      nodeInstanceId: render!.id,
      actionKey: 'text.template',
      actionVersion: '1',
      logicalInvocationId: staleLogicalInvocationId,
      idempotencyKey: computeLogicalInvocationKey({ workflowInstanceId: String(instance.id), nodeInstanceId: String(render!.id), logicalInvocationId: staleLogicalInvocationId }),
    });

    await expect(forceNewInvocationForNode({ nodeInstanceId: render!.id, leaseOwnerId: leaseOwner, acknowledgeDuplicateEffectRisk: false })).rejects.toMatchObject({ code: 'WF_AUTH_FORBIDDEN' });

    const outcome = await forceNewInvocationForNode({ nodeInstanceId: render!.id, leaseOwnerId: leaseOwner, acknowledgeDuplicateEffectRisk: true });
    expect(outcome).toMatchObject({ kind: 'SELECT_EDGE', edgeKey: 'e1' });

    const attempts = await listAttemptsForNode(render!.id);
    expect(attempts).toHaveLength(2);
    const [old, fresh] = attempts;
    expect(old.id).toBe(staleAttempt.id);
    expect(old.status).toBe('CANCELLED');
    expect(fresh.status).toBe('SUCCEEDED');
    expect(fresh.logicalInvocationId).not.toBe(staleLogicalInvocationId);
  });

  it('inspectInstance: returns a read-only projection of instance/node/attempt state', async () => {
    const model = baseModel({
      nodes: [decisionNode('d1'), endNode('end-high'), endNode('end-low')],
      edges: [
        decisionEdge('e-high', 'd1', 'end-high', { op: 'GTE', left: workflowInputPath(['total']), right: lit(100) }),
        decisionDefaultEdge('e-low', 'd1', 'end-low'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model, { total: 1 });
    const inspection = await inspectInstance(instance.id);
    expect(inspection.instance.id).toBe(instance.id);
    expect(inspection.nodeInstances).toHaveLength(3);
    expect(inspection.attemptsByNodeInstanceId).toEqual({});
  });
});
