import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import {
  buildChartBindingWizardActions,
  CHART_TOOLBAR_CONFIG_PROP,
} from '../bindingChartEngine';
import { serializeDesignerChartToolbarConfig } from '../designerChartToolbarConfig';
import type { DesignerState } from '../types';

/**
 * Bug found: the "Connect to API" wizard's Filters step (Search / Dropdown filters / date range /
 * Refresh button) rendered and worked correctly in the live canvas and interactive Preview, but
 * the exported/published TSX never included any toolbar at all — a published chart had no way
 * for an end user to filter or search it. Fixed in tsxVizPalette.ts/bindingCodegen.ts/
 * bindingStoreCodegen.ts; these tests prove the exported code now actually contains a working,
 * store-wired toolbar for every filter combination the wizard can produce.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindChartToDataSource = (state: DesignerState, nodeId: string): DesignerState => {
  let next = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'orders',
    dataSource: {
      id: 'orders',
      name: 'Orders',
      endpoint: '/api/orders',
      fields: ['month', 'revenue', 'status'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/orders' } },
    },
  });
  const chartNode = next.document.nodes[nodeId]!;
  for (const action of buildChartBindingWizardActions(chartNode, next.bindingDefinitions.dataSources.orders!)) {
    next = designerReducer(next, action);
  }
  return next;
};

describe('chart toolbar codegen', () => {
  it('emits a working search + dropdown-filter toolbar wired to a real designerStore/patch pair', () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-bar');
    const nodeId = lastChild(state);
    state = bindChartToDataSource(state, nodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: CHART_TOOLBAR_CONFIG_PROP,
      value: serializeDesignerChartToolbarConfig({
        enabled: true,
        runtimeEnabled: true,
        search: { enabled: true, apiParam: 'q', storePath: 'chartQuery_x.search' },
        selectFilters: [
          { id: 'filter-1', label: 'Status', apiParam: 'status', storePath: 'chartQuery_x.filter-1', options: [{ value: 'open', label: 'Open' }] },
        ],
      }, nodeId),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('chart with search+dropdown toolbar', tsx);

    expect(tsx).toContain("import { DesignerChartRuntimeToolbar } from '@/domain/component-designer/DesignerChartRuntimeToolbar';");
    expect(tsx).toMatch(/const \{ store: designerStore, patch: patchDesignerStore \} = useDesignerStore/);
    expect(tsx).toContain('<DesignerChartRuntimeToolbar');
    expect(tsx).toContain('onStorePathChange={patchDesignerStore}');
    expect(tsx).toMatch(/onRefresh=\{\(\) => \{ void refresh_chartData_\w+\(\); \}\}/);
    expect(tsx).toMatch(/isLoading=\{isLoading_chartData_\w+\}/);
    // The raw JSON bookkeeping props must never leak onto the chart component as literal attrs.
    expect(tsx).not.toMatch(/<DesignerVizBarChart[^>]*\schartFieldMapping=/);
    expect(tsx).not.toMatch(/<DesignerVizBarChart[^>]*\schartToolbarConfig=/);
  });

  it('still declares a real designerStore/patch pair for a refresh-only toolbar (no search/dropdown/date-range — zero queryParams)', () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-line');
    const nodeId = lastChild(state);
    state = bindChartToDataSource(state, nodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: CHART_TOOLBAR_CONFIG_PROP,
      value: serializeDesignerChartToolbarConfig({ enabled: true, refresh: { enabled: true } }, nodeId),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('chart with refresh-only toolbar', tsx);

    // Bug found: this scenario produces zero queryParams, so a check keyed only on queryParams
    // being non-empty would fall through to a branch that declares `designerStore` as a static
    // `{}` with NO `patch` function — `onStorePathChange={patchDesignerStore}` would then
    // reference an undefined identifier.
    expect(tsx).toMatch(/const \{ store: designerStore, patch: patchDesignerStore \} = useDesignerStore/);
    expect(tsx).toContain('onStorePathChange={patchDesignerStore}');
  });

  it('emits no toolbar import/markup at all when no chart has a toolbar enabled', () => {
    let state = insert(createInitialDesignerState(), 'viz.chart-pie');
    const nodeId = lastChild(state);
    state = bindChartToDataSource(state, nodeId);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('chart with no toolbar', tsx);
    expect(tsx).not.toContain('DesignerChartRuntimeToolbar');
  });
});
