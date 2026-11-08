/**
 * @vitest-environment jsdom
 * Cluster D — heroui.card / heroui.accordion-item: "Size" Inspector field was 100% dead.
 *
 * Neither @heroui/react's <Card> (CardRootProps only exposes `variant`) nor its <Accordion>
 * (AccordionRootProps only exposes `variant`/`hideSeparator`) has any size prop or
 * size style variant at all. The runtime renderers (runtimeRenderer.tsx
 * renderHeroUiStructuralNode) never read node.props.size for either item — accordion-item
 * doesn't even spread passthrough props onto <HAccordion>, and card's generic passthrough
 * is silently dropped by the underlying primitive since `size` isn't a recognized DOM prop.
 * Proved with a direct DOM diff: rendering heroui.card with size="lg" vs size="sm" produces
 * byte-identical HTML. Fixed by removing the dead field declaration in
 * inspectorPaletteFields.ts (PALETTE_HEROUI_FIELDS 'heroui.card'/'heroui.accordion-item'
 * entries for HEROUI_SIZE).
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
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

const inspectorFieldKeys = (state: DesignerState, nodeId: string): string[] =>
  resolveInspectorFieldSections(state.document.nodes[nodeId]).flatMap((section) =>
    section.fields.map((field) => field.key));

const renderedHtmlWithSize = (itemId: string, size: string): string => {
  let state = insertItem(createInitialDesignerState(), itemId);
  const nodeId = lastChildId(state, state.document.rootNodeId);
  state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'size', value: size });
  const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
  const html = container.innerHTML;
  cleanup();
  // react-aria auto-generates ids per render (react-aria-_r_N_); normalize them so only
  // meaningful markup differences (e.g. a real size-driven class/attribute) fail the diff.
  return html.replace(/react-aria-_r_\d+_/g, 'react-aria-_rN_');
};

describe('Cluster D — heroui.card / heroui.accordion-item dead Size field', () => {
  afterEach(() => cleanup());

  it.each(['heroui.card', 'heroui.accordion-item'] as const)(
    'no longer declares a Size Inspector field for %s',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      expect(inspectorFieldKeys(state, nodeId)).not.toContain('size');
    },
  );

  it.each(['heroui.card', 'heroui.accordion-item'] as const)(
    'setting size=lg vs size=sm renders byte-identical DOM for %s (proves the field had zero effect)',
    (itemId) => {
      const htmlLg = renderedHtmlWithSize(itemId, 'lg');
      const htmlSm = renderedHtmlWithSize(itemId, 'sm');
      expect(htmlLg).toBe(htmlSm);
    },
  );

  it('heroui.pagination still declares and honors its Size field (not affected by this fix)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.pagination');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    expect(inspectorFieldKeys(state, nodeId)).toContain('size');

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'size', value: 'lg' });
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('.pagination--lg')).toBeTruthy();
  });
});
