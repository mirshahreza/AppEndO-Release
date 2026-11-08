import { describe, expect, it } from 'vitest';
import {
  computeUnifiedDiffStats,
  diffDesignerDocuments,
  formatComponentLayoutPatchPreview,
  formatFilePatchPreview,
  formatFunctionSourcePatchPreview,
  formatUnifiedDiffPreview,
  getChangeSetArtifactPreview,
  getChangeSetDisplayLabel,
} from '../changeSetPreview';
import type { DesignerDocument } from '../../../domain/component-designer/types';

const baseDocument = (): DesignerDocument => ({
  schemaVersion: 1,
  name: 'Test',
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'container',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: ['btn'],
    },
    btn: {
      id: 'btn',
      type: 'heroui.button-solid',
      parentId: 'root',
      order: 0,
      props: { text: 'Old' },
      layout: {},
      binding: {},
      children: [],
    },
  },
  diagnostics: [],
});

describe('changeSetPreview', () => {
  it('diffDesignerDocuments reports added, removed, and changed props', () => {
    const before = baseDocument();
    const after = structuredClone(before);
    after.nodes.btn.props = { text: 'New' };
    after.nodes.field = {
      id: 'field',
      type: 'html.text',
      parentId: 'root',
      order: 1,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };
    after.nodes.root.children = ['btn', 'field'];

    const delta = diffDesignerDocuments(before, after);
    expect(delta.added).toEqual([{ id: 'field', type: 'html.text' }]);
    expect(delta.changedProps).toEqual([{ id: 'btn', type: 'heroui.button-solid', keys: ['text'] }]);
  });

  it('formatComponentLayoutPatchPreview uses previousDocument delta when present', () => {
    const before = baseDocument();
    const after = structuredClone(before);
    after.nodes.btn.props = { text: 'Save' };

    const preview = formatComponentLayoutPatchPreview({
      name: 'WF3 Grid',
      folder: 'general',
      baseLayoutId: 'layout-1',
      previousDocument: before,
      document: after,
      bindingDefinitions: {},
    });

    expect(preview).toContain('Based on: layout-1');
    expect(preview).toContain('Changed props');
    expect(preview).toContain('text');
  });

  it('formatFunctionSourcePatchPreview truncates long source', () => {
    const preview = formatFunctionSourcePatchPreview({
      name: 'List Users',
      folder: 'api',
      baseFunctionId: 'users-list',
      source: 'export async function handler() {\n'.repeat(200),
    });

    expect(preview).toContain('Name: List Users');
    expect(preview).toContain('Based on: users-list');
    expect(preview).toContain('chars total');
  });

  it('formatFilePatchPreview renders unified diff when beforeContent is provided', () => {
    const preview = formatFilePatchPreview(
      'src/example.ts',
      'line one\nline two changed\n',
      'line one\nline two\n',
    );

    expect(preview).toContain('Path: src/example.ts');
    expect(preview).toContain('Diff preview:');
    expect(preview).toContain('- line two');
    expect(preview).toContain('+ line two changed');
  });

  it('formatUnifiedDiffPreview marks changed lines', () => {
    const diff = formatUnifiedDiffPreview('a\nb\n', 'a\nc\n');
    expect(diff).toContain('- b');
    expect(diff).toContain('+ c');
  });

  it('computeUnifiedDiffStats counts insertions and deletions', () => {
    const stats = computeUnifiedDiffStats('a\nb', 'a\nc');
    expect(stats.deletions).toBe(1);
    expect(stats.insertions).toBe(1);
    expect(stats.unchanged).toBe(1);
  });

  it('getChangeSetArtifactPreview returns per-file stats for file_patch', () => {
    const preview = getChangeSetArtifactPreview({
      id: 'cs-file',
      kind: 'file_patch',
      title: 'Patch',
      path: 'src/example.ts',
      beforeContent: 'const x = 1;\n',
      content: 'const x = 2;\n',
    });
    expect(preview.stats.insertions).toBeGreaterThan(0);
    expect(preview.lines.some((line) => line.kind === 'remove')).toBe(true);
    expect(preview.lines.some((line) => line.kind === 'add')).toBe(true);
  });

  it('getChangeSetDisplayLabel returns file-like labels', () => {
    expect(getChangeSetDisplayLabel({
      id: 'cs-file',
      kind: 'file_patch',
      title: 'Patch',
      path: 'src/example.ts',
      content: '',
    })).toBe('src/example.ts');

    expect(getChangeSetDisplayLabel({
      id: 'cs-fn',
      kind: 'function_source_patch',
      title: 'Fn',
      functionId: 'math.sum-two-numbers',
      patch: { name: 'sum-two-numbers', folder: 'math', source: '' },
    })).toBe('workspace/server-functions/custom/math.sum-two-numbers.ts');

    expect(getChangeSetDisplayLabel({
      id: 'cs-layout',
      kind: 'component_layout_patch',
      title: 'Layout',
      layoutId: 'users-form',
      patch: { name: 'Users Form', folder: 'crm', document: baseDocument() },
    })).toBe('workspace/designer/drafts/crm/Users Form.json');
  });
});
