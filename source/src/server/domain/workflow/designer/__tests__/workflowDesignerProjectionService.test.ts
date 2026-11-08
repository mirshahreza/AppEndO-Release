import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, getWorkflowDefinitionById } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { validateWorkflowDraft } from '../../publication/validateDraftPreview';
import { baseModel, endNode } from '../../publication/__tests__/fixtures';
import { loadWorkflowDesignerProjection, saveWorkflowDesignerView } from '../workflowDesignerProjectionService';
import type { WorkflowModel } from '../../awm/types';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const manualApiModel = (key: string): WorkflowModel => baseModel({ key, name: key, nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });

describe.skipIf(!dbReady)('loadWorkflowDesignerProjection (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('returns definition identity, draftVersion, canonical model, null view/validation/revision for a brand-new definition', async () => {
    const key = uniqueKey('proj-new');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(manualApiModel(key)) });

    const projection = await loadWorkflowDesignerProjection(definition.id);
    expect(projection.definition.id).toBe(definition.id);
    expect(projection.definition.lifecycleStatus).toBe('DRAFT');
    expect(projection.draftVersion).toBe(1);
    expect(projection.model.nodes.some((n) => n.key === 'end-1')).toBe(true);
    expect(projection.designerView).toBeNull();
    expect(projection.latestValidation).toBeNull();
    expect(projection.currentPublishedRevision).toBeNull();
    expect(projection.actionCatalog.length).toBeGreaterThanOrEqual(0);
  });

  it('surfaces the latest validation report for the exact current draftVersion and the current published revision after Publish', async () => {
    const key = uniqueKey('proj-pub');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(manualApiModel(key)) });
    await validateWorkflowDraft(definition.id, definition.draftVersion);
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const projection = await loadWorkflowDesignerProjection(definition.id);
    expect(projection.latestValidation).not.toBeNull();
    expect(projection.latestValidation!.status).toBe('PASSED');
    expect(projection.currentPublishedRevision).toEqual({ id: revision.id, revisionNumber: 1, publicationStatus: 'PUBLISHED', bindingStatus: 'NOT_REQUIRED', semanticFingerprint: revision.semanticFingerprint });
  });

  it('saveWorkflowDesignerView persists view state without touching draftVersion or the semantic draft', async () => {
    const key = uniqueKey('proj-view');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(manualApiModel(key)) });

    const view = await saveWorkflowDesignerView(definition.id, definition.draftVersion, JSON.stringify({ nodePositions: { 'end-1': { x: 10, y: 20 } } }), 7);
    expect(view.viewJson).toContain('"x":10');

    const reloadedDefinition = await getWorkflowDefinitionById(definition.id);
    expect(reloadedDefinition!.draftVersion).toBe(definition.draftVersion);

    const projection = await loadWorkflowDesignerProjection(definition.id);
    expect(projection.designerView).not.toBeNull();
    expect(projection.designerView!.viewJson).toContain('"x":10');
  });
});
