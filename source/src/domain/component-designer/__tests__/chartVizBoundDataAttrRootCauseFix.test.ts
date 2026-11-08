import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { buildChartBindingWizardActions } from '../bindingChartEngine';
import { buildVizBindingWizardActions } from '../bindingVizEngine';
import type { DesignerState } from '../types';

/**
 * Bug found (root-cause dig while fixing parity audit item 9): `renderChartJsx` and
 * `renderBoundVizDataAttr` (tsxVizPalette.ts) both called
 * `resolveBoundAttributeForNodeProp(node, 'data', bindingContext)` — passing the whole
 * `DesignerNode` object where the function's signature expects `node.id` (a string). At runtime,
 * every internal `item.nodeId === nodeId` lookup (bindingCodegen.ts) then compared a string to an
 * object — always false — so the bound-data lookup always failed silently and returned `''`.
 * Since `''` is not null/undefined, `boundDataAttr ?? staticFallback` kept the empty string
 * instead of falling back to the static mock — meaning EVERY bound chart AND non-chart viz widget
 * exported with NO `data` attribute at all (not the real bound expression, not even the static
 * fallback). A published chart/viz widget bound to a real API silently rendered with zero data —
 * this was the actual root cause behind the user's original report that filter/search (and by
 * extension, real data) "definitely doesn't work" for charts. Fixed by passing `node.id` instead
 * of `node` at both call sites.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

describe('bound chart/viz data attribute root-cause fix', () => {
  it('a bound viz.chart-bar exports a real transformApiRowsToChartData(...) data expression, not a missing/static attribute', () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-bar');
    const nodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['month', 'revenue'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/orders' } },
      },
    });
    const chartNode = state.document.nodes[nodeId]!;
    for (const action of buildChartBindingWizardActions(chartNode, state.bindingDefinitions.dataSources.orders!)) {
      state = designerReducer(state, action);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('bound chart-bar data attr', tsx);

    expect(tsx).toMatch(/<DesignerVizBarChart\b[^]*? data=\{transformApiRowsToChartData\(/);
    // Never silently missing: this used to emit no `data=` attribute at all.
    expect(tsx.match(/<DesignerVizBarChart\b/g)).toHaveLength(1);
  });

  it('a bound viz.tree-view exports a real bound data expression, not a missing/static attribute', () => {
    let state = insert(createInitialDesignerState(), 'viz.tree-view');
    const nodeId = lastChild(state);
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'departments',
      dataSource: {
        id: 'departments',
        name: 'Departments',
        endpoint: '/api/departments',
        fields: ['id', 'name', 'parentId'],
        primaryKey: 'id',
        operations: { list: { method: 'GET', endpoint: '/api/departments' } },
      },
    });
    const vizNode = state.document.nodes[nodeId]!;
    for (const action of buildVizBindingWizardActions(vizNode, state.bindingDefinitions.dataSources.departments!)) {
      state = designerReducer(state, action);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('bound tree-view data attr', tsx);

    expect(tsx).toMatch(/<DesignerVizTreeView\b[^]*? data=\{transformApiRowsToTreeNodes\(/);
  });
});
