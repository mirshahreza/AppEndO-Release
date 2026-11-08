import type { RegionFormFieldMapping } from './bindingRegionEngine';
import { collectRegionFormFieldMappings } from './bindingRegionEngine';
import {
  dataSourceToResource,
  resolveRegionSubmitEndpoints,
  resolveDataSourceOperationEndpoint,
  type FormBindingScenario,
} from './bindingResourceModel';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
} from './types';

export type PayloadPreviewEntry = {
  apiField: string;
  source: string;
  sampleValue: unknown;
};

export type RequestPreviewSummary = {
  method: string;
  endpoint: string;
  bodyEntries: PayloadPreviewEntry[];
  onSuccess?: string;
};

export const buildRegionPayloadPreview = (
  fieldMappings: RegionFormFieldMapping[],
  samplePrefix = 'sample',
): PayloadPreviewEntry[] =>
  fieldMappings.map((mapping) => ({
    apiField: mapping.column,
    source: `form.${mapping.formFieldName}`,
    sampleValue: `{${samplePrefix}.${mapping.column}}`,
  }));

export const buildRegionSubmitRequestPreview = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  regionNodeId: string,
  scenario: FormBindingScenario = 'createEdit',
): RequestPreviewSummary | null => {
  const mappings = collectRegionFormFieldMappings(document, regionNodeId, bindingDefinitions);
  if (mappings.length === 0) {
    return null;
  }

  const regionNode = document.nodes[regionNodeId];
  const regionBinding = regionNode?.binding.regionDataSource;
  const dataSourceRef = regionBinding?.dataSourceRef ?? regionBinding?.sourcePath;
  const dataSource = typeof dataSourceRef === 'string'
    ? bindingDefinitions.dataSources[dataSourceRef.trim()]
    : undefined;

  if (!dataSource) {
    return null;
  }

  const submitEndpoints = resolveRegionSubmitEndpoints(dataSource);
  const resource = dataSourceToResource(dataSource);

  let method = 'POST';
  let endpoint = submitEndpoints.create;

  if (scenario === 'edit' || scenario === 'createEdit') {
    method = resource.primaryKey ? 'PUT / POST (auto)' : 'POST';
    endpoint = submitEndpoints.update;
  }

  return {
    method,
    endpoint,
    bodyEntries: buildRegionPayloadPreview(mappings),
    onSuccess: scenario === 'detail' ? undefined : 'Refresh resource data',
  };
};

export const formatPayloadPreviewJson = (entries: PayloadPreviewEntry[]): string => {
  const body = Object.fromEntries(
    entries.map((entry) => [entry.apiField, entry.sampleValue]),
  );
  return JSON.stringify(body, null, 2);
};

export const buildGridListRequestPreview = (
  dataSourceId: string,
  bindingDefinitions: DesignerBindingDefinitions,
): { method: string; endpoint: string } | null => {
  const dataSource = bindingDefinitions.dataSources[dataSourceId];
  if (!dataSource) {
    return null;
  }

  return {
    method: 'GET',
    endpoint: resolveDataSourceOperationEndpoint(dataSource, 'list'),
  };
};

/** Repeater list binding uses the same list endpoint resolution as grids. */
export const buildRepeaterListRequestPreview = buildGridListRequestPreview;
