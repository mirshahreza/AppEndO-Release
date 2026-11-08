import * as React from 'react';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { isVizPaletteItemId } from './designerVizPalette';
import {
  DesignerVizBarChart,
  DesignerVizLineChart,
  DesignerVizPieChart,
  DesignerVizSparkline,
  resolveChartPropsFromNode,
} from './DesignerRuntimeCharts';
import {
  DesignerVizAdvancedChart,
  resolveAdvancedChartPropsFromNode,
} from './DesignerRuntimeAdvancedCharts';
import {
  DesignerVizMapChoropleth,
  DesignerVizMapPin,
  resolveMapChoroplethPropsFromNode,
  resolveMapPinPropsFromNode,
} from './DesignerRuntimeMaps';
import {
  DesignerRuntimeVizCascader,
  DesignerRuntimeVizTreeCombobox,
  DesignerRuntimeVizTreeSelect,
  DesignerRuntimeVizTreeView,
} from './DesignerRuntimeTreeWidgets';
import {
  DesignerRuntimeVizGantt,
  DesignerRuntimeVizTimeline,
} from './DesignerRuntimeTimelineWidgets';
import { DesignerVizSheet, resolveSheetPropsFromNode } from './DesignerRuntimeSheet';
import { DesignerVizKanban, resolveKanbanPropsFromNode } from './DesignerRuntimeKanban';
import { getNodePaletteItemId } from './runtimeShared';
import { isChartNode } from './bindingChartEngine';
import { isVizMapPaletteItemId } from './designerVizPalette';
import { patchDesignerStorePath, resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { buildVizWidgetResolveOptions } from './designerVizRuntimeResolve';
import { parseDesignerChartToolbarConfig } from './designerChartToolbarConfig';
import { DesignerChartRuntimeToolbar } from './DesignerChartRuntimeToolbar';
import {
  DASHBOARD_FILTER_BAR_CONFIG_PROP,
  parseDashboardFilterBarConfig,
} from './designerDashboardFilterBarConfig';
import { DesignerRuntimeFilterBar } from './DesignerRuntimeFilterBar';
import { DesignerExportSourceRegistrar } from './designerDataExport';

const resolveChartRenderProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): ReturnType<typeof resolveChartPropsFromNode> => {
  const toolbarConfig = parseDesignerChartToolbarConfig(node.props.chartToolbarConfig);
  const designerStore = options.designerStore ?? {};
  const toolbar = toolbarConfig.enabled === true ? (
    <DesignerChartRuntimeToolbar
      nodeId={node.id}
      config={toolbarConfig}
      designerStore={designerStore}
      mode={options.mode}
      isLoading={options.chartListLoading}
      onRefresh={options.onChartRefresh}
      onStorePathChange={(storePath, value) => {
        if (options.previewEvents?.patchStoreState) {
          options.previewEvents.patchStoreState((store) => patchDesignerStorePath(store, storePath, value));
        } else {
          options.previewEvents?.patchStore?.(storePath, value);
        }
      }}
      onFilterApplied={() => {
        window.setTimeout(() => options.onChartRefresh?.(), 0);
      }}
    />
  ) : undefined;

  const eventProps = options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

  return resolveChartPropsFromNode(node, {
    chartRows: options.chartRows,
    chartSourceDatasets: options.chartSourceDatasets,
    chartListBound: options.chartListBound,
    chartListLoading: options.chartListLoading,
    chartListError: options.chartListError,
    toolbar,
    onDataPointClick: eventProps.onDataPointClick,
  });
};

export const renderVizPaletteNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode | null => {
  const paletteItemId = getNodePaletteItemId(node);
  if (!isVizPaletteItemId(paletteItemId)) {
    return null;
  }

  const { style } = options;

  if (paletteItemId === 'dashboard.filter-bar') {
    const filterBarConfig = parseDashboardFilterBarConfig(node.props[DASHBOARD_FILTER_BAR_CONFIG_PROP]);
    const designerStore = options.designerStore ?? {};
    return (
      <div style={style}>
        <DesignerRuntimeFilterBar
          config={filterBarConfig}
          designerStore={designerStore}
          mode={options.mode}
          onStorePathChange={(storePath, value) => {
            if (options.previewEvents?.patchStoreState) {
              options.previewEvents.patchStoreState((store) => patchDesignerStorePath(store, storePath, value));
            } else {
              options.previewEvents?.patchStore?.(storePath, value);
            }
          }}
          onFilterApplied={() => {
            window.setTimeout(() => {
              options.onGridRefresh?.();
              options.onChartRefresh?.();
            }, 0);
          }}
        />
      </div>
    );
  }

  if (paletteItemId === 'viz.dashboard-canvas') {
    return null;
  }

  if (isChartNode(node)) {
    const chartProps = resolveChartRenderProps(node, options);
    const chartElement = (() => {
      switch (paletteItemId) {
        case 'viz.chart-bar':
          return <DesignerVizBarChart {...chartProps} style={style} />;
        case 'viz.chart-line':
          return <DesignerVizLineChart {...chartProps} style={style} />;
        case 'viz.chart-pie':
          return <DesignerVizPieChart {...chartProps} style={style} />;
        case 'viz.chart-sparkline':
          return <DesignerVizSparkline {...chartProps} style={style} />;
        case 'viz.chart':
          return (
            <DesignerVizAdvancedChart
              {...resolveAdvancedChartPropsFromNode(node, {
                chartRows: options.chartRows,
                chartSourceDatasets: options.chartSourceDatasets,
                chartListBound: options.chartListBound,
                chartListLoading: options.chartListLoading,
                chartListError: options.chartListError,
                toolbar: chartProps.toolbar,
                onDataPointClick: chartProps.onDataPointClick,
              })}
              style={style}
            />
          );
        default:
          return null;
      }
    })();
    if (!chartElement || options.mode === 'design') {
      return chartElement;
    }
    const exportRows = options.chartRows
      ?? options.chartSourceDatasets?.flatMap((entry) => entry.rows)
      ?? [];
    return (
      <>
        <DesignerExportSourceRegistrar
          source="chartDataResource"
          nodeId={node.id}
          rows={exportRows}
          filename={`chart-${node.id}`}
        />
        {chartElement}
      </>
    );
  }

  if (isVizMapPaletteItemId(paletteItemId)) {
    if (paletteItemId === 'viz.map-pin') {
      return <DesignerVizMapPin {...resolveMapPinPropsFromNode(node)} style={style} />;
    }
    return <DesignerVizMapChoropleth {...resolveMapChoroplethPropsFromNode(node)} style={style} />;
  }

  const vizOptions = buildVizWidgetResolveOptions(node, options);

  switch (paletteItemId) {
    case 'viz.tree-view':
      return <DesignerRuntimeVizTreeView node={node} options={options} style={style} />;
    case 'viz.tree-select':
      return <DesignerRuntimeVizTreeSelect node={node} options={options} style={style} />;
    case 'viz.cascader':
      return <DesignerRuntimeVizCascader node={node} options={options} style={style} />;
    case 'viz.tree-combobox':
      return <DesignerRuntimeVizTreeCombobox node={node} options={options} style={style} />;
    case 'viz.timeline':
      return <DesignerRuntimeVizTimeline node={node} options={options} vizOptions={vizOptions} style={style} />;
    case 'viz.gantt':
      return <DesignerRuntimeVizGantt node={node} options={options} vizOptions={vizOptions} style={style} />;
    case 'viz.sheet':
      return <DesignerVizSheet {...resolveSheetPropsFromNode(node, vizOptions)} style={style} />;
    case 'viz.kanban': {
      const eventProps = options.mode === 'runtime' && options.previewEvents
        ? resolveCanvasPreviewEventProps(node, options.previewEvents)
        : resolveCanvasMockEventProps(node);
      return (
        <DesignerVizKanban
          {...resolveKanbanPropsFromNode(node, {
            ...vizOptions,
            interactive: options.mode === 'runtime',
            onCardMove: eventProps.onCardMove,
          })}
          style={style}
        />
      );
    }
    default:
      return null;
  }
};

export const isVizRenderableLeafNode = (node: DesignerNode): boolean =>
  isVizPaletteItemId(getNodePaletteItemId(node));
