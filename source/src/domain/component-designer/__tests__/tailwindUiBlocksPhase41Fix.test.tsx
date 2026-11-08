/**
 * Bug found (gap-analysis §14 row #19 / phase 41): Tailwind UI Blocks (except badge-pill) were empty
 * containers with only className — no semantic content props in catalog, Inspector, Preview, or Export.
 * Fixed in catalog.ts, inspectorPaletteFields.ts, tailwindUiBlocksRuntime.tsx, tailwindUiBlocksExport.ts,
 * designerRuntimePreview.tsx, canvasNodes.tsx, tsxNodeRenderer.ts, tsxComponentRegistry.ts.
 */
/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getPaletteItemById } from '../catalog';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';

const TAILWIND_CONTENT_BLOCK_IDS = [
  'tailwind.card',
  'tailwind.card-glass',
  'tailwind.stat-block',
  'tailwind.pricing',
  'tailwind.alert',
  'tailwind.hero',
  'tailwind.image-overlay',
] as const;

const EXPECTED_DEFAULT_SNIPPETS: Record<(typeof TAILWIND_CONTENT_BLOCK_IDS)[number], string> = {
  'tailwind.card': 'Card title',
  'tailwind.card-glass': 'Glass card',
  'tailwind.stat-block': 'Revenue',
  'tailwind.pricing': 'Pro Plan',
  'tailwind.alert': 'Heads up',
  'tailwind.hero': 'Build faster with confidence',
  'tailwind.image-overlay': 'Featured story',
};

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState =>
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value });

const collectInspectorKeys = (state: DesignerState, nodeId: string): string[] =>
  resolveInspectorFieldSections(state.document.nodes[nodeId]!).flatMap((section) => section.fields.map((field) => field.key));

afterEach(() => cleanup());

describe('41 — Tailwind UI Blocks content props', () => {
  it.each(TAILWIND_CONTENT_BLOCK_IDS)('catalog defaultProps for %s include semantic content', (itemId) => {
    const item = getPaletteItemById(itemId);
    expect(item?.defaultProps.className).toBeTruthy();
    expect(Object.keys(item?.defaultProps ?? {}).length).toBeGreaterThan(1);
    expect(JSON.stringify(item?.defaultProps ?? {})).toContain(EXPECTED_DEFAULT_SNIPPETS[itemId]);
  });

  it.each(TAILWIND_CONTENT_BLOCK_IDS)('insert from toolbox seeds default content props for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state);
    const props = state.document.nodes[nodeId].props;
    expect(JSON.stringify(props)).toContain(EXPECTED_DEFAULT_SNIPPETS[itemId]);
  });

  it('exposes aligned inspector fields for stat-block, pricing, alert, hero, and image-overlay', () => {
    let statState = insertItem(createInitialDesignerState(), 'tailwind.stat-block');
    expect(collectInspectorKeys(statState, lastChildId(statState))).toEqual(
      expect.arrayContaining(['label', 'value', 'trend', 'trendDirection']),
    );

    let pricingState = insertItem(createInitialDesignerState(), 'tailwind.pricing');
    expect(collectInspectorKeys(pricingState, lastChildId(pricingState))).toEqual(
      expect.arrayContaining(['planName', 'price', 'billingPeriod', 'features', 'isHighlighted', 'ctaLabel']),
    );

    let alertState = insertItem(createInitialDesignerState(), 'tailwind.alert');
    expect(collectInspectorKeys(alertState, lastChildId(alertState))).toEqual(
      expect.arrayContaining(['title', 'message', 'variant', 'dismissible']),
    );

    let heroState = insertItem(createInitialDesignerState(), 'tailwind.hero');
    expect(collectInspectorKeys(heroState, lastChildId(heroState))).toEqual(
      expect.arrayContaining(['heading', 'subheading', 'primaryCta', 'secondaryCta', 'backgroundImage']),
    );

    let overlayState = insertItem(createInitialDesignerState(), 'tailwind.image-overlay');
    expect(collectInspectorKeys(overlayState, lastChildId(overlayState))).toEqual(
      expect.arrayContaining(['imageSrc', 'overlayText', 'overlayOpacity']),
    );
  });

  it('reflects stat-block content in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'tailwind.stat-block');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'label', 'Active users');
    state = setProp(state, nodeId, 'value', '12,480');
    state = setProp(state, nodeId, 'trend', '+8%');

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Active users');
    expect(container.textContent).toContain('12,480');
    expect(container.textContent).toContain('+8%');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Active users');
    expect(tsx).toContain('12,480');
    assertValidTsxSyntax('tailwind.stat-block', tsx);
  });

  it('reflects pricing block content in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'tailwind.pricing');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'planName', 'Team');
    state = setProp(state, nodeId, 'price', '$99');
    state = setProp(state, nodeId, 'features', 'SSO,Audit logs');
    state = setProp(state, nodeId, 'ctaLabel', 'Buy now');

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Team');
    expect(container.textContent).toContain('$99');
    expect(container.textContent).toContain('SSO');
    expect(container.textContent).toContain('Buy now');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('Team');
    expect(tsx).toContain('Buy now');
    assertValidTsxSyntax('tailwind.pricing', tsx);
  });

  it('dismissible tailwind.alert hides after dismiss click in interactive preview', () => {
    let state = insertItem(createInitialDesignerState(), 'tailwind.alert');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'title', 'Policy update');
    state = setProp(state, nodeId, 'message', 'Review the new terms.');
    state = setProp(state, nodeId, 'dismissible', true);

    render(<>{renderDesignerDocumentPreview(state.document, { interactive: true })}</>);
    expect(screen.getByText('Policy update')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss alert' }));
    expect(screen.queryByText('Policy update')).toBeNull();
  });

  it('reflects hero and image-overlay content in preview and export', () => {
    let heroState = insertItem(createInitialDesignerState(), 'tailwind.hero');
    const heroId = lastChildId(heroState);
    heroState = setProp(heroState, heroId, 'heading', 'Launch week');
    heroState = setProp(heroState, heroId, 'primaryCta', 'Reserve spot');

    const heroPreview = render(<>{renderDesignerDocumentPreview(heroState.document)}</>);
    expect(heroPreview.container.textContent).toContain('Launch week');
    expect(heroPreview.container.textContent).toContain('Reserve spot');
    const heroTsx = generateDesignerTsx(heroState.document, heroState.bindingDefinitions);
    expect(heroTsx).toContain('Launch week');
    assertValidTsxSyntax('tailwind.hero', heroTsx);
    heroPreview.unmount();

    let overlayState = insertItem(createInitialDesignerState(), 'tailwind.image-overlay');
    const overlayId = lastChildId(overlayState);
    overlayState = setProp(overlayState, overlayId, 'overlayText', 'City skyline');
    overlayState = setProp(overlayState, overlayId, 'imageSrc', '/assets/designer-default-image.svg');

    const overlayPreview = render(<>{renderDesignerDocumentPreview(overlayState.document)}</>);
    expect(overlayPreview.container.textContent).toContain('City skyline');
    const overlayTsx = generateDesignerTsx(overlayState.document, overlayState.bindingDefinitions);
    expect(overlayTsx).toContain('City skyline');
    assertValidTsxSyntax('tailwind.image-overlay', overlayTsx);
  });
});
