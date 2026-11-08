/**
 * @vitest-environment jsdom
 * Phase T1-21 — Layout palette audit regression tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS } from '../paletteCapabilities';
import { applyTailwindUtility } from '../tailwindClasses';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const LAYOUT_ITEM_IDS = [
  'layout.flex-row',
  'layout.flex-column',
  'layout.grid-2',
  'layout.grid-3',
  'layout.columns',
  'layout.stack-compact',
  'layout.stack-relaxed',
  'layout.center',
  'layout.wrapper',
  'layout.scroll',
  'layout.sticky-bar',
  'layout.dock-pane',
  'layout.split-pane',
  'layout.separator',
  'layout.spacer',
  'layout.aspect-ratio',
  'layout.sticky',
  'layout.overlay',
] as const;

const NOISY_STRUCTURAL_IDS = ['layout.aspect-ratio', 'layout.overlay'] as const;

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

const collectInspectorFieldKeys = (state: DesignerState, nodeId: string): string[] => {
  const node = state.document.nodes[nodeId];
  return resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
};

describe('T1-21 layout palette audit', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(LAYOUT_ITEM_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(LAYOUT_ITEM_IDS)('exports TSX for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
  });

  it.each(LAYOUT_ITEM_IDS)('has no matrix binding obligations for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.bindingStatus).toBe('none');
    expect(row?.supportedCapabilities).toEqual([]);
  });

  it.each(NOISY_STRUCTURAL_IDS)(
    'hides unrelated container Layout inspector fields for %s (doc 03 noise fix)',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const keys = collectInspectorFieldKeys(state, nodeId);

      for (const layoutKey of INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS) {
        expect(keys, `${itemId} should not expose ${layoutKey}`).not.toContain(layoutKey);
      }
    },
  );

  it('reflects layout.flex-row gap utility change in canvas className', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.flex-row');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[nodeId];
    const gapField = { key: 'twGap', label: 'Gap', type: 'spacing' as const, group: 'tailwind' as const, utilityPrefix: 'gap', conflictPattern: /^gap-/ };

    const updatedClassName = applyTailwindUtility(String(node.props.className), gapField, 'gap-8');
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: updatedClassName,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const flexRow = container.querySelector('.flex.flex-row');
    expect(flexRow?.className).toContain('gap-8');
    expect(flexRow?.className).not.toContain('gap-3');
  });

  /**
   * T1-7 close-out (cluster G) spot-check: layout.stack-compact / layout.stack-relaxed were
   * flagged `inspector:false` by the old detector, which only recognized membership in the
   * dedicated field-map dictionaries. Both items get the FULL generic Tailwind field set
   * (they have no entry in PALETTE_TAILWIND_FIELD_KEY_MAP, so `resolveTailwindInspectorFields`
   * falls back to every TAILWIND_INSPECTOR_FIELDS entry — see inspectorRegistry.ts) — this
   * is the same generic mechanism proven live above for layout.flex-row's gap utility;
   * re-verified directly here rather than assumed by extrapolation.
   */
  it.each(['layout.stack-compact', 'layout.stack-relaxed'] as const)(
    'reflects a generic Tailwind className edit for %s live in canvas preview and export TSX',
    (itemId) => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const existingClassName = String(state.document.nodes[nodeId].props.className ?? '');

      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'className',
        value: `${existingClassName} border-4 border-fuchsia-500`.trim(),
      });

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      expect(container.querySelector('.border-fuchsia-500'), `${itemId} preview should reflect the className edit`).toBeTruthy();

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx, `${itemId} export TSX should contain the className edit`).toContain('border-fuchsia-500');
    },
  );

  it('reflects layout.aspect-ratio ratio in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.aspect-ratio');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'ratio',
      value: '4/3',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const ratioBox = container.querySelector('[style*="aspect-ratio"]') as HTMLElement | null;
    expect(ratioBox?.style.aspectRatio).toBe('4 / 3');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalAspectRatio');
    expect(tsx).toContain('ratio="4/3"');
  });

  it('reflects layout.overlay overlayLabel in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.overlay');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'overlayLabel',
      value: 'Hover preview',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Hover preview');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalOverlayContainer');
    expect(tsx).toContain('overlayLabel="Hover preview"');
  });

  it('reflects layout.separator vertical orientation in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.separator');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'orientation',
      value: 'vertical',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const separator = container.querySelector('[role="separator"]');
    expect(separator?.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('reflects layout.spacer horizontal axis size in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.spacer');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'axis',
      value: 'horizontal',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'size',
      value: 48,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const spacer = container.querySelector('[aria-hidden="true"]') as HTMLElement | null;
    expect(spacer?.style.width).toBe('48px');
    expect(spacer?.style.height).toBe('1px');
  });

  it('reflects layout.split-pane vertical direction in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.split-pane');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'direction',
      value: 'vertical',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const splitPane = container.querySelector('[data-designer-component="layout.split-pane"]');
    expect(splitPane?.getAttribute('data-split-direction')).toBe('vertical');
    expect(splitPane?.getAttribute('data-split-pane-count')).toBe('2');
    expect(splitPane?.className).toContain('flex-col');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('data-split-direction="vertical"');
  });

  it('inserts layout.columns with two column slot children', () => {
    const state = insertItem(createInitialDesignerState(), 'layout.columns');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[nodeId];

    expect(node.children).toHaveLength(2);
    for (const childId of node.children) {
      expect(state.document.nodes[childId].type).toBe('container');
    }
  });

  it('exposes only scoped inspector fields for layout.aspect-ratio', () => {
    const state = insertItem(createInitialDesignerState(), 'layout.aspect-ratio');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const keys = collectInspectorFieldKeys(state, nodeId);

    expect(keys).toContain('ratio');
    expect(keys).not.toContain('offset');
    expect(keys).not.toContain('overlayLabel');
  });

  it('exposes only scoped inspector fields for layout.overlay', () => {
    const state = insertItem(createInitialDesignerState(), 'layout.overlay');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const keys = collectInspectorFieldKeys(state, nodeId);

    expect(keys).toContain('overlayLabel');
    expect(keys).not.toContain('ratio');
    expect(keys).not.toContain('offset');
  });

  it('reflects layout.sticky offset inspector value as top style in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.sticky');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'offset',
      value: 64,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const stickyDiv = container.querySelector('.sticky') as HTMLElement | null;
    expect(stickyDiv?.style.top).toBe('64px');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalStickyContainer');
    expect(tsx).toContain('offset={64}');
  });

  it('reflects layout.grid-2 custom column widths as gridTemplateColumns in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.grid-2');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'layoutGridColumnWidths',
      value: JSON.stringify([
        { value: '200', unit: 'px' },
        { value: '1', unit: 'fr' },
      ]),
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const grid = container.querySelector('.grid') as HTMLElement | null;
    expect(grid?.style.gridTemplateColumns).toBe('200px 1fr');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('gridTemplateColumns');
    expect(tsx).toContain('200px 1fr');
  });

  it('reflects layout.grid-3 direction toggle to column in canvas preview', () => {
    let state = insertItem(createInitialDesignerState(), 'layout.grid-3');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'layoutGridDirection',
      value: 'column',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const stacked = container.querySelector('.flex.flex-col');
    expect(stacked).toBeTruthy();
    expect(container.querySelector('.grid')).toBeFalsy();
  });

  it('paints a dropped dock pane as a left rail instead of a full-width top bar', () => {
    const state = insertItem(createInitialDesignerState(), 'layout.dock-pane');
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const painted = container.querySelector('[data-designer-component="layout.dock-pane"]');
    expect(painted?.getAttribute('data-dock')).toBe('left');
    expect(painted?.className).toContain('w-64');
    expect(painted?.className).toContain('h-full');
    expect(painted?.className.split(/\s+/)).not.toContain('w-full');
  });
});
