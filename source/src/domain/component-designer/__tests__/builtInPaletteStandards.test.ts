import { describe, expect, it } from 'vitest';
import {
  hasExplicitHeightConstraint,
  isBuiltInStructuralPaletteItemId,
  resolveDesignerEmptyStructuralShellClass,
} from '../builtInPaletteStandards';
import { createInitialDesignerState, designerReducer } from '../state';

describe('builtInPaletteStandards', () => {
  it('detects built-in structural palette ids', () => {
    expect(isBuiltInStructuralPaletteItemId('html.container')).toBe(true);
    expect(isBuiltInStructuralPaletteItemId('layout.flex-row')).toBe(true);
    expect(isBuiltInStructuralPaletteItemId('tailwind.card')).toBe(true);
    expect(isBuiltInStructuralPaletteItemId('heroui.card')).toBe(false);
  });

  it('detects explicit height constraints from className and inline style', () => {
    expect(hasExplicitHeightConstraint('flex flex-row gap-3')).toBe(false);
    expect(hasExplicitHeightConstraint('min-h-6 w-full')).toBe(true);
    expect(hasExplicitHeightConstraint('h-screen w-64')).toBe(true);
    expect(hasExplicitHeightConstraint('w-full', { minHeight: '240px' })).toBe(true);
  });

  it('does not add design shell chrome for empty layout blocks', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'layout.flex-row',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = next.document.nodes[next.document.rootNodeId].children[0];
    const node = next.document.nodes[nodeId];

    expect(resolveDesignerEmptyStructuralShellClass(node, { isEmpty: true })).toBeNull();
  });

  it('does not add min-height shell when the container already has a border utility', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.section',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = next.document.nodes[next.document.rootNodeId].children[0];
    const node = next.document.nodes[nodeId];

    expect(resolveDesignerEmptyStructuralShellClass(node, { isEmpty: true })).toBeNull();
  });

  it('skips shell when height is already defined', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = next.document.nodes[next.document.rootNodeId].children[0];
    const node = next.document.nodes[nodeId];

    expect(resolveDesignerEmptyStructuralShellClass(node, { isEmpty: true })).toBeNull();
  });
});
