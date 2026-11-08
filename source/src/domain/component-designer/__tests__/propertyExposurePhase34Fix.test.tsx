/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit phase 34): Property Exposure — heading level, tabs/breadcrumbs items,
 * slider range, button/chip/dropdown icon fields were missing from Inspector/catalog/render paths.
 * Fixed in catalog.ts, inspectorPaletteFields.ts, tsxComponentRegistry.ts, designerRuntimePreview.tsx,
 * runtimeRenderer.tsx, DesignerRuntimeParityPalette.tsx, DesignerRuntimeDropdown.tsx,
 * tsxNodeRenderer.ts, tsxParityPalette.ts, jsxReverseParser.ts, codegen.ts, runtimeShared.ts.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

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

const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState =>
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value });

afterEach(cleanup);

// ---------------------------------------------------------------------------
// 34.1 — html.heading level
// ---------------------------------------------------------------------------
describe('34.1 — html.heading level', () => {
  it('renders <h2> by default (backward compatible)', () => {
    let state = insertItem(createInitialDesignerState(), 'html.heading');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('h2')).toBeTruthy();
  });

  it('renders <h1> when level is set to h1 (preview)', () => {
    let state = insertItem(createInitialDesignerState(), 'html.heading');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'level', 'h1');
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('h1')).toBeTruthy();
    expect(container.querySelector('h2')).toBeFalsy();
  });

  it('renders <h4> when level is set to h4 (preview)', () => {
    let state = insertItem(createInitialDesignerState(), 'html.heading');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'level', 'h4');
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('h4')).toBeTruthy();
  });

  it('exports <h3> when level is h3 (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'html.heading');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'level', 'h3');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<h3');
    expect(tsx).not.toContain('<h2');
  });

  it('exports <h2> by default when no level set (codegen)', () => {
    const state = insertItem(createInitialDesignerState(), 'html.heading');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<h2');
  });

  it('level field does not leak as an HTML attribute in export', () => {
    let state = insertItem(createInitialDesignerState(), 'html.heading');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'level', 'h5');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<h5');
    expect(tsx).not.toMatch(/level="h5"/);
  });
});

// ---------------------------------------------------------------------------
// 34.2 — heroui.tabs items
// ---------------------------------------------------------------------------
describe('34.2 — heroui.tabs items', () => {
  it('default props include two tab items', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.tabs');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[nodeId];
    expect(Array.isArray(node.props.items)).toBe(true);
    expect(node.props.items).toEqual([
      { key: 'tab-0', label: 'Tab 1' },
      { key: 'tab-1', label: 'Tab 2' },
    ]);
    expect(node.children.length).toBe(2);
  });

  it('exports tabs with custom labels from items (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tabs');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'items', [
      { key: 'overview', label: 'Overview' },
      { key: 'settings', label: 'Settings' },
    ]);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Overview');
    expect(tsx).toContain('Settings');
    expect(tsx).toContain("id: \"overview\"");
    expect(tsx).toContain("id: \"settings\"");
    expect(tsx).toContain('<UiTabs');
  });
});

// ---------------------------------------------------------------------------
// 34.3 — heroui.breadcrumbs items
// ---------------------------------------------------------------------------
describe('34.3 — heroui.breadcrumbs items', () => {
  it('default props include items array', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.breadcrumbs');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[nodeId];
    expect(Array.isArray(node.props.items)).toBe(true);
  });

  it('exports breadcrumbs with custom labels from items (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.breadcrumbs');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'items', [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Users', href: '/users' },
      { label: 'Edit', isCurrent: true },
    ]);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Dashboard');
    expect(tsx).toContain('Users');
    expect(tsx).toContain('Edit');
    expect(tsx).toContain('/dashboard');
  });
});

// ---------------------------------------------------------------------------
// 34.4 — heroui.slider range mode
// ---------------------------------------------------------------------------
describe('34.4 — heroui.slider range mode', () => {
  it('renders single-thumb by default (backward compatible codegen)', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const thumbCount = (tsx.match(/Slider\.Thumb/g) ?? []).length;
    expect(thumbCount).toBe(1);
  });

  it('renders two thumbs in range mode (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'sliderMode', 'range');
    state = setProp(state, nodeId, 'minValue', 10);
    state = setProp(state, nodeId, 'maxValue', 90);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const thumbCount = (tsx.match(/Slider\.Thumb/g) ?? []).length;
    expect(thumbCount).toBe(2);
  });

  it('emits showTooltip when enabled (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'showTooltip', true);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('showTooltip');
  });

  it('sliderMode prop does not leak as JSX attribute', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.slider');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'sliderMode', 'range');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).not.toMatch(/sliderMode="range"/);
  });
});

// ---------------------------------------------------------------------------
// 34.5 — startIcon/endIcon on button/chip/dropdown
// ---------------------------------------------------------------------------
describe('34.5 — startIcon/endIcon on button/chip/dropdown', () => {
  it('button exports startContent with lucide icon (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'startIcon', 'Plus');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('startContent={<Plus');
    expect(tsx).toContain("import { Plus } from 'lucide-react'");
  });

  it('button exports endContent with lucide icon (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'endIcon', 'ArrowRight');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('endContent={<ArrowRight');
    expect(tsx).toContain("import { ArrowRight } from 'lucide-react'");
  });

  it('button with isIconOnly renders icon as children (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'startIcon', 'Trash2');
    state = setProp(state, nodeId, 'isIconOnly', true);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('isIconOnly');
    expect(tsx).toContain('<Trash2 className="h-3.5 w-3.5" />');
  });

  it('chip exports startContent/endContent with icons (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.chip');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'startIcon', 'Star');
    state = setProp(state, nodeId, 'endIcon', 'X');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('startContent={<Star');
    expect(tsx).toContain('endContent={<X');
  });

  it('dropdown exports icons in trigger (codegen)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = setProp(state, nodeId, 'startIcon', 'Settings');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Settings className="h-3.5 w-3.5" />');
  });

  it('button without icons renders normally (backward compatible)', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).not.toContain('startContent');
    expect(tsx).not.toContain('endContent');
    expect(tsx).not.toContain('lucide-react');
  });
});
