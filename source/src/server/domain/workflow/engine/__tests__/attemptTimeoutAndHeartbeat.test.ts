import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { listAttemptsForNode } from '../../workflowExecutionAttemptRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { registerActionDefinition, registerActionProvider, getActionDefinition } from '../../actions/registry';
import type { ActionExecutor } from '../../actions/types';
import { baseModel, endNode, actionNode, unconditionalEdge } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'test-worker';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

registerCoreActionPack();

/** A slow, DEDUPLICATED test-only Action registered directly (not corePack) — sleeps `delayMs` then succeeds. */
function registerSlowAction(key: string, executionTimeoutMs: number, delayMs: number): void {
  if (getActionDefinition(key, '1')) return;
  registerActionDefinition({
    key,
    version: '1',
    contributor: { type: 'CORE', id: 'core' },
    configSchema: { type: 'INLINE', schema: {} },
    inputSchema: { type: 'INLINE', schema: {} },
    outputSchema: { type: 'INLINE', schema: {} },
    executionTimeoutMs,
    idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86_400_000 },
    cancellationSupport: 'NONE',
    sideEffectClass: 'PURE',
    riskClass: 'LOW',
    requiredCapabilities: [],
    requiredPermissions: [],
    secretReferenceFields: [],
    availability: 'AVAILABLE',
    executionMode: 'DETERMINISTIC',
    tags: ['test'],
  });
  const executor: ActionExecutor = {
    async execute() {
      await sleep(delayMs);
      return { status: 'SUCCEEDED', output: { slept: delayMs } };
    },
  };
  registerActionProvider({ actionKey: key, actionVersion: '1', providerId: 'core', providerVersion: '1', contributorType: 'CORE', providesCapabilities: [], registryPriority: 1000, executor });
}

async function publishAndStart(model: ReturnType<typeof baseModel>) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('timeout-hb'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
}

describe.skipIf(!dbReady)('attempt timeout and heartbeat (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('heartbeat: keeps the node lease alive (invisible to the Recovery Scanner) through an executor call longer than the initial lease duration', async () => {
    registerSlowAction('test.slow-heartbeat', 5_000, 450);
    const model = baseModel({
      nodes: [
        actionNode('slow', { actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'test.slow-heartbeat', actionVersion: '1' }, providerId: 'core', providerVersion: '1' }, retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'slow', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'slow' },
    });
    const { instance } = await publishAndStart(model);
    const slow = await getNodeInstanceByOccurrence(instance.id, 'slow');
    const initialLeaseExpiresAt = new Date(Date.now() + 150).getTime();

    // A short initial lease (150ms) that would already be expired well before the 450ms executor finishes, if heartbeat did not renew it.
    const dispatchPromise = dispatchNode({ nodeInstanceId: slow!.id, leaseOwnerId: leaseOwner, leaseDurationMs: 150 });

    await sleep(250); // past the original 150ms lease, but heartbeat (renewing at ~50ms intervals) should have kept it alive
    // Assert directly on this node's own row rather than a global recovery scan, which would race unrelated concurrently-running test files' own expired-lease fixtures on the shared test database.
    const midFlight = await getNodeInstanceByOccurrence(instance.id, 'slow');
    expect(midFlight!.status).toBe('RUNNING');
    expect(new Date(midFlight!.leaseExpiresAt!).getTime()).toBeGreaterThan(initialLeaseExpiresAt);
    expect(midFlight!.stateVersion).toBeGreaterThan(slow!.stateVersion + 1); // claim (+1) plus at least one heartbeat renewal (+1 each)

    const outcome = await dispatchPromise;
    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'SELECT_EDGE', edgeKey: 'e1', nodeOutput: { slept: 450 } } });

    const attempts = await listAttemptsForNode(slow!.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('SUCCEEDED');
  });

  it('timeout: an executor that outlives executionTimeoutMs is terminalized TIMED_OUT and, with a matching TIMEOUT retry selector, the node retries', async () => {
    registerSlowAction('test.slow-timeout', 100, 400);
    const model = baseModel({
      nodes: [
        actionNode('slow', {
          actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'test.slow-timeout', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
          retryPolicy: { maxAttempts: 2, strategy: 'FIXED', initialDelayMs: 0, retryOn: [{ type: 'TIMEOUT' }] },
        }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'slow', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'slow' },
    });
    const { instance } = await publishAndStart(model);
    const slow = await getNodeInstanceByOccurrence(instance.id, 'slow');

    const outcome = await dispatchNode({ nodeInstanceId: slow!.id, leaseOwnerId: leaseOwner });
    expect(outcome).toMatchObject({ status: 'DISPATCHED', decision: { kind: 'RETRY_SCHEDULED' } });

    const attempts = await listAttemptsForNode(slow!.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('TIMED_OUT');

    const afterTimeout = await getNodeInstanceByOccurrence(instance.id, 'slow');
    expect(afterTimeout!.status).toBe('RETRYING');

    // Let the orphaned slow executor from attempt 1 actually finish in the background so it cannot leak into the next test/process.
    await sleep(350);
  });
});
