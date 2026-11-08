import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { buildVizBindingWizardActions } from '../bindingVizEngine';
import type { DesignerState } from '../types';

/**
 * Bug found (parity audit item 6): the "Connect to API" wizard's Filters-step toolbar
 * (search/dropdown/date-range/refresh) is fully authorable for all 8 non-chart viz widgets
 * (tree-view/tree-select/cascader/tree-combobox/timeline/gantt/sheet/kanban) and renders a real,
 * working `DesignerChartRuntimeToolbar` in the live canvas and interactive Preview
 * (`buildVizWidgetToolbar`), but `renderVizPaletteJsx` (tsxVizPalette.ts) never emitted a
 * `toolbar={...}` attribute for any of them — only the Chart branch did — so a published
 * non-chart viz widget had no toolbar at all, and `documentUsesChartToolbar` only checked
 * `chartPlan`, never `vizPlan`, so the toolbar component wasn't even imported. Fixed by adding
 * `renderVizToolbarAttr` (mirrors `renderChartToolbarAttr`) and widening
 * `documentUsesChartToolbar`. Also fixed a second, previously-undetected instance of the same
 * "raw JSON bookkeeping prop leaks as an untyped JSX attribute" bug already fixed for Chart:
 * `vizFieldMapping`/`vizToolbarConfig` are set on the node by `buildVizBindingWizardActions` for
 * every bound non-chart viz widget (toolbar enabled or not), and were never excluded from the
 * generic attrs pass — a genuine TypeScript compile break in the exported package for any
 * currently-bound non-chart viz widget, independent of the toolbar gap.
 */

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindVizToDataSource = (
  state: DesignerState,
  nodeId: string,
  toolbarConfig?: Parameters<typeof buildVizBindingWizardActions>[2] extends { toolbarConfig?: infer T } ? T : never,
): DesignerState => {
  let next = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'projects',
    dataSource: {
      id: 'projects',
      name: 'Projects',
      endpoint: '/api/projects',
      fields: ['id', 'title', 'start', 'end', 'progress', 'status'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/projects' } },
    },
  });
  const vizNode = next.document.nodes[nodeId]!;
  for (const action of buildVizBindingWizardActions(vizNode, next.bindingDefinitions.dataSources.projects!, { toolbarConfig })) {
    next = designerReducer(next, action);
  }
  return next;
};

describe('non-chart viz widget toolbar codegen (parity audit item 6)', () => {
  const cases: Array<{ paletteId: string; componentName: string }> = [
    { paletteId: 'viz.tree-view', componentName: 'DesignerVizTreeView' },
    { paletteId: 'viz.tree-select', componentName: 'DesignerVizTreeSelect' },
    { paletteId: 'viz.cascader', componentName: 'DesignerVizCascader' },
    { paletteId: 'viz.tree-combobox', componentName: 'DesignerVizTreeCombobox' },
    { paletteId: 'viz.timeline', componentName: 'DesignerVizTimeline' },
    { paletteId: 'viz.gantt', componentName: 'DesignerVizGantt' },
    { paletteId: 'viz.sheet', componentName: 'DesignerVizSheet' },
    { paletteId: 'viz.kanban', componentName: 'DesignerVizKanban' },
  ];

  for (const { paletteId, componentName } of cases) {
    it(`${paletteId} emits a working search+refresh toolbar wired to a real designerStore/patch pair`, () => {
      let state = insert(createInitialDesignerState(), paletteId);
      const nodeId = lastChild(state);
      state = bindVizToDataSource(state, nodeId, {
        enabled: true,
        runtimeEnabled: true,
        search: { enabled: true, apiParam: 'q', storePath: `vizQuery_${nodeId}.search` },
        refresh: { enabled: true },
      });

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax(`${paletteId} with search+refresh toolbar`, tsx);

      expect(tsx).toContain("import { DesignerChartRuntimeToolbar } from '@/domain/component-designer/DesignerChartRuntimeToolbar';");
      expect(tsx).toContain('<DesignerChartRuntimeToolbar');
      expect(tsx).toContain('onStorePathChange={patchDesignerStore}');
      expect(tsx).toMatch(/onRefresh=\{\(\) => \{ void refresh_vizData_\w+\(\); \}\}/);
      expect(tsx).toMatch(/isLoading=\{isLoading_vizData_\w+\}/);
      // Bug found (parity audit item 9 follow-up): now that the sibling `data={...}` bound
      // expression is correctly emitted (root-cause fix in tsxVizPalette.ts — see
      // vizGanttProgressFieldExportFix.test.ts), it contains literal `>` characters (e.g.
      // `Array<Record<string, unknown>>`), so a naive `[^>]*` span between the component tag and
      // `toolbar=` no longer matches. Codegen emits each node's whole JSX on a single line —
      // locate that line directly instead of using a `>`-sensitive regex span.
      const componentTag = tsx.split('\n').find((line) => line.includes(`<${componentName} `));
      expect(componentTag, `expected a <${componentName} ...> line in generated tsx`).toBeTruthy();
      expect(componentTag).toContain('toolbar={<DesignerChartRuntimeToolbar');

      // The raw JSON bookkeeping props must never leak onto the component as literal attrs.
      expect(componentTag).not.toMatch(/\svizFieldMapping=/);
      expect(componentTag).not.toMatch(/\svizToolbarConfig=/);
    });

    it(`${paletteId} emits no toolbar markup when bound but toolbar not enabled, and never leaks bookkeeping props`, () => {
      let state = insert(createInitialDesignerState(), paletteId);
      const nodeId = lastChild(state);
      state = bindVizToDataSource(state, nodeId);

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax(`${paletteId} with no toolbar`, tsx);

      expect(tsx).not.toContain('DesignerChartRuntimeToolbar');
      expect(tsx).not.toMatch(new RegExp(`<${componentName}[^>]*\\svizFieldMapping=`));
      expect(tsx).not.toMatch(new RegExp(`<${componentName}[^>]*\\svizToolbarConfig=`));
    });
  }
});
