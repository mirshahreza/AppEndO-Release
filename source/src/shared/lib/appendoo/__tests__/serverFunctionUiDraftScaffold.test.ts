import { describe, expect, it } from 'vitest';
import type { ChangeNode } from '../../../api/contracts/appendoo/changeGraph.types';
import {
  buildServerFunctionUiDesignerDraft,
  extractBoundFunctionIdFromChangeNode,
  resolveServerFunctionApiPath,
  tryBuildServerFunctionUiDraftFromChangeNode,
  extractFunctionIdFromWorkspaceDraftJson,
} from '../serverFunctionUiDraftScaffold';

const sampleCreatePageNode = (evidenceIds: string[]): ChangeNode => ({
  nodeId: 'node:page:math-sum-two-numbers-ui',
  operationId: 'op:test:1',
  changeSetId: 'cs:test',
  operationType: 'CREATE_PAGE',
  targetRef: {
    targetKind: 'page',
    targetId: 'math-sum-two-numbers-ui',
    ref: 'math-sum-two-numbers-ui',
  },
  inputs: { evidenceIds },
  expectedOutputs: ['UI for sum-two-numbers'],
  dependencies: [],
  requiredCapabilityIds: ['capability:appendo-designer'],
  workspaceMutationScope: ['appendoo/ws/cs:test/**'],
  state: 'PLANNED',
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
});

describe('serverFunctionUiDraftScaffold', () => {
  it('resolves API path from dotted function id', () => {
    expect(resolveServerFunctionApiPath('math.sum-two-numbers')).toBe('/api/math/sum-two-numbers');
  });

  it('builds a designer draft with form, inputs, and submit button', () => {
    const draft = buildServerFunctionUiDesignerDraft('math.sum-two-numbers');
    expect(draft.schema).toBe('component-designer-draft');
    expect(draft.id).toBe('math-sum-two-numbers-calculator');
    expect(draft.name).toBe('UI for sum-two-numbers');
    expect(draft.folder).toBe('math');
    expect(draft.boundFunctionId).toBe('math.sum-two-numbers');

    const nodes = Object.values(draft.document.nodes);
    const paletteIds = nodes.map((node) => node.props._designerPaletteItemId);
    expect(paletteIds).toContain('html.form');
    expect(paletteIds).toContain('heroui.number-input');
    expect(paletteIds).toContain('heroui.button-solid');

    const dataSources = draft.bindingDefinitions.dataSources ?? {};
    const dataSource = dataSources['math-sum-two-numbers'];
    expect(dataSource?.operations?.create?.endpoint).toBe('/api/math/sum-two-numbers');
    expect(dataSource?.primaryKey).toBeUndefined();
    expect(dataSource?.kind).toBe('collection');
  });

  it('extracts function id from change node evidence', () => {
    const node = sampleCreatePageNode(['target:function:math.sum-two-numbers', 'function:math.sum-two-numbers']);
    expect(extractBoundFunctionIdFromChangeNode(node)).toBe('math.sum-two-numbers');
    expect(tryBuildServerFunctionUiDraftFromChangeNode(node)?.document.nodes).toBeTruthy();
  });

  it('resolves function id from workspace draft json and storage path', () => {
    const fullDraft = buildServerFunctionUiDesignerDraft('math.sum-two-numbers');
    expect(extractFunctionIdFromWorkspaceDraftJson(JSON.stringify(fullDraft))).toBe('math.sum-two-numbers');
    expect(extractFunctionIdFromWorkspaceDraftJson('{}', {
      workspacePath: 'appendoo/ws/cs-test/workspace/designer/drafts/math-sum-two-numbers-calculator/draft.json',
    })).toBe('math.sum-two-numbers');
  });
});
