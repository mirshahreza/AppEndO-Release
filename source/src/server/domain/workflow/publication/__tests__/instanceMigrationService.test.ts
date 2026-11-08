import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, updateWorkflowDefinitionDraft } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../workflowPublicationService';
import { startWorkflowInstance } from '../../engine/startService';
import { getWorkflowInstanceById } from '../../workflowInstanceRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { getInstanceMigrationImpact, migrateInstancesToRevision } from '../instanceMigrationService';
import { baseModel, endNode, actionNode, unconditionalEdge } from '../../engine/__tests__/fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

registerCoreActionPack();

const retryPolicy = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

const twoStepModel = () =>
  baseModel({
    nodes: [actionNode('a1', { retryPolicy }), actionNode('a2', { retryPolicy }), endNode('end-1')],
    edges: [unconditionalEdge('e1', 'a1', 'a2'), unconditionalEdge('e2', 'a2', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'a1' },
  });

describe.skipIf(!dbReady)('instanceMigrationService (real DB, p-99 WFT-8)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('migrates an in-flight instance to a byte-identical republished revision', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('migrate-safe'), draftDefinitionJson: JSON.stringify(twoStepModel()) });
    const { revision: rev1 } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: rev1.id, input: {}, startedByType: 'USER', startedById: 1 });

    const draftUpdated = await updateWorkflowDefinitionDraft(definition.id, definition.draftVersion, { draftDefinitionJson: JSON.stringify(twoStepModel()) });
    const { revision: rev2 } = await publishWorkflowDefinition(definition.id, draftUpdated.draftVersion);
    expect(rev2.revisionNumber).toBe(2);

    const impact = await getInstanceMigrationImpact(rev1.id, rev2.id);
    expect(impact.totalConsidered).toBe(1);
    expect(impact.migratableCount).toBe(1);
    expect(impact.blockedCount).toBe(0);
    expect(impact.items).toEqual([{ instanceId: instance.id, safe: true }]);

    const result = await migrateInstancesToRevision(rev1.id, rev2.id);
    expect(result.migratedCount).toBe(1);

    const reloaded = await getWorkflowInstanceById(instance.id);
    expect(reloaded!.workflowRevisionId).toBe(rev2.id);
  });

  it('blocks migration when a node reachable from the active node changed, and leaves the instance untouched', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('migrate-blocked'), draftDefinitionJson: JSON.stringify(twoStepModel()) });
    const { revision: rev1 } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: rev1.id, input: {}, startedByType: 'USER', startedById: 1 });

    const changedModel = twoStepModel();
    changedModel.nodes = changedModel.nodes.map((n) => (n.key === 'a2' ? actionNode('a2', { retryPolicy: { maxAttempts: 7, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }) : n));
    const draftUpdated = await updateWorkflowDefinitionDraft(definition.id, definition.draftVersion, { draftDefinitionJson: JSON.stringify(changedModel) });
    const { revision: rev2 } = await publishWorkflowDefinition(definition.id, draftUpdated.draftVersion);

    const impact = await getInstanceMigrationImpact(rev1.id, rev2.id);
    expect(impact.migratableCount).toBe(0);
    expect(impact.blockedCount).toBe(1);
    expect(impact.items).toEqual([{ instanceId: instance.id, safe: false, reason: { code: 'NODE_CHANGED', nodeKey: 'a2' } }]);

    const result = await migrateInstancesToRevision(rev1.id, rev2.id);
    expect(result.migratedCount).toBe(0);

    const reloaded = await getWorkflowInstanceById(instance.id);
    expect(reloaded!.workflowRevisionId).toBe(rev1.id);
  });

  it('rejects revisions from two different WorkflowDefinitions', async () => {
    const definitionA = await createTestWorkflowDefinition({ key: uniqueKey('migrate-a'), draftDefinitionJson: JSON.stringify(twoStepModel()) });
    const { revision: revA } = await publishWorkflowDefinition(definitionA.id, definitionA.draftVersion);
    const definitionB = await createTestWorkflowDefinition({ key: uniqueKey('migrate-b'), draftDefinitionJson: JSON.stringify(twoStepModel()) });
    const { revision: revB } = await publishWorkflowDefinition(definitionB.id, definitionB.draftVersion);

    await expect(getInstanceMigrationImpact(revA.id, revB.id)).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
  });
});
