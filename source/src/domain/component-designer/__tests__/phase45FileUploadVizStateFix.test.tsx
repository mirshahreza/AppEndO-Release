/**
 * Bug found (per-element gap #4 / Phase 45): `html.file-upload` only exposed
 * `accept`/`multiple` and had no real size/count validation or storage
 * destination wiring, `debounceMs` existed in the toolbar model but had no UI,
 * and most `viz.*` widgets hard-coded loading text with no configurable
 * loading/empty/error triad. Fixed in `DesignerRuntimeFileUpload.tsx`,
 * `InspectorGridToolbarField.tsx`, `BindingChartFilterConfigStep.tsx`,
 * `designerVizDataState.tsx`, and the runtime viz widgets.
 */
// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DesignerRuntimeFileUpload } from '../DesignerRuntimeFileUpload';
import { BindingChartFilterConfigStep } from '../../../features/component-designer/components/BindingChartFilterConfigStep';
import { buildDefaultChartToolbarConfig, serializeDesignerChartToolbarConfig } from '../designerChartToolbarConfig';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { buildChartBindingWizardActions, CHART_TOOLBAR_CONFIG_PROP } from '../bindingChartEngine';
import { DesignerVizBarChart } from '../DesignerRuntimeCharts';
import { DesignerVizTreeView, DesignerVizTreeSelect, DesignerVizCascader, DesignerVizTreeCombobox } from '../DesignerRuntimeTreeWidgets';
import { DesignerVizTimeline, DesignerVizGantt } from '../DesignerRuntimeTimelineWidgets';
import { DesignerVizSheet } from '../DesignerRuntimeSheet';
import { DesignerVizKanban } from '../DesignerRuntimeKanban';

vi.mock('../../shared/ui/UiChart', () => ({
  UiBarChart: ({ data }: { data: unknown[] }) => <div data-testid="bar-chart">{data.length}</div>,
  UiLineChart: ({ data }: { data: unknown[] }) => <div data-testid="line-chart">{data.length}</div>,
  UiPieChart: ({ data }: { data: unknown[] }) => <div data-testid="pie-chart">{data.length}</div>,
  UiSparkline: ({ data }: { data: unknown[] }) => <div data-testid="sparkline-chart">{data.length}</div>,
}));

vi.mock('../../../shared/ui/HeroFieldControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui/HeroFieldControls')>();
  return {
    ...actual,
    UiInput: ({ value, onChange, ariaLabel, type, placeholder, autoDir }: any) => (
      <input
        value={value ?? ''}
        onChange={onChange}
        aria-label={ariaLabel}
        type={type}
        placeholder={placeholder}
        data-auto-dir={String(autoDir)}
      />
    ),
    UiSelect: ({ value, onChange, ariaLabel, children }: any) => (
      <select value={value ?? ''} onChange={onChange} aria-label={ariaLabel}>{children}</select>
    ),
  };
});

afterEach(() => {
  cleanup();
});

describe('Phase 45 - file upload', () => {
  it('shows a size validation message instead of silently accepting an oversized file', async () => {
    render(
      <DesignerRuntimeFileUpload
        maxFileSizeMb={1}
        invalidSizeMessage="File is too large."
      />,
    );

    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'large.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    expect(await screen.findByText('File is too large.')).toBeTruthy();
  });
});

describe('Phase 45 - debounceMs UI', () => {
  it('changing the Filters-step debounce field affects the exported toolbar config', () => {
    const nodeId = 'chart-node';
    const initial = buildDefaultChartToolbarConfig(nodeId);
    const updates: typeof initial[] = [];

    render(
      <BindingChartFilterConfigStep
        nodeId={nodeId}
        config={initial}
        onChange={(next) => {
          updates.push(next);
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('300'), { target: { value: '750' } });

    const updatedConfig = updates.at(-1);
    expect(updatedConfig?.search?.debounceMs).toBe(750);

    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'viz.chart-bar',
      parentId: state.document.rootNodeId,
    });
    const nodeIdInState = state.document.nodes[state.document.rootNodeId].children[0] as string;
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['label', 'revenue'],
        operations: { list: { method: 'GET', endpoint: '/api/orders' } },
      },
    });
    for (const action of buildChartBindingWizardActions(
      state.document.nodes[nodeIdInState]!,
      state.bindingDefinitions.dataSources.orders!,
    )) {
      state = designerReducer(state, action);
    }
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: nodeIdInState,
      key: CHART_TOOLBAR_CONFIG_PROP,
      value: serializeDesignerChartToolbarConfig(updatedConfig!, nodeIdInState),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('"debounceMs":750');
  });
});

describe('Phase 45 - viz loading/empty/error triad', () => {
  const treeData = JSON.stringify([{ id: 'root', label: 'Root', children: [] }]);
  const timelineData = JSON.stringify([{ id: 'evt-1', title: 'Kickoff', start: '2026-01-01' }]);
  const sheetData = { columns: [{ key: 'name', header: 'Name', type: 'text' }], rows: [{ name: 'Ada' }] };
  const kanbanData = JSON.stringify({ columns: [{ id: 'todo', title: 'Todo', cards: [] }] });

  it('renders caller-provided loading/empty/error messages across the viz families', () => {
    render(
      <>
        <DesignerVizBarChart chartListLoading emptyContent="Chart empty" errorContent="Chart error" />
        <DesignerVizTreeView data="[]" vizListBound emptyContent="Tree empty" />
        <DesignerVizTreeSelect data="[]" vizListBound emptyContent="Tree select empty" />
        <DesignerVizCascader data="[]" vizListBound emptyContent="Cascader empty" />
        <DesignerVizTreeCombobox data="[]" vizListBound emptyContent="Combobox empty" />
        <DesignerVizTimeline data="[]" vizListBound emptyContent="Timeline empty" />
        <DesignerVizGantt data="[]" vizListBound emptyContent="Gantt empty" />
        <DesignerVizSheet data={{ columns: [], rows: [] }} vizListBound emptyContent="Sheet empty" />
        <DesignerVizKanban data='{"columns":[]}' vizListBound emptyContent="Kanban empty" />
        <DesignerVizBarChart data={[{ label: 'Jan', revenue: 1 }]} chartListError errorContent="Chart error" />
        <DesignerVizTreeView data={treeData} vizListError errorContent="Tree error" />
        <DesignerVizTimeline data={timelineData} vizListError errorContent="Timeline error" />
        <DesignerVizGantt data={timelineData} vizListError errorContent="Gantt error" />
        <DesignerVizSheet data={sheetData} vizListError errorContent="Sheet error" />
        <DesignerVizKanban data={kanbanData} vizListError errorContent="Kanban error" />
      </>,
    );

    expect(screen.getByText('Tree empty')).toBeTruthy();
    expect(screen.getByText('Tree select empty')).toBeTruthy();
    expect(screen.getByText('Cascader empty')).toBeTruthy();
    expect(screen.getByText('Combobox empty')).toBeTruthy();
    expect(screen.getByText('Timeline empty')).toBeTruthy();
    expect(screen.getByText('Gantt empty')).toBeTruthy();
    expect(screen.getByText('Sheet empty')).toBeTruthy();
    expect(screen.getByText('Kanban empty')).toBeTruthy();
    expect(screen.getAllByText('Chart error').length).toBeGreaterThan(0);
    expect(screen.getByText('Tree error')).toBeTruthy();
    expect(screen.getByText('Timeline error')).toBeTruthy();
    expect(screen.getByText('Gantt error')).toBeTruthy();
    expect(screen.getByText('Sheet error')).toBeTruthy();
    expect(screen.getByText('Kanban error')).toBeTruthy();
  });
});
