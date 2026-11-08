import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { VIZ_PALETTE_ITEM_IDS } from '../designerVizPalette';
import { createInitialDesignerState, designerReducer } from '../state';
import { resolveTsxComponentSpec } from '../tsxComponentRegistry';

const insertVizItem = (itemId: string) => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });
  return state;
};

describe('Phase O visualization palette (CD-O02–O33)', () => {
  it('registers all MVP viz palette ids in catalog', () => {
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.chart-bar');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.kanban');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('dashboard.filter-bar');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.chart');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.map-pin');
    expect(VIZ_PALETTE_ITEM_IDS).toContain('viz.map-choropleth');
    // Phase 52 added viz.chart + viz.map-pin + viz.map-choropleth (13 → 16).
    expect(VIZ_PALETTE_ITEM_IDS).toHaveLength(17);
  });

  it.each(VIZ_PALETTE_ITEM_IDS)('generates valid TSX for %s', async (itemId) => {
    const state = insertVizItem(itemId);
    const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
    const node = state.document.nodes[nodeId];
    const spec = resolveTsxComponentSpec(node);
    expect(spec.kind).toBe('library-custom');
    expect(spec.importFrom).toContain('DesignerRuntime');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
    assertValidTsxSyntax(itemId, tsx);
  });

  it('generates bar chart TSX with the shared chart runtime component', () => {
    const state = insertVizItem('viz.chart-bar');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerVizBarChart');
    expect(tsx).toContain('seriesKeys');
  });

  it('generates tree view TSX with tree runtime component', () => {
    const state = insertVizItem('viz.tree-view');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerVizTreeView');
  });

  it('generates kanban TSX with board runtime component', () => {
    const state = insertVizItem('viz.kanban');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerVizKanban');
  });
});
