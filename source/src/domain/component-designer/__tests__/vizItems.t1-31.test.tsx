/**
 * @vitest-environment jsdom
 * Phase T1-31 — Data Visualization / Viz palette audit.
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  buildChartBindingWizardActions,
  collectDocumentChartPlan,
  getNodeChartDataResourceRef,
  resolveChartListDataVarName,
} from '../bindingChartEngine';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import {
  buildVizBindingWizardActions,
  collectDocumentVizPlan,
  getNodeVizDataResourceRef,
  resolveVizListDataVarName,
} from '../bindingVizEngine';
import { createEventBindingDefinition, eventBindingKeyForEvent } from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerAction, DesignerState } from '../types';
import { installDesignerCanvasTestPolyfills } from '../../../features/component-designer/__tests__/componentDesignerTestUtils';
import {
  MOCK_KANBAN_BOARD_JSON,
  MOCK_ORG_TREE_JSON,
  MOCK_SHEET_DATA_JSON,
} from '../visualizationMockFixtures';

const VIZ_ITEM_IDS = [
  'viz.chart-bar',
  'viz.chart-line',
  'viz.chart-pie',
  'viz.chart-sparkline',
  'viz.tree-view',
  'viz.tree-select',
  'viz.cascader',
  'viz.tree-combobox',
  'viz.timeline',
  'viz.gantt',
  'viz.sheet',
  'viz.kanban',
] as const;

type VizItemId = (typeof VIZ_ITEM_IDS)[number];

const CHART_ITEM_IDS = [
  'viz.chart-bar',
  'viz.chart-line',
  'viz.chart-pie',
  'viz.chart-sparkline',
] as const;

const VIZ_DATA_ITEM_IDS = [
  'viz.tree-view',
  'viz.timeline',
  'viz.gantt',
  'viz.sheet',
  'viz.kanban',
] as const;

const LOV_TREE_PICKER_IDS = [
  'viz.tree-select',
  'viz.cascader',
  'viz.tree-combobox',
] as const;

const EXPORT_COMPONENT_NAMES: Record<VizItemId, string> = {
  'viz.chart-bar': 'DesignerVizBarChart',
  'viz.chart-line': 'DesignerVizLineChart',
  'viz.chart-pie': 'DesignerVizPieChart',
  'viz.chart-sparkline': 'DesignerVizSparkline',
  'viz.tree-view': 'DesignerVizTreeView',
  'viz.tree-select': 'DesignerVizTreeSelect',
  'viz.cascader': 'DesignerVizCascader',
  'viz.tree-combobox': 'DesignerVizTreeCombobox',
  'viz.timeline': 'DesignerVizTimeline',
  'viz.gantt': 'DesignerVizGantt',
  'viz.sheet': 'DesignerVizSheet',
  'viz.kanban': 'DesignerVizKanban',
};

const DEFAULT_TEXT_SNIPPETS: Record<VizItemId, string> = {
  'viz.chart-bar': 'Revenue by Month',
  'viz.chart-line': 'Trend',
  'viz.chart-pie': 'Share',
  'viz.chart-sparkline': 'Jun',
  'viz.tree-view': 'Head Office',
  'viz.tree-select': 'Department',
  'viz.cascader': 'Region',
  'viz.tree-combobox': 'Search tree',
  'viz.timeline': 'Project Timeline',
  'viz.gantt': 'Schedule',
  'viz.sheet': 'Data Sheet',
  'viz.kanban': 'Sprint Board',
};

const SCOPED_INSPECTOR_FIELDS: Record<VizItemId, string[]> = {
  'viz.chart-bar': ['title', 'data', 'seriesKeys', 'orientation', 'grouped', 'showTooltip', 'legendPosition', 'showMarkPoint', 'renderer'],
  'viz.chart-line': ['title', 'data', 'seriesKeys', 'chartVariant', 'showTooltip', 'animation', 'axisPointer'],
  'viz.chart-pie': ['title', 'data', 'seriesKeys', 'chartVariant', 'valueKey', 'showTooltip', 'darkMode'],
  'viz.chart-sparkline': ['data', 'seriesKeys', 'chartVariant', 'height', 'showTooltip', 'animation', 'renderer'],
  'viz.tree-view': ['data'],
  'viz.tree-select': ['label', 'placeholder', 'data', 'selectedKey', 'multiple', 'selectedKeys'],
  'viz.cascader': ['label', 'placeholder', 'data', 'selectedKey'],
  'viz.tree-combobox': ['label', 'placeholder', 'data', 'selectedKey'],
  'viz.timeline': ['title', 'data'],
  'viz.gantt': ['title', 'data', 'viewMode', 'dependencies', 'milestones', 'allowTaskDrag'],
  'viz.sheet': ['title', 'data'],
  'viz.kanban': ['title', 'data'],
};

const DEAD_INSPECTOR_FIELDS: Record<VizItemId, string[]> = {
  'viz.chart-bar': ['chartVariant', 'valueKey', 'label', 'placeholder'],
  'viz.chart-line': ['orientation', 'grouped', 'valueKey', 'label'],
  'viz.chart-pie': ['orientation', 'grouped', 'label'],
  'viz.chart-sparkline': ['showLegend', 'showGrid', 'orientation', 'grouped', 'label', 'showMarkPoint', 'showMarkLine', 'legendPosition', 'showToolbox'],
  'viz.tree-view': ['label', 'placeholder', 'items', 'seriesKeys'],
  'viz.tree-select': ['seriesKeys', 'orientation', 'items'],
  'viz.cascader': ['seriesKeys', 'orientation', 'items', 'multiple', 'selectedKeys'],
  'viz.tree-combobox': ['seriesKeys', 'orientation', 'items', 'multiple', 'selectedKeys'],
  'viz.timeline': ['label', 'placeholder', 'items', 'seriesKeys'],
  'viz.gantt': ['label', 'placeholder', 'items', 'seriesKeys'],
  'viz.sheet': ['label', 'placeholder', 'items', 'seriesKeys'],
  'viz.kanban': ['label', 'placeholder', 'items', 'seriesKeys'],
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

const collectInspectorFieldKeys = (state: DesignerState, nodeId: string): string[] => {
  const node = state.document.nodes[nodeId];
  return resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
};

const seedSalesDataSource = (state: DesignerState): DesignerState =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'sales',
    dataSource: {
      id: 'sales',
      name: 'Sales',
      endpoint: '/api/sales',
      fields: ['label', 'revenue', 'cost', 'month', 'title', 'status', 'id'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/sales' } },
    },
  });

const seedTasksDataSource = (state: DesignerState): DesignerState =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'tasks',
    dataSource: {
      id: 'tasks',
      name: 'Tasks',
      endpoint: '/api/tasks',
      fields: ['id', 'title', 'status', 'start', 'end', 'name', 'qty'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/tasks' } },
    },
  });

type PreviewHarnessApi = {
  dispatch: React.Dispatch<DesignerAction>;
  getState: () => DesignerState;
};

const StatefulPreviewHarness: React.FC<{
  initialState: DesignerState;
  apiRef: React.MutableRefObject<PreviewHarnessApi | null>;
}> = ({ initialState, apiRef }) => {
  const [state, dispatch] = React.useReducer(designerReducer, initialState);
  apiRef.current = {
    dispatch,
    getState: () => state,
  };

  return (
    <>
      {renderDesignerDocumentPreview(state.document, {
        bindingDefinitions: state.bindingDefinitions,
        interactive: true,
      })}
    </>
  );
};

const renderStatefulPreview = (initialState: DesignerState) => {
  const apiRef: React.MutableRefObject<PreviewHarnessApi | null> = { current: null };
  render(<StatefulPreviewHarness initialState={initialState} apiRef={apiRef} />);
  if (!apiRef.current) {
    throw new Error('Preview harness failed to initialize');
  }
  return apiRef.current;
};

describe('T1-31 Viz palette audit', () => {
  beforeEach(() => {
    installDesignerCanvasTestPolyfills();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it.each(VIZ_ITEM_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
    expect(document.querySelector(`[data-designer-component="${itemId}"]`)).toBeTruthy();
  });

  it.each(VIZ_ITEM_IDS)('exports TSX for %s with the correct viz runtime component', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
    expect(tsx).toContain(EXPORT_COMPONENT_NAMES[itemId]);
  });

  it.each(VIZ_ITEM_IDS)('shows default mock content for %s in canvas preview', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain(DEFAULT_TEXT_SNIPPETS[itemId]);
  });

  it.each(VIZ_ITEM_IDS)(
    'exposes only scoped inspector fields for %s (no dead fields)',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const keys = collectInspectorFieldKeys(state, nodeId);

      for (const key of SCOPED_INSPECTOR_FIELDS[itemId]) {
        expect(keys, `${itemId} should expose ${key}`).toContain(key);
      }
      for (const deadKey of DEAD_INSPECTOR_FIELDS[itemId]) {
        expect(keys, `${itemId} should not expose dead field ${deadKey}`).not.toContain(deadKey);
      }
    },
  );

  it.each(CHART_ITEM_IDS)('registers %s with Chart binding capability (parity-tested)', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('Chart');
    expect(row?.bindingStatus).toBe('parity-tested');
    expect(row?.incompleteCapabilities).toEqual([]);
  });

  it.each(VIZ_DATA_ITEM_IDS)('registers %s with Viz binding capability (parity-tested)', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('Viz');
    expect(row?.bindingStatus).toBe('parity-tested');
    expect(row?.incompleteCapabilities).toEqual([]);
  });

  // LOV_TREE_PICKER_IDS no longer use the LOV mechanism (a flat Options field used to silently
  // override their correct hierarchical data/Viz-API binding — removed). They're covered by Viz
  // alone now, same as viz.tree-view.
  it.each(LOV_TREE_PICKER_IDS)(
    'registers %s with Viz binding capability only, not LOV (flat Options field removed)',
    (itemId) => {
      const row = getBindingCapabilityRow(itemId);
      expect(row?.supportedCapabilities).toContain('Viz');
      expect(row?.supportedCapabilities).not.toContain('LOV');
      expect(row?.bindingStatus).toBe('parity-tested');
      expect(row?.incompleteCapabilities).toEqual([]);
    },
  );

  it('viz.chart-bar reflects title change in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'viz.chart-bar');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'title',
      value: 'Q2 Revenue',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Q2 Revenue');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Q2 Revenue"');
    expect(tsx).toContain('showTooltip={true}');
    expect(tsx).toContain('legendPosition="bottom"');
  });

  it('viz.chart-bar reflects orientation in export', () => {
    let state = insertItem(createInitialDesignerState(), 'viz.chart-bar');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'orientation',
      value: 'horizontal',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('orientation="horizontal"');
  });

  it('viz.chart-pie reflects gauge variant in preview', () => {
    let state = insertItem(createInitialDesignerState(), 'viz.chart-pie');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'chartVariant',
      value: 'gauge',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('[data-designer-component="viz.chart-pie"]')).toBeTruthy();
    expect(container.textContent).toMatch(/%/);
  });

  it('viz.timeline reflects custom title and events in preview and export', () => {
    const customEvents = JSON.stringify([
      { id: 'e1', title: 'Alpha milestone', start: '2026-06-01', end: '2026-06-01' },
    ]);
    let state = insertItem(createInitialDesignerState(), 'viz.timeline');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Release plan' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'data', value: customEvents });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Release plan');
    expect(container.textContent).toContain('Alpha milestone');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Release plan"');
  });

  it('viz.kanban reflects custom board JSON in preview', () => {
    const customBoard = JSON.stringify({
      columns: [{ id: 'col-1', title: 'Backlog', cards: [{ id: 't1', title: 'Audit viz widgets' }] }],
    });
    let state = insertItem(createInitialDesignerState(), 'viz.kanban');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'data', value: customBoard });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Backlog');
    expect(container.textContent).toContain('Audit viz widgets');
  });

  describe('Chart data binding', () => {
    it.each(CHART_ITEM_IDS)('connects %s to chart data resource and export uses useDataFetch', (itemId) => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = seedSalesDataSource(state);
      const node = state.document.nodes[nodeId]!;

      for (const action of buildChartBindingWizardActions(node, state.bindingDefinitions.dataSources.sales!)) {
        state = designerReducer(state, action);
      }

      expect(getNodeChartDataResourceRef(state.document.nodes[nodeId]!)).toBe('sales');
      const plan = collectDocumentChartPlan(state.document, state.bindingDefinitions);
      expect(plan.chartListFetches.some((fetch) => fetch.nodeId === nodeId)).toBe(true);

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('useDataFetch');
      expect(tsx).toMatch(/chartData_/);
    });

    it('bound viz.chart-bar preview uses hydrated API rows', () => {
      let state = insertItem(createInitialDesignerState(), 'viz.chart-bar');
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = seedSalesDataSource(state);
      for (const action of buildChartBindingWizardActions(
        state.document.nodes[nodeId]!,
        state.bindingDefinitions.dataSources.sales!,
      )) {
        state = designerReducer(state, action);
      }

      const hydrationData = {
        [resolveChartListDataVarName(nodeId)]: [
          { label: 'API Jan', revenue: 900, cost: 400 },
        ],
      };

      const { container } = render(
        <>
          {renderDesignerDocumentPreview(state.document, {
            bindingDefinitions: state.bindingDefinitions,
            hydrationData,
          })}
        </>,
      );
      expect(container.querySelector('[data-designer-component="viz.chart-bar"]')).toBeTruthy();
      expect(container.textContent).not.toContain('Could not render');
    });
  });

  describe('Viz data binding (non-chart)', () => {
    it.each(VIZ_DATA_ITEM_IDS)(
      'connects %s to viz data resource and export uses useDataFetch',
      (itemId) => {
        let state = insertItem(createInitialDesignerState(), itemId);
        const nodeId = lastChildId(state, state.document.rootNodeId);
        state = seedTasksDataSource(state);
        const node = state.document.nodes[nodeId]!;

        for (const action of buildVizBindingWizardActions(node, state.bindingDefinitions.dataSources.tasks!)) {
          state = designerReducer(state, action);
        }

        expect(getNodeVizDataResourceRef(state.document.nodes[nodeId]!)).toBe('tasks');
        const plan = collectDocumentVizPlan(state.document, state.bindingDefinitions);
        expect(plan.vizListFetches.some((fetch) => fetch.nodeId === nodeId)).toBe(true);

        const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
        expect(tsx).toContain('useDataFetch');
        expect(tsx).toMatch(/vizData_/);
      },
    );

    it('bound viz.kanban preview uses hydrated kanban board rows', () => {
      let state = insertItem(createInitialDesignerState(), 'viz.kanban');
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = seedTasksDataSource(state);
      for (const action of buildVizBindingWizardActions(
        state.document.nodes[nodeId]!,
        state.bindingDefinitions.dataSources.tasks!,
      )) {
        state = designerReducer(state, action);
      }

      const hydrationData = {
        [resolveVizListDataVarName(nodeId)]: [
          { id: 'c1', title: 'API card task', status: 'todo' },
        ],
      };

      const { container } = render(
        <>
          {renderDesignerDocumentPreview(state.document, {
            bindingDefinitions: state.bindingDefinitions,
            hydrationData,
          })}
        </>,
      );
      expect(container.textContent).toContain('todo');
      expect(container.textContent).toContain('API card task');
      expect(container.textContent).not.toContain('To Do');
    });
  });

  describe('Tree pickers: flat LOV mechanism removed, hierarchical data binding + selection output wired (T1-8/A1 regression)', () => {
    it.each(LOV_TREE_PICKER_IDS)('%s: a stale flat "items" prop (old saved document) no longer overrides the hierarchical data', (itemId) => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'items',
        value: JSON.stringify([{ id: 'stale', textValue: 'Stale flat option' }]),
      });

      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      expect(container.textContent).not.toContain('Stale flat option');

      // Tree Select / Tree Combobox keep the tree collapsed behind a trigger/search input by
      // design — open/search to reveal the real (unmasked) hierarchical data underneath.
      if (itemId === 'viz.tree-select') {
        fireEvent.click(screen.getByRole('button'));
      } else if (itemId === 'viz.tree-combobox') {
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Head' } });
      }
      expect(container.textContent).toContain('Head Office');
    });

    it.each(LOV_TREE_PICKER_IDS)('%s: exports TSX with a real bound onSelectionChange handler', (itemId) => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId,
        bindingKey: eventBindingKeyForEvent('onSelectionChange'),
        definition: createEventBindingDefinition('onSelectionChange', '/api/v1/picked', 'POST'),
      });

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toMatch(/onSelectionChange=\{handle/);
    });
  });

  describe('internal state survives visual Style className change (T1-16 class)', () => {
    it('viz.tree-view keeps collapsed node after className change', async () => {
      const treeNodes = JSON.stringify([
        { id: 'root', label: 'Root', children: [{ id: 'child', label: 'Child leaf' }] },
      ]);

      let state = insertItem(createInitialDesignerState(), 'viz.tree-view');
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'data',
        value: treeNodes,
      });

      const harness = renderStatefulPreview(state);
      const rootToggle = await screen.findByRole('button', { name: /Root/i });
      fireEvent.click(rootToggle);
      await waitFor(() => {
        expect(screen.queryByText('Child leaf')).not.toBeInTheDocument();
      });

      harness.dispatch({
        type: 'set-node-prop',
        nodeId,
        key: 'className',
        value: 'rounded-lg border border-slate-200',
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      });

      expect(screen.queryByText('Child leaf')).not.toBeInTheDocument();
      expect(screen.getByText('Root')).toBeInTheDocument();
    });

    it('viz.sheet keeps edited cell value after className change', async () => {
      let state = insertItem(createInitialDesignerState(), 'viz.sheet');
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'data',
        value: MOCK_SHEET_DATA_JSON,
      });

      const harness = renderStatefulPreview(state);
      const firstInput = await screen.findByDisplayValue('Coffee Beans');
      fireEvent.change(firstInput, { target: { value: 'Edited product' } });
      expect(firstInput).toHaveValue('Edited product');

      harness.dispatch({
        type: 'set-node-prop',
        nodeId,
        key: 'className',
        value: 'rounded-xl border-2 border-indigo-200',
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      });

      expect(screen.getByDisplayValue('Edited product')).toBeInTheDocument();
    });

    it('viz.tree-select keeps dropdown selection after className change', async () => {
      const flatTree = JSON.stringify([{ id: 'branch-a', label: 'Tehran Branch' }]);
      let state = insertItem(createInitialDesignerState(), 'viz.tree-select');
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'data',
        value: flatTree,
      });

      const harness = renderStatefulPreview(state);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText('Tehran Branch')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Tehran Branch'));
      await waitFor(() => {
        expect(screen.getByRole('button').textContent).toContain('Tehran Branch');
      });

      harness.dispatch({
        type: 'set-node-prop',
        nodeId,
        key: 'className',
        value: 'rounded-lg border border-slate-300',
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      });

      expect(screen.getByRole('button').textContent).toContain('Tehran Branch');
    });

    it('viz.cascader keeps column selection after className change', async () => {
      let state = insertItem(createInitialDesignerState(), 'viz.cascader');
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'data',
        value: MOCK_ORG_TREE_JSON,
      });

      const harness = renderStatefulPreview(state);
      fireEvent.click(screen.getByText('Head Office'));
      await waitFor(() => {
        expect(screen.getByText('Sales')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Sales'));
      await waitFor(() => {
        expect(screen.getByText('Tehran')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Tehran'));
      await waitFor(() => {
        expect(screen.getByText(/Head Office \/ Sales \/ Tehran/)).toBeInTheDocument();
      });

      harness.dispatch({
        type: 'set-node-prop',
        nodeId,
        key: 'className',
        value: 'rounded-lg border border-slate-300',
      });

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      });

      expect(screen.getByText(/Head Office \/ Sales \/ Tehran/)).toBeInTheDocument();
    });
  });
});
