import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { renderBindingApiRuntimeHelpers } from '../bindingApiCodegen';
import { transformApiRowsToTreeNodes } from '../visualizationDataTransform';

/**
 * Bug found (parity audit item 99): Export's inlined `transformApiRowsToTreeNodes`
 * (bindingApiCodegen.ts) invented fallback ids for empty idField rows in hierarchical
 * mode (`parentIdField` set), so incomplete API rows collided on `id=""` while Preview's
 * canonical transform (visualizationDataTransform.ts) skipped those rows entirely.
 * Fixed in bindingApiCodegen.ts: hierarchical branch now skips empty ids (flat mode still
 * keeps the synthetic-id fallback — intentional).
 */

type TreeNode = { id: string; label: string; children?: TreeNode[] };

const loadExportTreeHelper = (): ((
  rows: Array<Record<string, unknown>>,
  mapping: { kind: 'tree'; idField: string; labelField: string; parentIdField?: string },
) => TreeNode[]) => {
  const jsSource = transformSync(renderBindingApiRuntimeHelpers().join('\n'), { loader: 'ts' }).code;
  // eslint-disable-next-line no-new-func
  const module = new Function(`${jsSource}\nreturn { transformApiRowsToTreeNodes };`)();
  return module.transformApiRowsToTreeNodes;
};

const collectIds = (nodes: TreeNode[]): string[] => {
  const ids: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      ids.push(node.id);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids.sort();
};

describe('viz tree empty idField export/preview parity (parity audit item 99)', () => {
  const hierarchicalMapping = {
    kind: 'tree' as const,
    idField: 'id',
    labelField: 'label',
    parentIdField: 'parentId',
  };

  const rowsWithGaps: Array<Record<string, unknown>> = [
    { id: 'root', label: 'Root', parentId: '' },
    { id: '', label: 'Broken empty string', parentId: 'root' },
    { id: null, label: 'Broken null', parentId: 'root' },
    { label: 'Broken missing id', parentId: 'root' },
    { id: 'child', label: 'Child', parentId: 'root' },
    { id: '', label: 'Second empty collision', parentId: '' },
  ];

  it('Export hierarchical helper skips empty idField rows (behavioral, not just textual)', () => {
    const exportTransform = loadExportTreeHelper();
    const nodes = exportTransform(rowsWithGaps, hierarchicalMapping);

    expect(collectIds(nodes)).toEqual(['child', 'root']);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe('root');
    expect(nodes[0]?.children?.map((child) => child.id)).toEqual(['child']);
  });

  it('Export hierarchical helper matches Preview canonical on the same incomplete rows', () => {
    const exportTransform = loadExportTreeHelper();
    const exportNodes = exportTransform(rowsWithGaps, hierarchicalMapping);
    const previewNodes = transformApiRowsToTreeNodes(rowsWithGaps, hierarchicalMapping);

    expect(collectIds(exportNodes)).toEqual(collectIds(previewNodes));
    expect(exportNodes[0]?.id).toBe(previewNodes[0]?.id);
    expect(exportNodes[0]?.children?.map((child) => child.id))
      .toEqual(previewNodes[0]?.children?.map((child) => child.id));
  });

  it('flat mode (no parentIdField) still invents synthetic ids for null/missing id — intentional; empty string stays empty in both paths', () => {
    const exportTransform = loadExportTreeHelper();
    const flatMapping = { kind: 'tree' as const, idField: 'id', labelField: 'label' };
    // readVizStringField / readStringField only fall back for null/undefined — not "".
    const flatRows = [
      { id: '', label: 'A' },
      { id: null, label: 'B' },
      { label: 'C' },
    ];

    const exportNodes = exportTransform(flatRows, flatMapping);
    const previewNodes = transformApiRowsToTreeNodes(flatRows, flatMapping);

    expect(exportNodes.map((node) => node.id)).toEqual(['', 'node-2', 'node-3']);
    expect(previewNodes.map((node) => node.id)).toEqual(['', 'node-2', 'node-3']);
  });

  it('inlined helper source contains the empty-id guard in the hierarchical branch', () => {
    const source = renderBindingApiRuntimeHelpers().join('\n');
    expect(source).toContain('if (!id) return;');
    expect(source).toMatch(/const id = readVizStringField\(row, mapping\.idField\);\s*\n\s*if \(!id\) return;/);
  });
});
