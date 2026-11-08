import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, getWorkflowDefinitionById, applyDraftOperationsToDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { baseModel, endNode, emptyMapping } from '../../publication/__tests__/fixtures';
import { duplicateWorkflow } from '../duplicationService';
import type { WorkflowModel } from '../../awm/types';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const manualApiModel = (key: string): WorkflowModel => baseModel({ key, name: key, nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });

describe.skipIf(!dbReady)('duplicateWorkflow (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('DRAFT source: creates an independent new definition with provenance, fresh draftVersion=1, no runtime/publication pointer copied', async () => {
    const sourceKey = uniqueKey('dup-src-draft');
    const source = await createTestWorkflowDefinition({ key: sourceKey, draftDefinitionJson: JSON.stringify(manualApiModel(sourceKey)) });

    const targetKey = uniqueKey('dup-target-draft');
    const target = await duplicateWorkflow(
      { type: 'DRAFT', workflowDefinitionId: source.id, expectedDraftVersion: source.draftVersion },
      { scopeKey: 'global', key: targetKey, name: 'Duplicated Name' },
      { type: 'USER', id: 7 },
    );

    expect(target.id).not.toBe(source.id);
    expect(target.key).toBe(targetKey);
    expect(target.draftVersion).toBe(1);
    expect(target.currentPublishedRevisionId).toBeNull();
    expect(target.creationMode).toBe('DUPLICATE');
    expect(target.createdFromDefinitionId).toBe(source.id);
    expect(target.createdFromRevisionId).toBeNull();

    const targetModel = JSON.parse(target.draftDefinitionJson) as WorkflowModel;
    expect(targetModel.key).toBe(targetKey);
    expect(targetModel.name).toBe('Duplicated Name');
  });

  it('DRAFT source: rejects a stale expectedDraftVersion', async () => {
    const source = await createTestWorkflowDefinition({ key: uniqueKey('dup-stale'), draftDefinitionJson: JSON.stringify(manualApiModel('x')) });
    await expect(
      duplicateWorkflow({ type: 'DRAFT', workflowDefinitionId: source.id, expectedDraftVersion: source.draftVersion + 1 }, { scopeKey: 'global', key: uniqueKey('dup-target') }, { type: 'USER', id: null }),
    ).rejects.toMatchObject({ code: 'WF_DEF_STALE_DRAFT_VERSION' });
  });

  it('REVISION source: duplicates an immutable published revision; later source changes do not alter target', async () => {
    const sourceKey = uniqueKey('dup-src-rev');
    const source = await createTestWorkflowDefinition({ key: sourceKey, draftDefinitionJson: JSON.stringify(manualApiModel(sourceKey)) });
    const { revision } = await publishWorkflowDefinition(source.id, source.draftVersion);
    expect(revision.publicationStatus).toBe('PUBLISHED');

    const targetKey = uniqueKey('dup-target-rev');
    const target = await duplicateWorkflow({ type: 'REVISION', sourceRevisionId: revision.id }, { scopeKey: 'global', key: targetKey }, { type: 'USER', id: null });

    expect(target.draftVersion).toBe(1);
    expect(target.currentPublishedRevisionId).toBeNull();
    expect(target.createdFromDefinitionId).toBe(source.id);
    expect(target.createdFromRevisionId).toBe(revision.id);

    // Mutate the source definition's *draft* after duplication — target must be unaffected since duplication sourced from the immutable revision snapshot, not the live draft.
    const reloadedSource = await getWorkflowDefinitionById(source.id);
    await applyDraftOperationsToDefinition(source.id, reloadedSource!.draftVersion, [{ operationSchemaVersion: '1', type: 'ADD_NODE', node: { kind: 'END', key: 'end-2', output: emptyMapping() } }]);

    const reloadedTarget = await getWorkflowDefinitionById(target.id);
    const targetModel = JSON.parse(reloadedTarget!.draftDefinitionJson) as WorkflowModel;
    expect(targetModel.nodes.some((n) => n.key === 'end-2')).toBe(false);
  });

  it('rejects duplicating into an already-occupied (scopeKey, key) target', async () => {
    const source = await createTestWorkflowDefinition({ key: uniqueKey('dup-conflict-src'), draftDefinitionJson: JSON.stringify(manualApiModel('x')) });
    const occupiedKey = uniqueKey('dup-conflict-target');
    await createTestWorkflowDefinition({ key: occupiedKey, draftDefinitionJson: JSON.stringify(manualApiModel(occupiedKey)) });

    await expect(
      duplicateWorkflow({ type: 'DRAFT', workflowDefinitionId: source.id, expectedDraftVersion: source.draftVersion }, { scopeKey: 'global', key: occupiedKey }, { type: 'USER', id: null }),
    ).rejects.toMatchObject({ code: 'WF_DEF_INVALID_REFERENCE' });
  });
});
