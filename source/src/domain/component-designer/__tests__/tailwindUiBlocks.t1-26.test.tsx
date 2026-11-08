/**
 * @vitest-environment jsdom
 * Phase T1-26 — Tailwind UI Blocks audit regression tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { getPaletteItemById } from '../catalog';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { PRESET_WIDGET_PARITY_CHECKLIST } from '../toolboxInventory';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import { getTemplateForPreset } from '../../../domain/component-designer/layout-presets/newLayoutPresets';
import type { TemplateNodeSeed } from '../types';

const TAILWIND_BLOCK_IDS = [
  'tailwind.card',
  'tailwind.card-glass',
  'tailwind.hero',
  'tailwind.badge-pill',
  'tailwind.alert',
  'tailwind.stat-block',
  'tailwind.pricing',
  'tailwind.image-overlay',
] as const;

const DEFAULT_CLASS_SNIPPETS: Record<(typeof TAILWIND_BLOCK_IDS)[number], string> = {
  'tailwind.card': 'rounded-xl',
  'tailwind.card-glass': 'backdrop-blur',
  'tailwind.hero': 'bg-gradient-to-r',
  'tailwind.badge-pill': 'rounded-full',
  'tailwind.alert': 'w-full',
  'tailwind.stat-block': 'shadow-sm',
  'tailwind.pricing': 'shadow-sm',
  'tailwind.image-overlay': 'relative overflow-hidden',
};

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

const collectPaletteIdsFromSeeds = (seed: TemplateNodeSeed): string[] => [
  seed.paletteItemId ?? '',
  ...(seed.children ?? []).flatMap((child) => collectPaletteIdsFromSeeds(child)),
];

const findNodeByPaletteItemId = (
  state: DesignerState,
  paletteItemId: string,
): string | undefined =>
  Object.values(state.document.nodes).find(
    (node) => node.props._designerPaletteItemId === paletteItemId,
  )?.id;

describe('T1-26 Tailwind UI Blocks audit', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(TAILWIND_BLOCK_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(TAILWIND_BLOCK_IDS)('exports TSX for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
  });

  it.each(TAILWIND_BLOCK_IDS)('has no matrix binding obligations for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.bindingStatus).toBe('none');
    expect(row?.supportedCapabilities).toEqual([]);
  });

  it.each(TAILWIND_BLOCK_IDS)(
    'applies default className for %s in canvas preview',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const className = String(state.document.nodes[nodeId].props.className ?? '');
      expect(className).toContain(DEFAULT_CLASS_SNIPPETS[itemId]);

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      const snippet = DEFAULT_CLASS_SNIPPETS[itemId].split(' ')[0] ?? '';
      const match = container.querySelector(`[class*="${snippet}"]`);
      expect(match).toBeTruthy();
    },
  );

  it('reflects tailwind.card className change in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'tailwind.card');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: 'rounded-2xl border-2 border-cyan-400 bg-cyan-50 p-6',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const card = container.querySelector('.border-cyan-400');
    expect(card).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('border-cyan-400');
  });

  it('reflects tailwind.badge-pill text in canvas preview and export as span', () => {
    let state = insertItem(createInitialDesignerState(), 'tailwind.badge-pill');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'text',
      value: 'Beta Access',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    const badge = container.querySelector('span.rounded-full');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Beta Access');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<span');
    expect(tsx).toContain('Beta Access');
  });

  it('renders tailwind.hero with nested children without overlap breakage', () => {
    let state = insertItem(createInitialDesignerState(), 'tailwind.hero');
    const heroId = lastChildId(state, state.document.rootNodeId);

    state = insertItem(state, 'html.heading', heroId);
    const headingId = lastChildId(state, heroId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: headingId,
      key: 'text',
      value: 'Ship faster with confidence',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Ship faster with confidence');
    const hero = container.querySelector('.bg-gradient-to-r');
    expect(hero?.textContent).toContain('Ship faster with confidence');
  });

  it('tags tailwind.image-overlay as container (not overlay-nav)', () => {
    const item = getPaletteItemById('tailwind.image-overlay');
    expect(item?.capabilities).toEqual(['container']);
    expect(item?.nodeClass).toBe('container');
  });

  it('exposes content inspector fields for tailwind blocks (badge-pill text + semantic block props)', () => {
    for (const itemId of TAILWIND_BLOCK_IDS) {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const keys = resolveInspectorFieldSections(state.document.nodes[nodeId]).flatMap(
        (section) => section.fields.map((field) => field.key),
      );

      if (itemId === 'tailwind.badge-pill') {
        expect(keys).toContain('text');
      } else if (itemId === 'tailwind.stat-block') {
        expect(keys).toEqual(expect.arrayContaining(['label', 'value']));
      } else if (itemId === 'tailwind.pricing') {
        expect(keys).toEqual(expect.arrayContaining(['planName', 'price']));
      } else if (itemId === 'tailwind.alert') {
        expect(keys).toEqual(expect.arrayContaining(['title', 'message']));
      } else if (itemId === 'tailwind.hero') {
        expect(keys).toEqual(expect.arrayContaining(['heading', 'primaryCta']));
      } else if (itemId === 'tailwind.image-overlay') {
        expect(keys).toEqual(expect.arrayContaining(['imageSrc', 'overlayText']));
      } else if (itemId === 'tailwind.card' || itemId === 'tailwind.card-glass') {
        expect(keys).toEqual(expect.arrayContaining(['title', 'description']));
      }
    }
  });
});

describe('T1-26 preset ↔ widget parity (tailwind blocks stay separate)', () => {
  it('maps pricing-tier-featured preset to marketing.pricing-table widget', () => {
    expect(PRESET_WIDGET_PARITY_CHECKLIST.find((entry) => entry.presetId === 'pricing-tier-featured')).toEqual({
      presetId: 'pricing-tier-featured',
      widgetId: 'marketing.pricing-table',
    });
  });

  it('keeps tailwind.pricing inside pricing-tier-featured preset seeds (not merged into widget)', () => {
    const seeds = getTemplateForPreset('pricing-tier-featured');
    expect(seeds.length).toBeGreaterThan(0);
    const paletteIds = collectPaletteIdsFromSeeds(seeds[0]!);
    expect(paletteIds).toContain('tailwind.pricing');
    expect(paletteIds).not.toContain('marketing.pricing-table');
  });

  it('renders pricing-tier-featured preset with tailwind.pricing block in canvas', () => {
    const seeds = getTemplateForPreset('pricing-tier-featured');
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-built-in-template',
      templateRoots: seeds,
      parentId: state.document.rootNodeId,
    });

    expect(findNodeByPaletteItemId(state, 'tailwind.pricing')).toBeTruthy();
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Pro Plan');
  });

  it('coexists tailwind.pricing block with marketing.pricing-table widget in one document', () => {
    let state = insertItem(createInitialDesignerState(), 'tailwind.pricing');
    state = insertItem(state, 'marketing.pricing-table');

    expect(findNodeByPaletteItemId(state, 'tailwind.pricing')).toBeTruthy();
    expect(findNodeByPaletteItemId(state, 'marketing.pricing-table')).toBeTruthy();
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it('maps dashboard-kpi preset to content.stat-trend widget (separate from tailwind.stat-block)', () => {
    expect(PRESET_WIDGET_PARITY_CHECKLIST.find((entry) => entry.presetId === 'dashboard-kpi')).toEqual({
      presetId: 'dashboard-kpi',
      widgetId: 'content.stat-trend',
    });

    const seeds = getTemplateForPreset('dashboard-kpi');
    const paletteIds = collectPaletteIdsFromSeeds(seeds[0]!);
    expect(paletteIds).not.toContain('tailwind.stat-block');
    // Phase 22: dashboard-kpi aliases kpi-metrics-grid (real content.stat-trend cards).
    expect(paletteIds).toContain('content.stat-trend');
  });

  it('keeps hero-cta preset as editable layout parts, not marketing.hero-cta or tailwind.hero', () => {
    expect(PRESET_WIDGET_PARITY_CHECKLIST.find((entry) => entry.presetId === 'hero-cta')).toEqual({
      presetId: 'hero-cta',
      widgetId: 'marketing.hero-cta',
    });

    const seeds = getTemplateForPreset('hero-cta');
    const paletteIds = collectPaletteIdsFromSeeds(seeds[0]!);
    expect(paletteIds).not.toContain('marketing.hero-cta');
    expect(paletteIds).not.toContain('tailwind.hero');
    expect(paletteIds).toContain('html.heading');
    expect(paletteIds).toContain('heroui.button-solid');
  });
});
