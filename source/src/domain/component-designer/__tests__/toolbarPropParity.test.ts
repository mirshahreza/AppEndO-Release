import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { resolveRuntimeComponentProps } from '../runtimeNodeProps';
import { createInitialDesignerState, designerReducer } from '../state';
import { resolveTsxComponentSpec } from '../tsxComponentRegistry';
import { buildNodeJsxAttributes } from '../tsxPropMapper';
import type { DesignerNode } from '../types';

const insertToolbarWithProps = (): { nodeId: string; node: DesignerNode; state: ReturnType<typeof createInitialDesignerState> } => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'heroui.toolbar',
    parentId: state.document.rootNodeId,
  });
  const nodeId = state.document.nodes[state.document.rootNodeId].children[0];

  for (const [key, value] of [
    ['size', 'sm'],
    ['dataTestId', 'main-toolbar'],
    ['htmlExtraAttrs', '{"data-toolbar-role":"primary","aria-orientation":"horizontal"}'],
    ['text', 'should-not-passthrough'],
    ['ariaLabel', 'Editor toolbar'],
  ] as const) {
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key, value });
  }

  return { nodeId, node: state.document.nodes[nodeId], state };
};

/** Attribute names present in a codegen attribute string (e.g. ` size="sm" data-testid="x"`). */
const attributeNamesFromJsxAttrs = (attrs: string): Set<string> => {
  const names = new Set<string>();
  for (const match of attrs.matchAll(/\s([A-Za-z_:][\w:.-]*)(?:=|\s|$)/g)) {
    names.add(match[1]);
  }
  return names;
};

describe('heroui.toolbar preview/export prop parity (T1-4)', () => {
  it('preview libraryPassthrough and export renderAttrs agree on size, aria-label, data-testid, and htmlExtraAttrs', () => {
    const { node } = insertToolbarWithProps();
    const spec = resolveTsxComponentSpec(node);

    // Mirror runtimeRenderer heroui.toolbar: exclude childrenPropKeys text.
    const previewProps = resolveRuntimeComponentProps(node, {
      libraryComponent: true,
      excludeKeys: new Set(['text']),
    });

    // Mirror tsxNodeRenderer heroui.toolbar: renderAttrs(..., baseAttrOptions).
    const exportAttrs = buildNodeJsxAttributes(node, {
      childrenPropKeys: spec.childrenPropKeys,
      structuralPropKeys: spec.structuralPropKeys,
    });
    const exportAttrNames = attributeNamesFromJsxAttrs(exportAttrs);

    expect(previewProps.size).toBe('sm');
    expect(previewProps['aria-label']).toBe('Editor toolbar');
    expect(previewProps['data-testid']).toBe('main-toolbar');
    expect(previewProps['data-toolbar-role']).toBe('primary');
    expect(previewProps['aria-orientation']).toBe('horizontal');
    expect(previewProps.text).toBeUndefined();

    expect(exportAttrs).toContain('size="sm"');
    expect(exportAttrs).toContain('aria-label="Editor toolbar"');
    expect(exportAttrs).toContain('data-testid="main-toolbar"');
    expect(exportAttrs).toContain('data-toolbar-role="primary"');
    expect(exportAttrs).toContain('aria-orientation="horizontal"');
    expect(exportAttrs).not.toContain('should-not-passthrough');
    expect(exportAttrNames.has('text')).toBe(false);

    for (const key of ['size', 'aria-label', 'data-testid', 'data-toolbar-role', 'aria-orientation'] as const) {
      expect(exportAttrNames.has(key), `export missing ${key}`).toBe(true);
      expect(key in previewProps, `preview missing ${key}`).toBe(true);
    }
  });

  it('generated Toolbar TSX includes the same special-merge attrs as preview', () => {
    const { state } = insertToolbarWithProps();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('<Toolbar');
    expect(tsx).toContain('data-testid="main-toolbar"');
    expect(tsx).toContain('data-toolbar-role="primary"');
    expect(tsx).toContain('aria-orientation="horizontal"');
    expect(tsx).toContain('aria-label="Editor toolbar"');
    expect(tsx).toContain('size="sm"');
  });
});
