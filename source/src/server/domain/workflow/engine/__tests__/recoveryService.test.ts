import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { scanAndRecoverExpiredLeases } from '../recoveryService';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { getNodeInstanceByOccurrence, claimReadyOrRetryingNode } from '../../workflowNodeInstanceRepository';
import { createStartedAttempt, listAttemptsForNode } from '../../workflowExecutionAttemptRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { computeLogicalInvocationKey } from '../../actions/logicalInvocationKey';
import { baseModel, decisionNode, decisionEdge, decisionDefaultEdge, endNode, actionNode, unconditionalEdge, workflowInputPath, mappingOf, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>, input: unknown = {}) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('recovery'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: input as never, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('recoveryService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('safe replay: a DEDUPLICATED Action with an expired lease + STARTED attempt and retries remaining is marked UNKNOWN and the node returns to RETRYING', async () => {
    const model = baseModel({
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('hi'), variables: lit({}) as never }),
          retryPolicy: { maxAttempts: 2, strategy: 'FIXED', initialDelayMs: 0, retryOn: [{ type: 'TIMEOUT' }] },
        }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'render', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
    const { instance } = await publishAndStart(model);
    const render = await getNodeInstanceByOccurrence(instance.id, 'render');

    // Simulate a crash mid-ACTION: claim with an already-expired lease, then persist a STARTED attempt exactly as beginActionAttempt would.
    const claimed = await claimReadyOrRetryingNode(render!.id, render!.stateVersion, 'crashed-worker', -1000);
    const logicalInvocationId = 'test-logical-invocation-1';
    const idempotencyKey = computeLogicalInvocationKey({ workflowInstanceId: String(instance.id), nodeInstanceId: String(render!.id), logicalInvocationId });
    const startedAttempt = await createStartedAttempt({
      workflowInstanceId: instance.id,
      nodeInstanceId: render!.id,
      actionKey: 'text.template',
      actionVersion: '1',
      logicalInvocationId,
      idempotencyKey,
      selectedProviderId: 'core',
      selectedProviderVersion: '1',
      deadlineAt: new Date(Date.now() - 1),
    });

    // Assertions below use >=1 / per-node checks rather than exact summary counts: the Recovery Scanner
    // scans globally (doc 06 section 2), and this real-DB suite runs test files concurrently, so an
    // unrelated file's own expired-lease fixture can legitimately be swept up in the same scan.
    const summary = await scanAndRecoverExpiredLeases('recovery-worker');
    expect(summary.safeReplayScheduled).toBeGreaterThanOrEqual(1);

    const afterRecovery = await getNodeInstanceByOccurrence(instance.id, 'render');
    expect(afterRecovery!.status).toBe('RETRYING');
    expect(afterRecovery!.leaseOwnerId).toBeNull();

    const attempts = await listAttemptsForNode(render!.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].id).toBe(startedAttempt.id);
    expect(attempts[0].status).toBe('UNKNOWN');
    expect(attempts[0].errorCode).toBe('WF_ACTION_OUTCOME_UNKNOWN');

    const reloadedInstance = await getWorkflowInstanceById(instance.id);
    expect(reloadedInstance!.status).toBe('RUNNING');

    void claimed; // claim confirmed the pre-recovery RUNNING state existed; recovery re-fenced it.
  });

  it('unsafe uncertainty: retries exhausted (or non-replayable) terminalizes the attempt UNKNOWN and fails node + instance', async () => {
    const model = baseModel({
      nodes: [
        actionNode('render', {
          input: mappingOf({ template: lit('hi'), variables: lit({}) as never }),
          retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [{ type: 'TIMEOUT' }] },
        }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'render', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
    const { instance } = await publishAndStart(model);
    const render = await getNodeInstanceByOccurrence(instance.id, 'render');
    await claimReadyOrRetryingNode(render!.id, render!.stateVersion, 'crashed-worker', -1000);
    const logicalInvocationId = 'test-logical-invocation-2';
    await createStartedAttempt({
      workflowInstanceId: instance.id,
      nodeInstanceId: render!.id,
      actionKey: 'text.template',
      actionVersion: '1',
      logicalInvocationId,
      idempotencyKey: computeLogicalInvocationKey({ workflowInstanceId: String(instance.id), nodeInstanceId: String(render!.id), logicalInvocationId }),
    });

    const summary = await scanAndRecoverExpiredLeases('recovery-worker');
    expect(summary.unknownFailed).toBeGreaterThanOrEqual(1);

    const afterRecovery = await getNodeInstanceByOccurrence(instance.id, 'render');
    expect(afterRecovery!.status).toBe('FAILED');
    const reloadedInstance = await getWorkflowInstanceById(instance.id);
    expect(reloadedInstance!.status).toBe('FAILED');
  });

  it('non-ACTION node with a stale RUNNING lease and no attempt is reclaimed and safely redriven to completion', async () => {
    const model = baseModel({
      nodes: [decisionNode('d1'), endNode('end-high'), endNode('end-low')],
      edges: [
        decisionEdge('e-high', 'd1', 'end-high', { op: 'GTE', left: workflowInputPath(['total']), right: lit(100) }),
        decisionDefaultEdge('e-low', 'd1', 'end-low'),
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    });
    const { instance } = await publishAndStart(model, { total: 500 });
    const d1 = await getNodeInstanceByOccurrence(instance.id, 'd1');

    // Simulate a crash after claim but before the evaluate+apply step ever ran.
    await claimReadyOrRetryingNode(d1!.id, d1!.stateVersion, 'crashed-worker', -1000);

    const summary = await scanAndRecoverExpiredLeases('recovery-worker');
    expect(summary.staleReclaimed).toBeGreaterThanOrEqual(1);

    const endHigh = await getNodeInstanceByOccurrence(instance.id, 'end-high');
    expect(endHigh!.status).toBe('READY');
    expect(endHigh!.selectedIncomingEdgeKey).toBe('e-high');
  });
});
