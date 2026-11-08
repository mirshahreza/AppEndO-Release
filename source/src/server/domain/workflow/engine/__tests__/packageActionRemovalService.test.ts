import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, getWorkflowDefinitionById } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { disableWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { registerActionDefinition, registerActionProvider } from '../../actions/registry';
import { analyzeActionRemovalImpact, applyActionRemovalPolicy } from '../packageActionRemovalService';
import { baseModel, endNode, actionNode, unconditionalEdge } from './fixtures';
import type { ActionDefinition, ActionProviderRegistration } from '../../actions/types';
import type { ActionResolutionRef } from '../../awm/types';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const NO_RETRY: { maxAttempts: number; strategy: 'FIXED'; initialDelayMs: number; retryOn: never[] } = { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] };

/**
 * Doc 09 section 9 / doc 11 section 14 — every test registers its OWN fresh, uniquely-keyed
 * throwaway test-only Action (never a real corePack key like `text.template`, and never shared
 * across tests either — `analyzeActionRemovalImpact` scans every `PUBLISHED` revision in the
 * shared dev/test Postgres database, so a key reused across tests would accumulate cross-test
 * PUBLISHED revisions and break isolation). `markActionUnavailable` (used by the FORCE test)
 * therefore can never leak into or break any other test.
 */
function registerFreshTestAction(): { actionKey: string; actionRef: ActionResolutionRef } {
  const actionKey = uniqueKey('test.removal-target');
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
    executor: { execute: async () => ({ status: 'SUCCEEDED' as const, output: null }) },
  };
  registerActionDefinition(definition);
  registerActionProvider(provider);
  return { actionKey, actionRef: { type: 'EXACT_PROVIDER', action: { actionKey, actionVersion: '1' }, providerId: 'core', providerVersion: '1' } };
}

describe.skipIf(!dbReady)('packageActionRemovalService (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const modelUsingAction = (actionRef: ActionResolutionRef) =>
    baseModel({
      nodes: [actionNode('a1', { actionRef, retryPolicy: NO_RETRY }), endNode('end-1')],
      edges: [unconditionalEdge('e1', 'a1', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
    });

  it('analyzeActionRemovalImpact finds zero affected revisions for an action nothing references', async () => {
    const impact = await analyzeActionRemovalImpact('no-such-action-key', '1');
    expect(impact.affectedRevisions).toEqual([]);
  });

  it('analyzeActionRemovalImpact finds a PUBLISHED/startable revision that references the action', async () => {
    const { actionKey, actionRef } = registerFreshTestAction();
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('removal-impact'), draftDefinitionJson: JSON.stringify(modelUsingAction(actionRef)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const impact = await analyzeActionRemovalImpact(actionKey, '1');
    const row = impact.affectedRevisions.find((r) => r.workflowRevisionId === revision.id);
    expect(row).toBeDefined();
    expect(row!.workflowDefinitionId).toBe(definition.id);
    expect(row!.startable).toBe(true);
    expect(row!.runningInstanceCount).toBe(0);
  });

  it('analyzeActionRemovalImpact counts a non-terminal running instance on the revision', async () => {
    const { actionKey, actionRef } = registerFreshTestAction();
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('removal-impact-running'), draftDefinitionJson: JSON.stringify(modelUsingAction(actionRef)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'USER', startedById: 1 });
    expect(instance.status).toBe('RUNNING');

    const impact = await analyzeActionRemovalImpact(actionKey, '1');
    const row = impact.affectedRevisions.find((r) => r.workflowRevisionId === revision.id);
    expect(row!.runningInstanceCount).toBe(1);
  });

  it('BLOCK rejects removal with WF_ACTION_IMPLEMENTATION_UNAVAILABLE while a startable/active dependent exists', async () => {
    const { actionKey, actionRef } = registerFreshTestAction();
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('removal-block'), draftDefinitionJson: JSON.stringify(modelUsingAction(actionRef)) });
    await publishWorkflowDefinition(definition.id, definition.draftVersion);

    await expect(applyActionRemovalPolicy({ actionKey, actionVersion: '1', policy: 'BLOCK' })).rejects.toMatchObject({ code: 'WF_ACTION_IMPLEMENTATION_UNAVAILABLE' });
  });

  it('BLOCK succeeds (no-op) when nothing active/startable depends on the action', async () => {
    const isolatedKey = uniqueKey('test.removal-target-unused');
    const result = await applyActionRemovalPolicy({ actionKey: isolatedKey, actionVersion: '1', policy: 'BLOCK' });
    expect(result.impact.affectedRevisions).toEqual([]);
    expect(result.disabledDefinitionIds).toEqual([]);
  });

  it('WARN_AND_DISABLE_NEW_STARTS disables every affected startable definition for new starts and preserves running instances', async () => {
    const { actionKey, actionRef } = registerFreshTestAction();
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('removal-warn'), draftDefinitionJson: JSON.stringify(modelUsingAction(actionRef)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'USER', startedById: 1 });
    const publishedDefinition = (await getWorkflowDefinitionById(definition.id))!;

    const result = await applyActionRemovalPolicy({
      actionKey,
      actionVersion: '1',
      policy: 'WARN_AND_DISABLE_NEW_STARTS',
      disableExpectedDefinitionStateVersions: { [definition.id]: publishedDefinition.stateVersion },
    });

    expect(result.disabledDefinitionIds).toContain(definition.id);
    expect(result.markedUnavailable).toBe(false);

    // "Disables affected definitions for NEW starts": a fresh Start attempt on the now-disabled
    // definition's revision must fail (doc 05 section 14), while the already-running instance
    // created before the disable is left completely untouched (doc 09 section 9 "preserves
    // running instances" — that guarantee is about existing instances, not about new-start
    // eligibility, which WARN_AND_DISABLE_NEW_STARTS explicitly revokes).
    await expect(startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'SYSTEM' })).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
    expect(instance.status).toBe('RUNNING');
  });

  it('WARN_AND_DISABLE_NEW_STARTS requires an expectedDefinitionStateVersion for every affected definition', async () => {
    const { actionKey, actionRef } = registerFreshTestAction();
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('removal-warn-missing-version'), draftDefinitionJson: JSON.stringify(modelUsingAction(actionRef)) });
    await publishWorkflowDefinition(definition.id, definition.draftVersion);

    await expect(
      applyActionRemovalPolicy({ actionKey, actionVersion: '1', policy: 'WARN_AND_DISABLE_NEW_STARTS' }),
    ).rejects.toMatchObject({ code: 'WF_EXEC_ENGINE_INVARIANT' });
  });

  it('FORCE requires explicit acknowledgement, otherwise rejects with WF_AUTH_FORBIDDEN', async () => {
    const { actionKey } = registerFreshTestAction();
    await expect(
      applyActionRemovalPolicy({ actionKey, actionVersion: '1', policy: 'FORCE' }),
    ).rejects.toMatchObject({ code: 'WF_AUTH_FORBIDDEN' });
  });

  it('FORCE marks the Action unavailable; a running pinned revision that later dispatches it fails with WF_ACTION_IMPLEMENTATION_UNAVAILABLE, matching doc 09 section 9', async () => {
    const { actionKey, actionRef } = registerFreshTestAction();

    const definition = await createTestWorkflowDefinition({ key: uniqueKey('removal-force'), draftDefinitionJson: JSON.stringify(modelUsingAction(actionRef)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance, nodeInstances } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: null, startedByType: 'USER', startedById: 1 });
    expect(instance.status).toBe('RUNNING');

    const result = await applyActionRemovalPolicy({ actionKey, actionVersion: '1', policy: 'FORCE', forceAcknowledgement: { acknowledged: true, authorizedBy: 'test-operator' } });
    expect(result.markedUnavailable).toBe(true);

    const actionNodeInstance = nodeInstances.find((n) => n.semanticNodeKey === 'a1')!;
    await expect(dispatchNode({ nodeInstanceId: actionNodeInstance.id, leaseOwnerId: 'test-worker' })).rejects.toMatchObject({ code: 'WF_ACTION_IMPLEMENTATION_UNAVAILABLE' });
  });

  it('applyActionRemovalPolicy always re-derives impact from current data (never stale)', async () => {
    const { actionKey, actionRef } = registerFreshTestAction();
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('removal-fresh-impact'), draftDefinitionJson: JSON.stringify(modelUsingAction(actionRef)) });
    await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const before = await analyzeActionRemovalImpact(actionKey, '1');
    const definitionRow = before.affectedRevisions.find((r) => r.workflowDefinitionId === definition.id)!;
    expect(definitionRow.startable).toBe(true);

    await disableWorkflowDefinition(definition.id, (await getWorkflowDefinitionById(definition.id))!.stateVersion);
    const after = await analyzeActionRemovalImpact(actionKey, '1');
    const afterRow = after.affectedRevisions.find((r) => r.workflowDefinitionId === definition.id)!;
    expect(afterRow.startable).toBe(false);
  });
});
