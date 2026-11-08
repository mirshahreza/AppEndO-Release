import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, applyDraftOperationsToDefinition, getWorkflowDefinitionById } from '../workflowDefinitionRepository';
import type { WorkflowModel } from '../awm/types';
import type { WorkflowDraftOperation } from '../awm/draftOperations';

const dbReady = await isDatabaseReachable();

const emptyDraft: WorkflowModel = {
  schemaVersion: '1',
  key: 'w',
  name: 'w',
  inputSchema: { type: 'INLINE', schema: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  variables: [],
  start: { type: 'MANUAL_API', targetNodeKey: '__unset__' },
  nodes: [],
  edges: [],
  policies: {
    recoveryDetectionBoundMs: 1,
    limits: {
      maxNodes: 100, maxEdges: 100, maxPayloadBytes: 100000, maxJsonDepth: 20,
      maxExpressionNodes: 500, maxStructuralPathCandidates: 1000, maxDelayMs: 86400000,
      maxWaitTimeoutMs: 86400000, maxWorkItemTitleLength: 200,
    },
  },
};

describe.skipIf(!dbReady)('applyDraftOperationsToDefinition (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('persists the applier candidate and increments draftVersion by exactly 1', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('draft-ops'), draftDefinitionJson: JSON.stringify(emptyDraft) });
    const ops: WorkflowDraftOperation[] = [
      { operationSchemaVersion: '1', type: 'ADD_NODE', node: { kind: 'END', key: 'end-1', output: { type: 'OBJECT', fields: {} } } },
      { operationSchemaVersion: '1', type: 'CHANGE_START', start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } },
    ];
    const result = await applyDraftOperationsToDefinition(definition.id, definition.draftVersion, ops);
    expect(result.record.draftVersion).toBe(definition.draftVersion + 1);
    expect(result.candidate.nodes).toHaveLength(1);

    const reloaded = await getWorkflowDefinitionById(definition.id);
    const reloadedModel = JSON.parse(reloaded!.draftDefinitionJson) as WorkflowModel;
    expect(reloadedModel.nodes.map((n) => n.key)).toEqual(['end-1']);
  });

  it('rejects a stale expectedDraftVersion without persisting anything', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('draft-ops-stale'), draftDefinitionJson: JSON.stringify(emptyDraft) });
    await expect(
      applyDraftOperationsToDefinition(definition.id, definition.draftVersion + 1, [
        { operationSchemaVersion: '1', type: 'ADD_NODE', node: { kind: 'END', key: 'e', output: { type: 'OBJECT', fields: {} } } },
      ]),
    ).rejects.toMatchObject({ code: 'WF_DEF_STALE_DRAFT_VERSION' });

    const reloaded = await getWorkflowDefinitionById(definition.id);
    expect(reloaded!.draftVersion).toBe(definition.draftVersion);
  });

  it('an invalid operation batch (dangling reference) leaves the persisted draft untouched', async () => {
    const withNode: WorkflowModel = {
      ...emptyDraft,
      nodes: [
        { kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' },
        { kind: 'END', key: 'e1', output: { type: 'OBJECT', fields: {} } },
      ],
      edges: [{ key: 'edge-1', fromNodeKey: 'd1', toNodeKey: 'e1', selector: { type: 'DECISION_DEFAULT' } }],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
    };
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('draft-ops-invalid'), draftDefinitionJson: JSON.stringify(withNode) });

    await expect(
      applyDraftOperationsToDefinition(definition.id, definition.draftVersion, [
        { operationSchemaVersion: '1', type: 'REMOVE_NODE', nodeKey: 'e1' },
      ]),
    ).rejects.toThrow();

    const reloaded = await getWorkflowDefinitionById(definition.id);
    expect(reloaded!.draftVersion).toBe(definition.draftVersion);
    const reloadedModel = JSON.parse(reloaded!.draftDefinitionJson) as WorkflowModel;
    expect(reloadedModel.nodes).toHaveLength(2);
  });
});
