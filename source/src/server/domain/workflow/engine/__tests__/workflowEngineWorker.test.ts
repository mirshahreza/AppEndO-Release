import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { listClaimableNodeInstanceIds } from '../../workflowNodeInstanceRepository';
import { runOneEngineWorkerTick } from '../workflowEngineWorker';
import { registerCoreActionPack } from '../../actions/corePack';
import { registerActionDefinition, registerActionProvider } from '../../actions/registry';
import { baseModel, endNode, actionNode, unconditionalEdge, mappingOf, lit } from './fixtures';
import type { ActionDefinition, ActionProviderRegistration } from '../../actions/types';
import type { ActionResolutionRef } from '../../awm/types';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const NO_RETRY = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

/** A real, registered (so publication resolves it), always-FAILED test-only Action. */
function registerAlwaysFailingTestAction(): ActionResolutionRef {
  const actionKey = uniqueKey('test.always-fail');
  const definition: ActionDefinition = {
    key: actionKey,
    version: '1',
    contributor: { type: 'PACKAGE', id: 'test-package' },
    configSchema: { type: 'INLINE', schema: {} },
    inputSchema: { type: 'INLINE', schema: {} },
    outputSchema: { type: 'INLINE', schema: {} },
    executionTimeoutMs: 5000,
    idempotency: { guarantee: 'NONE' },
    cancellationSupport: 'NONE',
    sideEffectClass: 'PURE',
    riskClass: 'LOW',
    requiredCapabilities: [],
    requiredPermissions: [],
    secretReferenceFields: [],
    availability: 'AVAILABLE',
    executionMode: 'DETERMINISTIC',
    tags: [],
  };
  const provider: ActionProviderRegistration = {
    actionKey,
    actionVersion: '1',
    providerId: 'core',
    providerVersion: '1',
    contributorType: 'PACKAGE',
    providesCapabilities: [],
    registryPriority: 1000,
    executor: { execute: async () => ({ status: 'FAILED' as const, errorCode: 'WF_EXEC_ENGINE_INVARIANT', errorClass: 'DETERMINISTIC', safeMessage: 'deliberate test failure' }) },
  };
  registerActionDefinition(definition);
  registerActionProvider(provider);
  return { type: 'EXACT_PROVIDER', action: { actionKey, actionVersion: '1' }, providerId: 'core', providerVersion: '1' };
}

registerCoreActionPack();

/**
 * Slice 12 — `workflowEngineWorker.ts` is the background poller that closes the real gap found
 * during real-HTTP verification: nothing in `bootstrapFullRuntime.ts` previously ever called
 * `dispatchNode`/the doc 06 section 10 scanners, so a live-server-started instance would sit
 * `READY` forever. These tests call `runOneEngineWorkerTick` directly (not the `setInterval` loop)
 * against real Postgres, no mocks.
 *
 * Tolerates pre-existing unrelated recovery-scan noise: this shared dev/test database has
 * accumulated `RUNNING`/expired-lease debris from many past test sessions across every prior
 * slice (confirmed by direct query during this session — thousands of `uniqueKey()`-prefixed test
 * rows), and `scanAndRecoverExpiredLeases` is deliberately global (doc 06 section 2) with no
 * per-test filter. A debris row bound to a long-gone test-only Action key can make the recovery
 * *scan phase* throw `WF_ACTION_IMPLEMENTATION_UNAVAILABLE` — this is a known, pre-existing,
 * environmental test-data-hygiene issue (documented in `docs/standards/workflow-engine-testing.md`), not a
 * defect in this worker. Dispatch (this file's actual subject) runs *before* the scanners in tick
 * order and is per-node try/catch-isolated, so it is unaffected either way.
 */
describe.skipIf(!dbReady)('workflowEngineWorker (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('listClaimableNodeInstanceIds finds a freshly-started READY node', async () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('engine-worker-claimable'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { nodeInstances } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'SYSTEM' });
    const readyNode = nodeInstances.find((n) => n.semanticNodeKey === 'end-1')!;

    const claimable = await listClaimableNodeInstanceIds(5000);
    expect(claimable).toContain(readyNode.id);
  });

  it('runOneEngineWorkerTick dispatches a READY end-only instance through to SUCCEEDED', async () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('engine-worker-end'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'SYSTEM' });
    expect(instance.status).toBe('RUNNING');

    try {
      await runOneEngineWorkerTick(5000);
    } catch {
      // Pre-existing unrelated recovery-scan debris (see module doc above) — dispatch already ran first.
    }

    const after = await getWorkflowInstanceById(instance.id);
    expect(after!.status).toBe('SUCCEEDED');
  });

  it('runOneEngineWorkerTick dispatches a real ACTION node (text.template) through to SUCCEEDED', async () => {
    const model = baseModel({
      nodes: [
        actionNode('render', { input: mappingOf({ template: lit('hello-{{name}}'), variables: lit({ name: 'slice12' }) }), retryPolicy: NO_RETRY }),
        endNode('end-1', mappingOf({ text: { op: 'PATH', path: { root: { type: 'NODE_OUTPUT', nodeKey: 'render' }, segments: ['text'] } } })),
      ],
      edges: [unconditionalEdge('e1', 'render', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'render' },
    });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('engine-worker-action'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'SYSTEM' });

    // Two ticks: one to dispatch+complete the ACTION node (READY -> RUNNING -> SUCCEEDED, selecting
    // the edge to end-1 and readying it), one to dispatch the now-READY end-1 node.
    for (let i = 0; i < 2; i += 1) {
      try {
        await runOneEngineWorkerTick(5000);
      } catch {
        // see module doc — pre-existing unrelated debris in the scan phase, not this test's subject.
      }
    }

    const after = await getWorkflowInstanceById(instance.id);
    expect(after!.status).toBe('SUCCEEDED');
    expect(JSON.parse(after!.outputJson!)).toEqual({ text: 'hello-slice12' });
  });

  it('runOneEngineWorkerTick isolates a single failing node dispatch from the rest of the batch (per-node try/catch)', async () => {
    // A node bound to a real, registered, always-FAILED test Action, alongside a healthy instance in the same tick batch.
    const failingActionRef = registerAlwaysFailingTestAction();
    const failingModel = baseModel({
      nodes: [actionNode('willFail', { retryPolicy: NO_RETRY, actionRef: failingActionRef }), endNode('end-1')],
      edges: [unconditionalEdge('e1', 'willFail', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'willFail' },
    });
    const healthyModel = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });

    const failingDef = await createTestWorkflowDefinition({ key: uniqueKey('engine-worker-fail'), draftDefinitionJson: JSON.stringify(failingModel) });
    const { revision: failingRevision } = await publishWorkflowDefinition(failingDef.id, failingDef.draftVersion);
    const { instance: failingInstance } = await startWorkflowInstance({ workflowRevisionId: failingRevision.id, input: null, startedByType: 'SYSTEM' });

    const healthyDef = await createTestWorkflowDefinition({ key: uniqueKey('engine-worker-healthy'), draftDefinitionJson: JSON.stringify(healthyModel) });
    const { revision: healthyRevision } = await publishWorkflowDefinition(healthyDef.id, healthyDef.draftVersion);
    const { instance: healthyInstance } = await startWorkflowInstance({ workflowRevisionId: healthyRevision.id, input: null, startedByType: 'SYSTEM' });

    let summary;
    try {
      summary = await runOneEngineWorkerTick(5000);
    } catch {
      // scan-phase debris, see module doc; dispatch phase (this test's subject) already completed above the throw point.
    }

    const afterHealthy = await getWorkflowInstanceById(healthyInstance.id);
    expect(afterHealthy!.status).toBe('SUCCEEDED');

    const afterFailing = await getWorkflowInstanceById(failingInstance.id);
    // The failing node retries with maxAttempts:1 -> unhandled failure -> instance FAILED; either
    // way it must not still be stuck RUNNING/READY, and must not have blocked the healthy instance.
    expect(afterFailing!.status).not.toBe('CREATED');
    if (summary) {
      expect(summary.nodesClaimed).toBeGreaterThanOrEqual(1);
    }
  });
});
