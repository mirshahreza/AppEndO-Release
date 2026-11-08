import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, transitionWorkflowDefinitionLifecycle } from '../../workflowDefinitionRepository';
import { __resetActionRegistryForTests } from '../../actions/registry';
import { validateWorkflowDraftForPublication } from '../publicationValidator';
import { validateWorkflowDraft } from '../validateDraftPreview';
import type { WorkflowNodeDefinition } from '../../awm/types';
import { baseModel, endNode, mappingOf, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!dbReady)('validateWorkflowDraftForPublication (orchestration, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  beforeEach(() => {
    __resetActionRegistryForTests();
  });

  it('passes a minimal valid MANUAL_API model with an empty actionBindings list', async () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const result = await validateWorkflowDraftForPublication(model, 'global');
    expect(result.status).toBe('PASSED');
    expect(result.actionBindings).toHaveLength(0);
  });

  it('fails a model with a dangling edge reference (structural)', async () => {
    const model = baseModel({
      nodes: [endNode('end-1')],
      edges: [{ key: 'e1', fromNodeKey: 'ghost', toNodeKey: 'end-1', selector: { type: 'UNCONDITIONAL' } }],
      start: { type: 'MANUAL_API', targetNodeKey: 'end-1' },
    });
    const result = await validateWorkflowDraftForPublication(model, 'global');
    expect(result.status).toBe('FAILED');
    expect(result.actionBindings).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'WF_DEF_INVALID_REFERENCE')).toBe(true);
  });

  it('still runs policy-limit and pure-function checks even when the graph is structurally invalid (cyclic)', async () => {
    const nodes: WorkflowNodeDefinition[] = [
      { kind: 'DECISION', key: 'd1', mode: 'EXACT_ONE' },
      { kind: 'DECISION', key: 'd2', mode: 'EXACT_ONE' },
    ];
    const model = baseModel({
      nodes,
      edges: [
        { key: 'e1', fromNodeKey: 'd1', toNodeKey: 'd2', selector: { type: 'DECISION', condition: lit(true) } },
        { key: 'e1d', fromNodeKey: 'd1', toNodeKey: 'd2', selector: { type: 'DECISION_DEFAULT' } },
        { key: 'e2', fromNodeKey: 'd2', toNodeKey: 'd1', selector: { type: 'DECISION', condition: lit(true) } },
        { key: 'e2d', fromNodeKey: 'd2', toNodeKey: 'd1', selector: { type: 'DECISION_DEFAULT' } },
      ],
      start: { type: 'MANUAL_API', targetNodeKey: 'd1' },
      policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxNodes: 0 } },
    });
    const result = await validateWorkflowDraftForPublication(model, 'global');
    expect(result.status).toBe('FAILED');
    expect(result.issues.some((i) => i.message.includes('cycle'))).toBe(true);
    expect(result.issues.some((i) => i.message.includes('maxNodes'))).toBe(true);
  });

  it('fails a draft that fails canonical AWM shape validation (zod) before any rule runs', async () => {
    const malformed = { ...baseModel(), nodes: 'not-an-array' } as unknown as Parameters<typeof validateWorkflowDraftForPublication>[0];
    const result = await validateWorkflowDraftForPublication(malformed, 'global');
    expect(result.status).toBe('FAILED');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('WF_DEF_INVALID_AWM');
  });

  describe('SUBFLOW validation (doc 05 section 7)', () => {
    it('fails when the SUBFLOW target WorkflowDefinition does not exist in the governed scope', async () => {
      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'SUBFLOW', key: 'sf1', workflowDefinitionRef: { workflowDefinitionKey: uniqueKey('ghost-target') }, input: mappingOf({}) },
        endNode('e1'),
      ];
      const model = baseModel({
        nodes,
        edges: [{ key: 'e1', fromNodeKey: 'sf1', toNodeKey: 'e1', selector: { type: 'UNCONDITIONAL' } }],
        start: { type: 'MANUAL_API', targetNodeKey: 'sf1' },
      });
      const result = await validateWorkflowDraftForPublication(model, 'global');
      expect(result.status).toBe('FAILED');
      expect(result.issues.some((i) => i.code === 'WF_DEF_INVALID_REFERENCE' && i.nodeKey === 'sf1')).toBe(true);
    });

    it('fails when the SUBFLOW target WorkflowDefinition is ARCHIVED', async () => {
      const targetKey = uniqueKey('archived-target');
      const target = await createTestWorkflowDefinition({ key: targetKey, draftDefinitionJson: '{}' });
      await transitionWorkflowDefinitionLifecycle(target.id, target.stateVersion, 'ARCHIVE');

      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'SUBFLOW', key: 'sf1', workflowDefinitionRef: { workflowDefinitionKey: targetKey }, input: mappingOf({}) },
        endNode('e1'),
      ];
      const model = baseModel({
        nodes,
        edges: [{ key: 'e1', fromNodeKey: 'sf1', toNodeKey: 'e1', selector: { type: 'UNCONDITIONAL' } }],
        start: { type: 'MANUAL_API', targetNodeKey: 'sf1' },
      });
      const result = await validateWorkflowDraftForPublication(model, 'global');
      expect(result.status).toBe('FAILED');
      expect(result.issues.some((i) => i.code === 'WF_DEF_INVALID_REFERENCE' && i.message.includes('ARCHIVED'))).toBe(true);
    });

    it('passes when the SUBFLOW target WorkflowDefinition exists and is not archived', async () => {
      const targetKey = uniqueKey('live-target');
      await createTestWorkflowDefinition({ key: targetKey, draftDefinitionJson: '{}' });

      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'SUBFLOW', key: 'sf1', workflowDefinitionRef: { workflowDefinitionKey: targetKey }, input: mappingOf({}) },
        endNode('e1'),
      ];
      const model = baseModel({
        nodes,
        edges: [{ key: 'e1', fromNodeKey: 'sf1', toNodeKey: 'e1', selector: { type: 'UNCONDITIONAL' } }],
        start: { type: 'MANUAL_API', targetNodeKey: 'sf1' },
      });
      const result = await validateWorkflowDraftForPublication(model, 'global');
      expect(result.status).toBe('PASSED');
    });
  });
});

describe.skipIf(!dbReady)('validateWorkflowDraft (draft-preview authoring path, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('creates a validation report bound to the draft (revisionId null), without creating a WorkflowRevision', async () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('preview'), draftDefinitionJson: JSON.stringify(model) });
    const report = await validateWorkflowDraft(definition.id, definition.draftVersion);
    expect(report.status).toBe('PASSED');
    expect(report.revisionId).toBeNull();
    expect(report.draftVersion).toBe(definition.draftVersion);
  });

  it('rejects a stale expectedDraftVersion', async () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('preview-stale'), draftDefinitionJson: JSON.stringify(model) });
    await expect(validateWorkflowDraft(definition.id, definition.draftVersion + 1)).rejects.toMatchObject({ code: 'WF_DEF_STALE_DRAFT_VERSION' });
  });
});
