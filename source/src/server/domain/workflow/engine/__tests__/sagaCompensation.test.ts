import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { validateWorkflowDraftForPublication } from '../../publication/publicationValidator';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { runSagaCompensationForFailedInstance } from '../sagaCompensationService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { listTraceByInstance } from '../../workflowTraceRepository';
import {
  baseModel, endNode, actionNode, unconditionalEdge, mappingOf,
} from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'saga-worker';

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('saga'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('WFV2-14 Saga/compensation (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('publication resolves a declared compensation action, rejecting an unresolvable one', async () => {
    const model = baseModel({
      nodes: [
        actionNode('a1', {
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
          compensation: {
            actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'ghost.action', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
            config: mappingOf({}),
            input: mappingOf({}),
          },
        }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'a1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });
    const result = await validateWorkflowDraftForPublication(model, 'default');
    expect(result.status).toBe('FAILED');
  });

  it('LIFO compensation: two succeeded compensable ACTIONs, then a real failure, compensates the most-recent one first', async () => {
    const model = baseModel({
      nodes: [
        actionNode('a1', {
          input: mappingOf({ template: { op: 'LITERAL', value: 'first' }, variables: { op: 'LITERAL', value: {} } }),
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
          compensation: {
            actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
            config: mappingOf({}),
            input: mappingOf({ template: { op: 'LITERAL', value: 'undo-first' }, variables: { op: 'LITERAL', value: {} } }),
          },
        }),
        actionNode('a2', {
          input: mappingOf({ template: { op: 'LITERAL', value: 'second' }, variables: { op: 'LITERAL', value: {} } }),
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] },
          compensation: {
            actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'text.template', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
            config: mappingOf({}),
            input: mappingOf({ template: { op: 'LITERAL', value: 'undo-second' }, variables: { op: 'LITERAL', value: {} } }),
          },
        }),
        // a3 fails deterministically (missing required input fields), triggering instance failure.
        actionNode('a3', { retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'a1', 'a2'), unconditionalEdge('e2', 'a2', 'a3'), unconditionalEdge('e3', 'a3', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });
    const { instance } = await publishAndStart(model);

    await dispatchNode({ nodeInstanceId: (await getNodeInstanceByOccurrence(instance.id, 'a1'))!.id, leaseOwnerId: leaseOwner });
    await dispatchNode({ nodeInstanceId: (await getNodeInstanceByOccurrence(instance.id, 'a2'))!.id, leaseOwnerId: leaseOwner });
    const failOutcome = await dispatchNode({ nodeInstanceId: (await getNodeInstanceByOccurrence(instance.id, 'a3'))!.id, leaseOwnerId: leaseOwner });
    expect(failOutcome.status).toBe('DISPATCHED');
    if (failOutcome.status !== 'DISPATCHED') throw new Error('unreachable');
    expect(failOutcome.decision.kind).toBe('FAIL_INSTANCE');

    const failedInstance = await getWorkflowInstanceById(instance.id);
    expect(failedInstance!.status).toBe('FAILED');

    // dispatchNode's own trigger already ran compensation; call again to prove idempotent re-run is a safe no-op too.
    const rerun = await runSagaCompensationForFailedInstance(instance.id);
    expect(rerun.compensated + rerun.failed).toBe(0);

    const traces = await listTraceByInstance(instance.id);
    const compensationTraces = traces.filter((t) => t.traceType === 'COMPENSATION_STARTED');
    const compensatedKeysInOrder = compensationTraces.map((t) => (JSON.parse(t.coreEvidenceJson) as { compensatedNodeKey: string }).compensatedNodeKey);
    expect(compensatedKeysInOrder).toEqual(['a2', 'a1']); // LIFO: a2 completed after a1, so a2 compensates first.

    const succeededTraces = traces.filter((t) => t.traceType === 'COMPENSATION_SUCCEEDED');
    expect(succeededTraces).toHaveLength(2);
    const summary = traces.find((t) => t.traceType === 'SAGA_COMPENSATION_COMPLETED');
    expect(summary).toBeDefined();
    expect(JSON.parse(summary!.coreEvidenceJson)).toMatchObject({ compensatedCount: 2, failedCount: 0 });
  });

  it('an ACTION with no declared compensation is skipped by the saga pass', async () => {
    const model = baseModel({
      nodes: [
        actionNode('a1', { retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }), // no compensation declared
        actionNode('a2', { retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'a1', 'a2'), unconditionalEdge('e2', 'a2', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });
    const { instance } = await publishAndStart(model);
    await dispatchNode({ nodeInstanceId: (await getNodeInstanceByOccurrence(instance.id, 'a1'))!.id, leaseOwnerId: leaseOwner });
    await dispatchNode({ nodeInstanceId: (await getNodeInstanceByOccurrence(instance.id, 'a2'))!.id, leaseOwnerId: leaseOwner });

    const traces = await listTraceByInstance(instance.id);
    expect(traces.some((t) => t.traceType === 'COMPENSATION_STARTED')).toBe(false);
  });
});
