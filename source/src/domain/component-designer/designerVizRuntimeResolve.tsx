import type * as React from 'react';
import type { DesignerNode } from './types';
import {
  parseDesignerVizFieldMapping,
} from './visualizationDataTransform';
import {
  resolveVizDataFromRows,
} from './bindingVizEngine';
import { parseDesignerChartToolbarConfig } from './designerChartToolbarConfig';
import { patchDesignerStorePath } from './bindingPreviewHandlers';
import { DesignerChartRuntimeToolbar } from './DesignerChartRuntimeToolbar';
import type { RuntimeRenderOptions } from './runtimeTypes';
import type { PreviewEventHandlerContext } from './bindingPreviewHandlers';
import type { DesignerBindingDefinitions } from './types';

export type VizWidgetResolveOptions = {
  vizRows?: Array<Record<string, unknown>>;
  vizListBound?: boolean;
  vizListLoading?: boolean;
  vizListError?: boolean;
  toolbar?: React.ReactNode;
  interactive?: boolean;
  onCardMove?: (event: Event) => void;
  previewEvents?: PreviewEventHandlerContext;
  bindingDefinitions?: DesignerBindingDefinitions;
  designerStore?: Record<string, unknown>;
};

export const buildVizWidgetToolbar = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
  configProp: 'vizToolbarConfig' | 'chartToolbarConfig',
  onRefresh?: () => void,
  isLoading?: boolean,
): React.ReactNode | undefined => {
  const toolbarConfig = parseDesignerChartToolbarConfig(node.props[configProp]);
  if (toolbarConfig.enabled !== true) {
    return undefined;
  }

  return (
    <DesignerChartRuntimeToolbar
      nodeId={node.id}
      config={toolbarConfig}
      designerStore={options.designerStore ?? {}}
      mode={options.mode}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onStorePathChange={(storePath, value) => {
        if (options.previewEvents?.patchStoreState) {
          options.previewEvents.patchStoreState((store) => patchDesignerStorePath(store, storePath, value));
        } else {
          options.previewEvents?.patchStore?.(storePath, value);
        }
      }}
      onFilterApplied={() => {
        window.setTimeout(() => onRefresh?.(), 0);
      }}
    />
  );
};

export const resolveBoundVizDataValue = (
  node: DesignerNode,
  fallback: string,
  options: VizWidgetResolveOptions = {},
): unknown => {
  const fieldMapping = parseDesignerVizFieldMapping(node.props.vizFieldMapping);
  if (options.vizRows && fieldMapping) {
    const resolved = resolveVizDataFromRows(options.vizRows, fieldMapping);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  if (options.vizListBound) {
    return options.vizRows && fieldMapping ? resolveVizDataFromRows(options.vizRows, fieldMapping) ?? [] : [];
  }

  const staticData = node.props.data;
  if (typeof staticData === 'string' && staticData.trim().length > 0) {
    return staticData;
  }
  return fallback;
};

export const buildVizWidgetResolveOptions = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): VizWidgetResolveOptions => ({
  vizRows: options.vizRows,
  vizListBound: options.vizListBound,
  vizListLoading: options.vizListLoading,
  vizListError: options.vizListError,
  toolbar: buildVizWidgetToolbar(node, options, 'vizToolbarConfig', options.onVizRefresh, options.vizListLoading),
  previewEvents: options.previewEvents,
  bindingDefinitions: options.bindingDefinitions ?? options.previewEvents?.bindingDefinitions,
  designerStore: options.designerStore ?? options.previewEvents?.designerStore,
});
