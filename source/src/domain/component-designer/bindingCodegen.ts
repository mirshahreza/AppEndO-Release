import {
  collectDocumentBindingPlan,
  dataPathToOptionalChainExpression,
  resolveDesignerEventJsxAttributeName,
  type DocumentBindingPlan,
  type ResolvedEventBinding,
  type ResolvedPropertyBinding,
} from './bindingEngine';
import {
  BINDING_CONTEXT_VAR,
  DESIGNER_FETCH_VAR,
  renderBindingApiRuntimeHelpers,
  renderBindingContextInitialization,
  renderFetchHeadersExpression,
  renderFetchUrlExpression,
  renderMutationHeadersExpression,
  renderMutationUrlExpression,
} from './bindingApiCodegen';
import { collectEntityPickerConfigs, renderEntityPickerHookLines, renderEntityPickerSearchHandlerLines } from './bindingEntityPickerCodegen';
import { getNodePaletteItemId } from './runtimeShared';
import {
  designerStoreCodegenRequired,
  DESIGNER_STORE_PATCH_VAR,
  DESIGNER_STORE_VAR,
  renderDesignerStoreHookDefinition,
  renderDesignerStoreHookLines,
  renderStorePatchStatement,
} from './bindingStoreCodegen';
import type { RepeaterRenderScope } from './repeaterEngine';
import { isItemScopedDataPath, resolveItemScopedPathExpression } from './repeaterEngine';
import { resolveStorePathExpression } from './bindingStoreEngine';
import { documentUsesVisibilityConditions, renderEvaluateDesignerConditionDefinition } from './visibilityConditionEngine';
import {
  compileDesignerFormulaExpression,
  resolveFormulaExpressionText,
} from './bindingFormulaEngine';
import { regionColumnToExpression, resolveRegionDmlMethodExpression, resolveRegionDmlUrlExpression, resolveRegionDmlUrlExpressionForPlan } from './bindingRegionEngine';
import { applyResponseDataPath, coerceApiRecordValue } from './bindingResourceModel';
import { resolveVizDataVarExpressionForCodegen } from './bindingVizEngine';
import { resolveChartXAxisKeyFromMapping, toChartRuntimeTransformMapping } from './bindingChartEngine';
import {
  resolveContentCsvExpression,
  resolveContentListJsonExpression,
  resolveContentScalarPropExpression,
} from './bindingContentEngine';
import {
  buildExistingDataSourceRefreshVarMap,
  collectDynamicActionDataSourceFetches,
  compileDynamicActionValueExpression,
  documentUsesDynamicActions,
  documentUsesExportDataAction,
  documentUsesNavigateAction,
  documentUsesShowToastAction,
  resolveMutationUrlExpressionForCodegen,
  resolveMutationBodyExpressionForCodegen,
  resolveNavigateTargetExpressionForCodegen,
  visibilityStorePathForNode,
  type DynamicActionDataSourceFetch,
  type ResolvedDynamicAction,
} from './bindingDynamicActionsEngine';
import { renderWorkflowInputExpressionForCodegen } from './triggerWorkflowAction';
import {
  collectDocumentGridDetailFlows,
  resolveGridDetailRowActionHandlerName,
  type ResolvedGridDetailFlow,
} from './bindingGridDetailEngine';
import { collectGridRowActionsFromColumns } from './designerGridActionColumns';
import { documentUsesHwyFamilyHouseholdCellClick } from '../hwy/hwyFamilyHousehold';
import { parseHwyMemberDirectoryGridListScopeLegacy } from '../hwy/hwyMemberListScopedEditPageChrome.ts';
import { resolveHwyMemberListScopedEditProfile } from '../hwy/hwyMemberListScopedEditCatalog';
import {
  APP_TABLE_GRID_PALETTE_ITEM_ID,
  parseDesignerAppTableGridColumns,
  parseDesignerGridSortOptions,
} from './designerDataGridColumns';
import {
  collectDynamicActionSetValueStorePaths,
  collectDynamicActionShowHideTargetNodeIds,
  documentUsesDynamicActionVisibility,
  resolveDynamicSetValueBindingExpression,
} from './bindingDynamicActionsCodegen';
import { normalizeBindingDefinitions, coerceBindingDefinitions } from './bindingRegistry';
import type { DataSourceDefinition, DesignerBindingDefinitions, DesignerLiveMode, LovDefinition } from './types';
import {
  buildLiveStreamUrl,
  isActiveLiveMode,
} from './liveDataSource';
import { isNestedPayloadPath } from './bindingApiHelpers';
import { validateDesignerFieldNode } from './previewFieldValidation';
import type { CrossFieldRule, DesignerBindingDefinition, DesignerDocument, DesignerNode } from './types';
import { resolveDesignerHtmlTag } from './domProps';
import { readBoolean, readNumber, readString } from './runtimeShared';
import { resolveAppTableGridVarNames } from './designerDataGridColumns';
import {
  normalizeDesignerGridToolbarConfig,
  parseDesignerGridToolbarConfig,
  resolveEffectiveFieldFilters,
  resolveFieldFilterStaticOptions,
  defaultMatchLogicStorePathForFieldFilter,
  fieldFilterSupportsMatchLogic,
  type DesignerGridToolbarFieldFilterConfig,
} from './designerGridToolbarConfig';
import { DEFAULT_FILTER_MATCH_LOGIC } from '../../shared/lib/filterMatchLogic';
import { resolveEffectiveAppTableGridQueryMode } from './designerDataGridRuntime';
import {
  applyGridAggregation,
  isGridAggregationEnabled,
  parseGridAggregationConfig,
} from './designerGridAggregation';
import { documentUsesTranslationKeys } from './translatableTextContent';
import { appTableGridNodeUsesCultureKeys } from './designerGridCultureKeys';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';

export const TSX_BINDING_RAW_EXPRESSION = Symbol.for('appendo.tsxBindingRawExpression');

export type TsxBindingRawExpression = {
  [TSX_BINDING_RAW_EXPRESSION]: string;
};

export const tsxBindingRawExpr = (expression: string): TsxBindingRawExpression => ({
  [TSX_BINDING_RAW_EXPRESSION]: expression,
});

export const isTsxBindingRawExpression = (value: unknown): value is TsxBindingRawExpression =>
  typeof value === 'object' && value !== null && TSX_BINDING_RAW_EXPRESSION in value;

export type TsxBindingRenderContext = {
  dataContextVar: string;
  document: DesignerDocument;
  plan: DocumentBindingPlan;
  handlerNames: Map<string, string>;
  entityPickerConfigs: ReturnType<typeof collectEntityPickerConfigs>;
  fetchRefreshVarByKey: Map<string, string>;
  fetchDataVarByIndex: Map<number, string>;
  regionDataVarBySourceId: Map<string, string>;
  dynamicActionFetches: DynamicActionDataSourceFetch[];
  showHideTargetNodeIds: Set<string>;
  setValueStorePathsByNodeId: Map<string, string>;
  repeaterScope?: RepeaterRenderScope;
  /** App Table Grid node ids that have a real declared row-action handler (action columns
   * and/or a resolved grid-detail flow) — lets tsxPhase2Palette.ts's JSX renderer know whether
   * it's safe to attach `onGridRowAction` without referencing an undeclared variable. */
  appTableGridRowActionNodeIds: Set<string>;
  /** Phase 55 — data sources keyed by id (for liveMode lookup during fetch codegen). */
  dataSources: Record<string, DataSourceDefinition>;
  /** LOV registry entries (toolbar filters, status picker, select fields). */
  lovs: Record<string, LovDefinition>;
  bindingDefinitions: DesignerBindingDefinitions;
};

const sanitizeHandlerSuffix = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, '_');

export const createHandlerName = (binding: ResolvedEventBinding): string =>
  `handle${sanitizeHandlerSuffix(binding.targetEvent)}_${sanitizeHandlerSuffix(binding.nodeId)}`;

export const createTsxBindingRenderContext = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition> = {},
): TsxBindingRenderContext => {
  const registry = normalizeBindingDefinitions(bindingDefinitions);
  const plan = collectDocumentBindingPlan(document, registry);
  const handlerNames = new Map<string, string>();
  const fetchRefreshVarByKey = new Map<string, string>();
  const fetchDataVarByIndex = new Map<number, string>();

  for (const binding of plan.eventBindings) {
    handlerNames.set(`${binding.nodeId}:${binding.targetEvent}`, createHandlerName(binding));
  }

  plan.fetchConfigs.forEach((config, index) => {
    const dataVar = index === 0 ? 'dataContext' : `fetchData_${index}`;
    const refreshVar = index === 0 ? 'refreshDataContext' : `refreshFetch_${index}`;
    fetchDataVarByIndex.set(index, dataVar);
    fetchRefreshVarByKey.set(config.configKey, refreshVar);
    fetchRefreshVarByKey.set(config.endpointTemplate, refreshVar);
  });

  const regionDataVarBySourceId = new Map<string, string>();
  for (const regionFetch of plan.regionPlan.regionFetches) {
    regionDataVarBySourceId.set(regionFetch.dataSourceId, regionFetch.dataVar);
    fetchRefreshVarByKey.set(`region:${regionFetch.dataSourceId}`, `refresh_${regionFetch.dataVar}`);
    fetchRefreshVarByKey.set(regionFetch.fetchConfig.configKey, `refresh_${regionFetch.dataVar}`);
    fetchRefreshVarByKey.set(regionFetch.fetchConfig.endpointTemplate, `refresh_${regionFetch.dataVar}`);
  }

  // Bug found (parity audit item 36): a `refreshDataSource` Dynamic Action (e.g. a Create/Edit
  // form's "Refresh" success action) targeting the SAME data source a Grid/Chart/Viz is already
  // bound to always manufactured a brand-new, disconnected standalone fetch instead of reusing
  // the live widget's own refresh — so "refresh the grid's data source" silently refreshed a
  // phantom, unrendered fetch while the visible widget never updated. Register Grid/Chart/Viz
  // fetches into the same `region:${dataSourceId}` key space Region fetches already use, and
  // pass that map into `collectDynamicActionDataSourceFetches` so phantoms are not emitted.
  for (const gridFetch of plan.gridPlan.gridListFetches) {
    if (regionDataVarBySourceId.has(gridFetch.dataSourceId)) {
      continue;
    }
    regionDataVarBySourceId.set(gridFetch.dataSourceId, gridFetch.dataVar);
    fetchRefreshVarByKey.set(`region:${gridFetch.dataSourceId}`, `refresh_${gridFetch.dataVar}`);
    fetchRefreshVarByKey.set(gridFetch.fetchConfig.configKey, `refresh_${gridFetch.dataVar}`);
    fetchRefreshVarByKey.set(gridFetch.fetchConfig.endpointTemplate, `refresh_${gridFetch.dataVar}`);
  }

  for (const chartFetch of plan.chartPlan.chartListFetches) {
    if (regionDataVarBySourceId.has(chartFetch.dataSourceId)) {
      continue;
    }
    regionDataVarBySourceId.set(chartFetch.dataSourceId, chartFetch.dataVar);
    fetchRefreshVarByKey.set(`region:${chartFetch.dataSourceId}`, `refresh_${chartFetch.dataVar}`);
    fetchRefreshVarByKey.set(chartFetch.fetchConfig.configKey, `refresh_${chartFetch.dataVar}`);
    fetchRefreshVarByKey.set(chartFetch.fetchConfig.endpointTemplate, `refresh_${chartFetch.dataVar}`);
  }

  for (const vizFetch of plan.vizPlan.vizListFetches) {
    if (regionDataVarBySourceId.has(vizFetch.dataSourceId)) {
      continue;
    }
    regionDataVarBySourceId.set(vizFetch.dataSourceId, vizFetch.dataVar);
    fetchRefreshVarByKey.set(`region:${vizFetch.dataSourceId}`, `refresh_${vizFetch.dataVar}`);
    fetchRefreshVarByKey.set(vizFetch.fetchConfig.configKey, `refresh_${vizFetch.dataVar}`);
    fetchRefreshVarByKey.set(vizFetch.fetchConfig.endpointTemplate, `refresh_${vizFetch.dataVar}`);
  }

  for (const repeaterFetch of plan.repeaterPlan.repeaterListFetches) {
    if (regionDataVarBySourceId.has(repeaterFetch.dataSourceId)) {
      continue;
    }
    regionDataVarBySourceId.set(repeaterFetch.dataSourceId, repeaterFetch.dataVar);
    fetchRefreshVarByKey.set(`region:${repeaterFetch.dataSourceId}`, `refresh_${repeaterFetch.dataVar}`);
    fetchRefreshVarByKey.set(repeaterFetch.fetchConfig.configKey, `refresh_${repeaterFetch.dataVar}`);
    fetchRefreshVarByKey.set(repeaterFetch.fetchConfig.endpointTemplate, `refresh_${repeaterFetch.dataVar}`);
  }

  // Only emit a phantom Dynamic Action fetch when no live Region/Grid/Chart/Viz/Repeater fetch
  // already covers that dataSourceId. `resolveDynamicActions` (via collectDocumentBindingPlan)
  // already remaps refreshVar to the live fetch; this keeps the hook declaration list in sync.
  const existingRefreshVarByDataSourceId = buildExistingDataSourceRefreshVarMap({
    regionFetches: plan.regionPlan.regionFetches,
    gridListFetches: plan.gridPlan.gridListFetches,
    chartListFetches: plan.chartPlan.chartListFetches,
    vizListFetches: plan.vizPlan.vizListFetches,
    repeaterListFetches: plan.repeaterPlan.repeaterListFetches,
  });
  const dynamicActionFetches = collectDynamicActionDataSourceFetches(
    document,
    registry,
    existingRefreshVarByDataSourceId,
  );
  const hasRealFetchForDataSourceId = new Set(regionDataVarBySourceId.keys());
  for (const dynamicFetch of dynamicActionFetches) {
    const hasRealFetch = hasRealFetchForDataSourceId.has(dynamicFetch.dataSourceId);
    if (!hasRealFetch) {
      regionDataVarBySourceId.set(dynamicFetch.dataSourceId, dynamicFetch.dataVar);
      fetchRefreshVarByKey.set(`region:${dynamicFetch.dataSourceId}`, dynamicFetch.refreshVar);
      fetchRefreshVarByKey.set(dynamicFetch.dataSourceId, dynamicFetch.refreshVar);
    }
    fetchRefreshVarByKey.set(dynamicFetch.configKey, dynamicFetch.refreshVar);
    fetchRefreshVarByKey.set(dynamicFetch.endpoint, dynamicFetch.refreshVar);
  }

  const appTableGridDetailFlowNodeIds = new Set(
    collectDocumentGridDetailFlows(document, registry)
      .filter((flow) => getNodePaletteItemId(document.nodes[flow.gridNodeId]) === APP_TABLE_GRID_PALETTE_ITEM_ID)
      .map((flow) => flow.gridNodeId),
  );
  const appTableGridRowActionNodeIds = new Set<string>();
  for (const node of Object.values(document.nodes)) {
    if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
      continue;
    }
    const columns = parseDesignerAppTableGridColumns(node.props.columns);
    if (collectGridRowActionsFromColumns(columns).length > 0 || appTableGridDetailFlowNodeIds.has(node.id)) {
      appTableGridRowActionNodeIds.add(node.id);
    }
  }

  return {
    dataContextVar: 'dataContext',
    document,
    plan,
    handlerNames,
    entityPickerConfigs: collectEntityPickerConfigs(document),
    fetchRefreshVarByKey,
    fetchDataVarByIndex,
    regionDataVarBySourceId,
    dynamicActionFetches,
    showHideTargetNodeIds: collectDynamicActionShowHideTargetNodeIds(document),
    setValueStorePathsByNodeId: collectDynamicActionSetValueStorePaths(document),
    appTableGridRowActionNodeIds,
    dataSources: registry.dataSources,
    lovs: registry.lovs,
    bindingDefinitions: registry,
  };
};

export const resolveFetchDataVarForEndpoint = (
  endpoint: string,
  context: TsxBindingRenderContext,
): string | undefined => {
  const normalized = endpoint.trim();
  if (!normalized) {
    return undefined;
  }

  for (const [index, config] of context.plan.fetchConfigs.entries()) {
    if (config.endpointTemplate.trim() === normalized) {
      return context.fetchDataVarByIndex.get(index) ?? (index === 0 ? context.dataContextVar : `fetchData_${index}`);
    }
  }

  return undefined;
};

export const resolveToolbarLovFilterOptionsExpression = (
  filter: DesignerGridToolbarFieldFilterConfig,
  context: TsxBindingRenderContext | undefined,
): string | null => {
  const staticOptions = resolveFieldFilterStaticOptions(filter);
  if (staticOptions.length > 0) {
    return JSON.stringify(staticOptions);
  }

  if (!context || filter.optionsSource !== 'lov' || !filter.lovRef?.trim()) {
    return null;
  }

  const lov = context.lovs[filter.lovRef.trim()];
  if (!lov?.endpoint?.trim()) {
    return null;
  }

  const dataVar = resolveFetchDataVarForEndpoint(lov.endpoint, context);
  if (!dataVar) {
    return null;
  }

  return `mapDesignerLovItems(${dataVar}?.items, ${JSON.stringify(lov.returnValue)}, ${JSON.stringify(lov.displayValue)}).map((item) => ({ value: item.id, label: item.textValue }))`;
};

export const bindingCodegenRequiresRuntimeHelpers = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition> = {},
): boolean => {
  const registry = normalizeBindingDefinitions(bindingDefinitions);
  const plan = collectDocumentBindingPlan(document, registry);
  return plan.fetchConfigs.length > 0
    || plan.regionPlan.regionFetches.length > 0
    || plan.regionPlan.regionColumnLovFetches.length > 0
    || plan.gridPlan.gridListFetches.length > 0
    || plan.repeaterPlan.repeaterListFetches.length > 0
    || plan.chartPlan.chartListFetches.length > 0
    || plan.vizPlan.vizListFetches.length > 0
    || plan.contentPlan.contentListFetches.length > 0
    || plan.eventBindings.length > 0
    || plan.propertyBindings.length > 0
    || plan.storeReadBindings.length > 0
    || plan.storeWriteBindings.length > 0
    || documentUsesDynamicActions(document)
    || documentUsesDynamicActionVisibility(document)
    || designerStoreCodegenRequired(document, registry)
    || documentUsesVisibilityConditions(document)
    || collectEntityPickerConfigs(document).length > 0;
};

export const renderBindingHookDefinitions = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition> = {},
): string[] => {
  const registry = normalizeBindingDefinitions(bindingDefinitions);
  const lines: string[] = [];

  if (bindingCodegenRequiresRuntimeHelpers(document, registry)) {
    lines.push(...renderBindingApiRuntimeHelpers());
  }

  if (designerStoreCodegenRequired(document, registry)) {
    lines.push(...renderDesignerStoreHookDefinition());
  }

  if (documentUsesVisibilityConditions(document) || documentUsesDynamicActionVisibility(document)) {
    lines.push(...renderEvaluateDesignerConditionDefinition());
  }

  return lines;
};

/**
 * True when `targetProp` on `nodeId` has a Store-path binding or a data-path (API/region)
 * property binding. Used by custom per-widget JSX renderers (e.g. html.image's `src`) to
 * skip emitting a hardcoded static fallback attribute when a bound expression will be
 * appended for the same prop — avoiding a duplicate JSX attribute in the generated source.
 */
export const isNodePropBound = (
  nodeId: string,
  targetProp: string,
  context: TsxBindingRenderContext,
): boolean => (
  context.plan.storeReadBindings.some((item) => item.nodeId === nodeId && item.targetProp === targetProp)
  || context.plan.propertyBindings.some((item) => item.nodeId === nodeId && item.targetProp === targetProp)
);

export const resolveNodePropertyBindingExpression = (
  nodeId: string,
  targetProp: string,
  context: TsxBindingRenderContext,
): string | null => {
  const regionColumnBinding = context.plan.regionPlan.regionColumnBindings.find(
    (item) => item.nodeId === nodeId && item.targetProp === targetProp,
  );

  if (targetProp === 'rows') {
    const gridFetch = context.plan.gridPlan.gridListFetches.find((item) => item.nodeId === nodeId);
    if (gridFetch) {
      // `renderGridListFetchHookLines` already unwraps list payloads via `applyResponseDataPath`
      // before assigning `dataVar` — do not drill into `responseMapping.arrayPath` again.
      const rowsExpression = gridFetch.dataVar;
      // Guard against non-array API responses (e.g. a single record instead of a list) the
      // same way Chart/Viz/Content list bindings already do — otherwise a malformed payload
      // reaches `<Table.Body items={...}>`/`<AppTableGrid rows={...}>` as a non-iterable value
      // and crashes the exported app at render time, while preview's `gridRows` resolution
      // (designerRuntimePreview.tsx) already falls back to `undefined`/`[]` for the same case.
      return `(Array.isArray(${rowsExpression}) ? ${rowsExpression} : [])`;
    }
  }

  if (targetProp === 'data' || targetProp === 'slides' || targetProp === 'steps' || targetProp === 'options') {
    const contentFetch = context.plan.contentPlan.contentListFetches.find((item) => item.nodeId === nodeId);
    if (contentFetch) {
      const listProp = contentFetch.targetListProp;
      if (listProp === targetProp || (targetProp === 'data' && listProp === 'data')) {
        if (listProp === 'steps' || listProp === 'options') {
          return resolveContentCsvExpression(contentFetch.dataVar);
        }
        return resolveContentListJsonExpression(contentFetch.dataVar);
      }
    }
  }

  if (targetProp === 'data') {
    const chartFetches = context.plan.chartPlan.chartListFetches.filter((item) => item.nodeId === nodeId);
    if (chartFetches.length === 1) {
      const chartFetch = chartFetches[0]!;
      // Embed the flat runtime transform shape (not the discriminated Designer union) so the
      // export-bundled helper in bindingApiCodegen stays stable across chartType variants.
      const mappingJson = JSON.stringify(toChartRuntimeTransformMapping(chartFetch.fieldMapping));
      return `transformApiRowsToChartData(Array.isArray(${chartFetch.dataVar}) ? ${chartFetch.dataVar} as Array<Record<string, unknown>> : [], ${mappingJson})`;
    }
    if (chartFetches.length > 1) {
      const xAxisKey = resolveChartXAxisKeyFromMapping(chartFetches[0]!.fieldMapping);
      const transformExpressions = chartFetches.map((chartFetch) => {
        const mappingJson = JSON.stringify(toChartRuntimeTransformMapping(chartFetch.fieldMapping));
        return `transformApiRowsToChartData(Array.isArray(${chartFetch.dataVar}) ? ${chartFetch.dataVar} as Array<Record<string, unknown>> : [], ${mappingJson})`;
      });
      return `mergeMultiSourceChartData([${transformExpressions.join(', ')}], ${JSON.stringify(xAxisKey)})`;
    }

    const vizFetch = context.plan.vizPlan.vizListFetches.find((item) => item.nodeId === nodeId);
    if (vizFetch) {
      return resolveVizDataVarExpressionForCodegen(vizFetch.dataVar, vizFetch.fieldMapping);
    }
  }

  if (regionColumnBinding) {
    return regionColumnToExpression(regionColumnBinding.dataVar, regionColumnBinding.column);
  }

  const storeBinding = context.plan.storeReadBindings.find(
    (item) => item.nodeId === nodeId && item.targetProp === targetProp,
  );

  if (storeBinding) {
    const baseExpression = resolveStorePathExpression(storeBinding.storePath);
    return resolveDynamicSetValueBindingExpression(
      nodeId,
      targetProp,
      baseExpression,
      context.setValueStorePathsByNodeId,
    );
  }

  const binding = context.plan.propertyBindings.find(
    (item) => item.nodeId === nodeId && item.targetProp === targetProp,
  );

  if (binding) {
    if (binding.definition.sourceType === 'formula') {
      const formula = resolveFormulaExpressionText(binding.definition) ?? binding.dataPath;
      const baseExpression = compileDesignerFormulaExpression(formula);
      return resolveDynamicSetValueBindingExpression(
        nodeId,
        targetProp,
        baseExpression,
        context.setValueStorePathsByNodeId,
      );
    }

    if (context.repeaterScope && isItemScopedDataPath(binding.dataPath)) {
      return resolveItemScopedPathExpression(binding.dataPath, context.repeaterScope);
    }

    const dataVar = binding.fetchConfig
      ? context.plan.fetchConfigs.findIndex((item) => item.configKey === binding.fetchConfig?.configKey)
      : -1;
    const rootVar = dataVar > 0
      ? (context.fetchDataVarByIndex.get(dataVar) ?? context.dataContextVar)
      : context.dataContextVar;

    const baseExpression = dataPathToOptionalChainExpression(binding.dataPath, rootVar);
    return resolveDynamicSetValueBindingExpression(
      nodeId,
      targetProp,
      baseExpression,
      context.setValueStorePathsByNodeId,
    );
  }

  return resolveDynamicSetValueBindingExpression(
    nodeId,
    targetProp,
    null,
    context.setValueStorePathsByNodeId,
  );
};

export const renderBoundJsxAttribute = (
  attributeName: string,
  expression: string,
): string => ` ${attributeName}={${expression}}`;

export const renderBoundJsxTextExpression = (expression: string, fallback: string): string =>
  `{${expression} ?? ${JSON.stringify(fallback)}}`;

export const renderDesignerItemsMapperExpression = (
  itemsBinding: string,
  nodeId: string,
  context: TsxBindingRenderContext,
): string => {
  const propertyBinding = context.plan.propertyBindings.find(
    (item) => item.nodeId === nodeId && item.targetProp === 'items',
  );

  if (propertyBinding?.lovMapping) {
    const { returnColumn, displayColumn } = propertyBinding.lovMapping;
    return `mapDesignerLovItems(${itemsBinding}, ${JSON.stringify(returnColumn)}, ${JSON.stringify(displayColumn)})`;
  }

  const regionLovFetch = context.plan.regionPlan.regionColumnLovFetches.find(
    (item) => item.nodeId === nodeId,
  );
  if (regionLovFetch) {
    const { returnColumn, displayColumn } = regionLovFetch.lovMapping;
    return `mapDesignerLovItems(${itemsBinding}, ${JSON.stringify(returnColumn)}, ${JSON.stringify(displayColumn)})`;
  }

  return `mapDesignerListBoxItems(${itemsBinding})`;
};

export const resolveNodeOptionItemsDataExpression = (
  nodeId: string,
  context: TsxBindingRenderContext,
): string | null => {
  const propertyItemsBinding = context.plan.propertyBindings.find(
    (item) => item.nodeId === nodeId && item.targetProp === 'items',
  );

  if (propertyItemsBinding) {
    if (context.repeaterScope && isItemScopedDataPath(propertyItemsBinding.dataPath)) {
      return resolveItemScopedPathExpression(propertyItemsBinding.dataPath, context.repeaterScope);
    }

    const dataVar = propertyItemsBinding.fetchConfig
      ? context.plan.fetchConfigs.findIndex((item) => item.configKey === propertyItemsBinding.fetchConfig?.configKey)
      : -1;
    const rootVar = dataVar > 0
      ? (context.fetchDataVarByIndex.get(dataVar) ?? context.dataContextVar)
      : context.dataContextVar;

    return dataPathToOptionalChainExpression(propertyItemsBinding.dataPath, rootVar);
  }

  const regionLovFetch = context.plan.regionPlan.regionColumnLovFetches.find(
    (item) => item.nodeId === nodeId,
  );
  if (regionLovFetch) {
    return regionLovFetch.dataVar;
  }

  return null;
};

const resolveFetchRefreshVar = (
  queryKey: string,
  context: TsxBindingRenderContext,
): string | undefined => context.fetchRefreshVarByKey.get(queryKey);

const renderFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  if (context.plan.fetchConfigs.length === 0) {
    return [];
  }

  const lines: string[] = [];
  context.plan.fetchConfigs.forEach((fetchConfig, index) => {
    const dataVar = index === 0 ? context.dataContextVar : `fetchData_${index}`;
    const refreshVar = index === 0 ? 'refreshDataContext' : `refreshFetch_${index}`;
    const loadingVar = index === 0 ? 'isHydrating' : `isHydrating_${index}`;
    const errorVar = index === 0 ? 'fetchError' : `fetchError_${index}`;
    // The hydration fetch runs during render and must not reference `bindingContext`,
    // because `bindingContext` is derived from this fetch's own result (`dataContext`)
    // and is therefore declared afterwards. URL/header params are resolved from the
    // designer store (external state), consistent with region/grid fetches.
    const hasUrlParams = Object.keys(fetchConfig.urlParams).length > 0;
    const hasHeaders = Object.keys(fetchConfig.headers).length > 0;
    const urlExpression = hasUrlParams
      ? renderFetchUrlExpression(fetchConfig.endpointTemplate, fetchConfig.urlParams, DESIGNER_STORE_VAR)
      : JSON.stringify(fetchConfig.endpointTemplate);
    const optionsExpression = hasHeaders
      ? `{ headers: ${renderFetchHeadersExpression(fetchConfig.headers, fetchConfig.urlParams, DESIGNER_STORE_VAR)} }`
      : '{}';

    lines.push(
      `  const { data: ${dataVar}, isLoading: ${loadingVar}, error: ${errorVar}, refresh: ${refreshVar} } = useDataFetch<Record<string, unknown> | null>(${urlExpression}, ${optionsExpression});`,
    );
  });

  return lines;
};

/**
 * Whether any hydration / region / grid fetch resolves its URL or headers from the
 * designer store, which means `designerStore` must be declared before those hooks run.
 */
const fetchHooksReferenceDesignerStore = (context: TsxBindingRenderContext): boolean => {
  const primaryUsesStore = context.plan.fetchConfigs.some(
    (config) => Object.keys(config.urlParams).length > 0 || Object.keys(config.headers).length > 0,
  );
  const regionUsesStore = context.plan.regionPlan.regionFetches.some(
    (entry) => Object.keys(entry.fetchConfig.urlParams).length > 0,
  );
  const gridUsesStore = context.plan.gridPlan.gridListFetches.some(
    (entry) => Object.keys(entry.fetchConfig.urlParams).length > 0
      || Object.keys(entry.queryParams ?? {}).length > 0,
  );
  const chartUsesStore = context.plan.chartPlan.chartListFetches.some(
    (entry) => Object.keys(entry.fetchConfig.urlParams).length > 0
      || (entry.queryParams && Object.keys(entry.queryParams).length > 0)
      // Bug found: a chart toolbar with only a Refresh button (no search/dropdown/date-range
      // filters) produces zero queryParams, so this check alone missed it — the generated
      // <DesignerChartRuntimeToolbar> (added alongside this fix) always needs designerStore/patch
      // regardless of which filter types are actually enabled.
      || entry.toolbarConfig.enabled === true,
  );
  const vizUsesStore = context.plan.vizPlan.vizListFetches.some(
    (entry) => Object.keys(entry.fetchConfig.urlParams).length > 0
      || (entry.queryParams && Object.keys(entry.queryParams).length > 0),
  );
  const contentUsesStore = context.plan.contentPlan.contentListFetches.some(
    (entry) => Object.keys(entry.fetchConfig.urlParams).length > 0,
  );
  return primaryUsesStore || regionUsesStore || gridUsesStore || chartUsesStore || vizUsesStore || contentUsesStore;
};

const renderLiveDataSourceHookLines = (
  dataVar: string,
  endpoint: string,
  liveMode: DesignerLiveMode | undefined,
): string[] => {
  if (!isActiveLiveMode(liveMode)) {
    return [];
  }
  const streamUrl = buildLiveStreamUrl(endpoint, liveMode);
  if (!streamUrl) {
    return [];
  }
  const setDataVar = `setData_${dataVar}`;
  const refreshVar = `refresh_${dataVar}`;
  return [
    `  useLiveDataSource({`,
    `    url: ${JSON.stringify(streamUrl)},`,
    `    type: ${JSON.stringify(liveMode.type)},`,
    `    onSnapshot: (payload) => { ${setDataVar}(payload as never); },`,
    `    onAppend: (payload) => { ${setDataVar}((current: unknown) => applyLiveAppend(current, payload) as never); },`,
    `    onRefresh: () => { void ${refreshVar}(); },`,
    `  });`,
  ];
};

const renderRegionFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  if (context.plan.regionPlan.regionFetches.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const regionFetch of context.plan.regionPlan.regionFetches) {
    const hasUrlParams = Object.keys(regionFetch.fetchConfig.urlParams).length > 0;
    const urlContextVar = hasUrlParams ? DESIGNER_STORE_VAR : BINDING_CONTEXT_VAR;
    const urlExpression = hasUrlParams
      ? renderFetchUrlExpression(regionFetch.fetchConfig.endpointTemplate, regionFetch.fetchConfig.urlParams, urlContextVar)
      : JSON.stringify(regionFetch.fetchConfig.endpointTemplate);
    const liveMode = context.dataSources[regionFetch.dataSourceId]?.liveMode;
    const needsSetData = isActiveLiveMode(liveMode);
    lines.push(
      needsSetData
        ? `  const { data: raw_${regionFetch.dataVar}, setData: setData_${regionFetch.dataVar}, isLoading: isLoading_${regionFetch.dataVar}, error: error_${regionFetch.dataVar}, refresh: refresh_${regionFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`
        : `  const { data: raw_${regionFetch.dataVar}, isLoading: isLoading_${regionFetch.dataVar}, error: error_${regionFetch.dataVar}, refresh: refresh_${regionFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`,
    );
    if (regionFetch.responseMapping?.dataPath || regionFetch.responseMapping?.arrayPath) {
      const mappingJson = JSON.stringify(regionFetch.responseMapping);
      lines.push(
        `  const ${regionFetch.dataVar} = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_${regionFetch.dataVar}, ${mappingJson})), [raw_${regionFetch.dataVar}]);`,
      );
    } else {
      lines.push(
        `  const ${regionFetch.dataVar} = React.useMemo(() => coerceApiRecordValue(applyResponseDataPath(raw_${regionFetch.dataVar}, undefined)), [raw_${regionFetch.dataVar}]);`,
      );
    }
    lines.push(...renderLiveDataSourceHookLines(
      regionFetch.dataVar,
      regionFetch.fetchConfig.endpointTemplate,
      liveMode,
    ));
  }

  return lines;
};

const renderGridListFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  if (context.plan.gridPlan.gridListFetches.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const gridFetch of context.plan.gridPlan.gridListFetches) {
    // Bug found: the toolbar's search/sort/page/column-filter values were correctly patched into
    // designerStore at runtime, but this URL builder only ever read `fetchConfig.urlParams` — the
    // grid's own `queryParams` (search/sort/page/filter → store path map, from
    // designerGridToolbarConfig.ts's buildGridListQueryParamBindings) was silently dropped, so a
    // published grid's toolbar looked real but never actually affected the request (mirrors the
    // identical bug already found and fixed for charts this session).
    const hasUrlParams = Object.keys(gridFetch.fetchConfig.urlParams).length > 0
      || Object.keys(gridFetch.queryParams ?? {}).length > 0;
    const urlContextVar = hasUrlParams ? DESIGNER_STORE_VAR : BINDING_CONTEXT_VAR;
    const urlExpression = (() => {
      const base = hasUrlParams
        ? renderFetchUrlExpression(
          gridFetch.fetchConfig.endpointTemplate,
          { ...gridFetch.fetchConfig.urlParams, ...(gridFetch.queryParams ?? {}) },
          urlContextVar,
        )
        : JSON.stringify(gridFetch.fetchConfig.endpointTemplate);
      const staticParams = gridFetch.staticQueryParams;
      if (!staticParams || Object.keys(staticParams).length === 0) {
        return base;
      }
      const staticQuery = new URLSearchParams(staticParams).toString();
      return `(() => { const resolved = ${base}; const suffix = ${JSON.stringify(staticQuery)}; if (!suffix) { return resolved; } return resolved.includes("?") ? \`\${resolved}&\${suffix}\` : \`\${resolved}?\${suffix}\`; })()`;
    })();
    lines.push(
      (() => {
        const liveMode = context.dataSources[gridFetch.dataSourceId]?.liveMode;
        const needsSetData = isActiveLiveMode(liveMode);
        return needsSetData
          ? `  const { data: raw_${gridFetch.dataVar}, setData: setData_${gridFetch.dataVar}, isLoading: isLoading_${gridFetch.dataVar}, error: error_${gridFetch.dataVar}, refresh: refresh_${gridFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`
          : `  const { data: raw_${gridFetch.dataVar}, isLoading: isLoading_${gridFetch.dataVar}, error: error_${gridFetch.dataVar}, refresh: refresh_${gridFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`;
      })(),
    );
    if (gridFetch.responseMapping?.arrayPath || gridFetch.responseMapping?.dataPath) {
      const mappingJson = JSON.stringify(gridFetch.responseMapping);
      lines.push(
        `  const ${gridFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${gridFetch.dataVar}, ${mappingJson}), [raw_${gridFetch.dataVar}]);`,
      );
    } else {
      lines.push(
        `  const ${gridFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${gridFetch.dataVar}, undefined), [raw_${gridFetch.dataVar}]);`,
      );
    }
    lines.push(...renderLiveDataSourceHookLines(
      gridFetch.dataVar,
      gridFetch.fetchConfig.endpointTemplate,
      context.dataSources[gridFetch.dataSourceId]?.liveMode,
    ));
  }

  return lines;
};

const renderRepeaterListFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  if (context.plan.repeaterPlan.repeaterListFetches.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const repeaterFetch of context.plan.repeaterPlan.repeaterListFetches) {
    const hasUrlParams = Object.keys(repeaterFetch.fetchConfig.urlParams).length > 0
      || Object.keys(repeaterFetch.queryParams ?? {}).length > 0;
    const urlContextVar = hasUrlParams ? DESIGNER_STORE_VAR : BINDING_CONTEXT_VAR;
    const urlExpression = hasUrlParams
      ? renderFetchUrlExpression(
        repeaterFetch.fetchConfig.endpointTemplate,
        { ...repeaterFetch.fetchConfig.urlParams, ...(repeaterFetch.queryParams ?? {}) },
        urlContextVar,
      )
      : JSON.stringify(repeaterFetch.fetchConfig.endpointTemplate);
    const liveMode = context.dataSources[repeaterFetch.dataSourceId]?.liveMode;
    const needsSetData = isActiveLiveMode(liveMode);
    lines.push(
      needsSetData
        ? `  const { data: raw_${repeaterFetch.dataVar}, setData: setData_${repeaterFetch.dataVar}, isLoading: isLoading_${repeaterFetch.dataVar}, error: error_${repeaterFetch.dataVar}, refresh: refresh_${repeaterFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`
        : `  const { data: raw_${repeaterFetch.dataVar}, isLoading: isLoading_${repeaterFetch.dataVar}, error: error_${repeaterFetch.dataVar}, refresh: refresh_${repeaterFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`,
    );
    if (repeaterFetch.responseMapping?.arrayPath || repeaterFetch.responseMapping?.dataPath) {
      const mappingJson = JSON.stringify(repeaterFetch.responseMapping);
      lines.push(
        `  const ${repeaterFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${repeaterFetch.dataVar}, ${mappingJson}), [raw_${repeaterFetch.dataVar}]);`,
      );
    } else {
      lines.push(
        `  const ${repeaterFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${repeaterFetch.dataVar}, undefined), [raw_${repeaterFetch.dataVar}]);`,
      );
    }
    lines.push(...renderLiveDataSourceHookLines(
      repeaterFetch.dataVar,
      repeaterFetch.fetchConfig.endpointTemplate,
      liveMode,
    ));
  }

  return lines;
};

const renderChartListFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  if (context.plan.chartPlan.chartListFetches.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const chartFetch of context.plan.chartPlan.chartListFetches) {
    const hasUrlParams = Object.keys(chartFetch.fetchConfig.urlParams).length > 0
      || (chartFetch.queryParams && Object.keys(chartFetch.queryParams).length > 0);
    const urlContextVar = hasUrlParams ? DESIGNER_STORE_VAR : BINDING_CONTEXT_VAR;
    const urlExpression = hasUrlParams
      ? renderFetchUrlExpression(
        chartFetch.fetchConfig.endpointTemplate,
        {
          ...chartFetch.fetchConfig.urlParams,
          ...(chartFetch.queryParams ?? {}),
        },
        urlContextVar,
      )
      : JSON.stringify(chartFetch.fetchConfig.endpointTemplate);
    const liveMode = context.dataSources[chartFetch.dataSourceId]?.liveMode;
    const needsSetData = isActiveLiveMode(liveMode);
    lines.push(
      needsSetData
        ? `  const { data: raw_${chartFetch.dataVar}, setData: setData_${chartFetch.dataVar}, isLoading: isLoading_${chartFetch.dataVar}, error: error_${chartFetch.dataVar}, refresh: refresh_${chartFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`
        : `  const { data: raw_${chartFetch.dataVar}, isLoading: isLoading_${chartFetch.dataVar}, error: error_${chartFetch.dataVar}, refresh: refresh_${chartFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`,
    );
    if (chartFetch.responseMapping?.arrayPath || chartFetch.responseMapping?.dataPath) {
      const mappingJson = JSON.stringify(chartFetch.responseMapping);
      lines.push(
        `  const ${chartFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${chartFetch.dataVar}, ${mappingJson}), [raw_${chartFetch.dataVar}]);`,
      );
    } else {
      lines.push(
        `  const ${chartFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${chartFetch.dataVar}, undefined), [raw_${chartFetch.dataVar}]);`,
      );
    }
    lines.push(...renderLiveDataSourceHookLines(
      chartFetch.dataVar,
      chartFetch.fetchConfig.endpointTemplate,
      liveMode,
    ));
  }

  return lines;
};

const renderVizListFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  if (context.plan.vizPlan.vizListFetches.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const vizFetch of context.plan.vizPlan.vizListFetches) {
    const hasUrlParams = Object.keys(vizFetch.fetchConfig.urlParams).length > 0
      || (vizFetch.queryParams && Object.keys(vizFetch.queryParams).length > 0);
    const urlContextVar = hasUrlParams ? DESIGNER_STORE_VAR : BINDING_CONTEXT_VAR;
    const urlExpression = hasUrlParams
      ? renderFetchUrlExpression(
        vizFetch.fetchConfig.endpointTemplate,
        {
          ...vizFetch.fetchConfig.urlParams,
          ...(vizFetch.queryParams ?? {}),
        },
        urlContextVar,
      )
      : JSON.stringify(vizFetch.fetchConfig.endpointTemplate);
    const liveMode = context.dataSources[vizFetch.dataSourceId]?.liveMode;
    const needsSetData = isActiveLiveMode(liveMode);
    lines.push(
      needsSetData
        ? `  const { data: raw_${vizFetch.dataVar}, setData: setData_${vizFetch.dataVar}, isLoading: isLoading_${vizFetch.dataVar}, error: error_${vizFetch.dataVar}, refresh: refresh_${vizFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`
        : `  const { data: raw_${vizFetch.dataVar}, isLoading: isLoading_${vizFetch.dataVar}, error: error_${vizFetch.dataVar}, refresh: refresh_${vizFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`,
    );
    if (vizFetch.responseMapping?.arrayPath || vizFetch.responseMapping?.dataPath) {
      const mappingJson = JSON.stringify(vizFetch.responseMapping);
      lines.push(
        `  const ${vizFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${vizFetch.dataVar}, ${mappingJson}), [raw_${vizFetch.dataVar}]);`,
      );
    } else {
      lines.push(
        `  const ${vizFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${vizFetch.dataVar}, undefined), [raw_${vizFetch.dataVar}]);`,
      );
    }
    lines.push(...renderLiveDataSourceHookLines(
      vizFetch.dataVar,
      vizFetch.fetchConfig.endpointTemplate,
      liveMode,
    ));
  }

  return lines;
};

const renderContentListFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  if (context.plan.contentPlan.contentListFetches.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const contentFetch of context.plan.contentPlan.contentListFetches) {
    const hasUrlParams = Object.keys(contentFetch.fetchConfig.urlParams).length > 0;
    const urlContextVar = hasUrlParams ? DESIGNER_STORE_VAR : BINDING_CONTEXT_VAR;
    const urlExpression = hasUrlParams
      ? renderFetchUrlExpression(
        contentFetch.fetchConfig.endpointTemplate,
        contentFetch.fetchConfig.urlParams,
        urlContextVar,
      )
      : JSON.stringify(contentFetch.fetchConfig.endpointTemplate);
    const liveMode = context.dataSources[contentFetch.dataSourceId]?.liveMode;
    const needsSetData = isActiveLiveMode(liveMode);
    lines.push(
      needsSetData
        ? `  const { data: raw_${contentFetch.dataVar}, setData: setData_${contentFetch.dataVar}, isLoading: isLoading_${contentFetch.dataVar}, error: error_${contentFetch.dataVar}, refresh: refresh_${contentFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`
        : `  const { data: raw_${contentFetch.dataVar}, isLoading: isLoading_${contentFetch.dataVar}, error: error_${contentFetch.dataVar}, refresh: refresh_${contentFetch.dataVar} } = useDataFetch<unknown>(${urlExpression}, {});`,
    );
    if (contentFetch.responseMapping?.arrayPath || contentFetch.responseMapping?.dataPath) {
      const mappingJson = JSON.stringify(contentFetch.responseMapping);
      lines.push(
        `  const ${contentFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${contentFetch.dataVar}, ${mappingJson}), [raw_${contentFetch.dataVar}]);`,
      );
    } else {
      lines.push(
        `  const ${contentFetch.dataVar} = React.useMemo(() => applyResponseDataPath(raw_${contentFetch.dataVar}, undefined), [raw_${contentFetch.dataVar}]);`,
      );
    }
    lines.push(...renderLiveDataSourceHookLines(
      contentFetch.dataVar,
      contentFetch.fetchConfig.endpointTemplate,
      liveMode,
    ));
  }

  return lines;
};

const renderRegionColumnLovFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  if (context.plan.regionPlan.regionColumnLovFetches.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const lovFetch of context.plan.regionPlan.regionColumnLovFetches) {
    const urlExpression = JSON.stringify(lovFetch.fetchConfig.endpointTemplate);
    lines.push(
      `  const { data: ${lovFetch.dataVar}, isLoading: isLoading_${lovFetch.dataVar}, error: error_${lovFetch.dataVar}, refresh: ${lovFetch.refreshVar} } = useDataFetch<Record<string, unknown> | null>(${urlExpression}, {});`,
    );
  }

  return lines;
};

const renderDynamicActionFetchHookLines = (
  context: TsxBindingRenderContext,
): string[] => {
  // Skip any data source that already has a live Region/Grid/Chart/Viz/Repeater fetch —
  // those hooks are rendered by their dedicated renderers; declaring a phantom here would
  // either duplicate the request or leave an unused refresh_* binding that trueActions no
  // longer call (after the item-36 remapping).
  const realFetchDataSourceIds = new Set<string>([
    ...context.plan.regionPlan.regionFetches.map((entry) => entry.dataSourceId),
    ...context.plan.gridPlan.gridListFetches.map((entry) => entry.dataSourceId),
    ...context.plan.chartPlan.chartListFetches.map((entry) => entry.dataSourceId),
    ...context.plan.vizPlan.vizListFetches.map((entry) => entry.dataSourceId),
    ...context.plan.repeaterPlan.repeaterListFetches.map((entry) => entry.dataSourceId),
  ]);
  const lines: string[] = [];

  for (const dynamicFetch of context.dynamicActionFetches) {
    if (realFetchDataSourceIds.has(dynamicFetch.dataSourceId)) {
      continue;
    }

    lines.push(
      `  const { data: ${dynamicFetch.dataVar}, isLoading: isLoading_${dynamicFetch.dataVar}, error: error_${dynamicFetch.dataVar}, refresh: ${dynamicFetch.refreshVar} } = useDataFetch<Record<string, unknown> | null>(${JSON.stringify(dynamicFetch.endpoint)}, {});`,
    );
  }

  return lines;
};

const bindingHasTrueActions = (binding: ResolvedEventBinding): boolean =>
  Boolean(binding.trueActions && binding.trueActions.length > 0);

const renderDynamicActionExecutionLines = (
  binding: ResolvedEventBinding,
  indent: string,
  responseExpression?: string,
): string[] => renderDynamicActionSequenceLines(binding.trueActions, indent, responseExpression);

/**
 * Renders a `trueActions` chain. A `callMutation` action can fail (network/HTTP error) — when it
 * does, the remaining chained actions (e.g. a Delete's `refreshDataSource`/success `showToast`)
 * must not run, so everything after it is nested inside an `if (<mutationOk>) { ... }` guard
 * instead of being emitted as a flat, unconditional sequence like the other action types.
 */
const renderDynamicActionSequenceLines = (
  actions: ResolvedDynamicAction[] | undefined,
  indent: string,
  responseExpression?: string,
): string[] => {
  if (!actions || actions.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]!;

    if (action.type === 'refreshDataSource') {
      lines.push(`${indent}await ${action.refreshVar}();`);
      continue;
    }

    if (action.type === 'setValue') {
      const valueExpression = action.valueSource === 'expression'
        ? compileDynamicActionValueExpression(action.valueExpression ?? '')
        : JSON.stringify(action.staticValue ?? '');
      lines.push(`${indent}${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(action.storePath)}, ${valueExpression});`);
      continue;
    }

    if (action.type === 'showToast') {
      const optionsParts: string[] = [];
      if (action.toastDescription) {
        optionsParts.push(`description: ${JSON.stringify(action.toastDescription)}`);
      }
      if (action.toastVariant) {
        optionsParts.push(`variant: ${JSON.stringify(action.toastVariant)}`);
      }
      if (typeof action.toastDuration === 'number') {
        optionsParts.push(`timeout: ${action.toastDuration}`);
      }
      const optionsLiteral = optionsParts.length > 0 ? `{ ${optionsParts.join(', ')} }` : '{}';
      lines.push(`${indent}toast(${JSON.stringify(action.toastTitle)}, ${optionsLiteral});`);
      continue;
    }

    if (action.type === 'callMutation') {
      const recordIdExpression = action.mutationRecordIdStorePath
        ? resolveStorePathExpression(action.mutationRecordIdStorePath)
        : null;
      const urlExpression = resolveMutationUrlExpressionForCodegen(action.endpoint, recordIdExpression);
      const mutationOkVar = `mutationOk_${action.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      lines.push(`${indent}let ${mutationOkVar} = true;`);
      lines.push(`${indent}try {`);
      lines.push(`${indent}  const response = await ${DESIGNER_FETCH_VAR}(${urlExpression}, {`);
      lines.push(`${indent}    method: ${JSON.stringify(action.method)},`);
      lines.push(`${indent}    headers: { 'Content-Type': 'application/json' },`);
      if (action.mutationOperation !== 'delete' && action.method !== 'DELETE') {
        lines.push(`${indent}    body: JSON.stringify(${resolveMutationBodyExpressionForCodegen(action.mutationBody ?? {})}),`);
      }
      lines.push(`${indent}  });`);
      lines.push(`${indent}  if (!response.ok) {`);
      lines.push(`${indent}    toast(await parseApiErrorMessage(response), { variant: 'danger' });`);
      lines.push(`${indent}    ${mutationOkVar} = false;`);
      lines.push(`${indent}  }`);
      lines.push(`${indent}} catch (mutationFailure) {`);
      lines.push(`${indent}  toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });`);
      lines.push(`${indent}  ${mutationOkVar} = false;`);
      lines.push(`${indent}}`);

      const remainingActions = actions.slice(index + 1);
      if (remainingActions.length > 0) {
        lines.push(`${indent}if (${mutationOkVar}) {`);
        lines.push(...renderDynamicActionSequenceLines(remainingActions, `${indent}  `, responseExpression));
        lines.push(`${indent}}`);
      }
      return lines;
    }

    if (action.type === 'resetForm') {
      const selectorExpression = JSON.stringify(`[data-designer-node-id="${action.targetNodeId}"]`);
      lines.push(`${indent}(document.querySelector(${selectorExpression}) as HTMLFormElement | null)?.reset?.();`);
      continue;
    }

    if (action.type === 'navigate') {
      const pathExpression = resolveNavigateTargetExpressionForCodegen(action.navigateTarget, responseExpression);
      lines.push(`${indent}navigate(${pathExpression}, { replace: ${action.navigateReplace ? 'true' : 'false'} });`);
      continue;
    }

    if (action.type === 'updateFilterFromClick') {
      const valueExpression = action.filterValueSource === 'expression'
        ? compileDynamicActionValueExpression(action.filterValueExpression ?? '')
        : action.filterValueSource === 'clickSeriesKey'
          ? '((event.target as { seriesKey?: unknown } | null)?.seriesKey ?? \'\')'
          : '((event.target as { category?: unknown; value?: unknown } | null)?.category ?? (event.target as { value?: unknown } | null)?.value ?? \'\')';
      lines.push(`${indent}${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(action.filterStorePath)}, ${valueExpression});`);
      continue;
    }

    if (action.type === 'exportData') {
      const payloadVar = `exportPayload_${action.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      lines.push(`${indent}const ${payloadVar} = resolveRegisteredDesignerExportPayload(${JSON.stringify(action.exportSource)});`);
      lines.push(`${indent}if (!${payloadVar}) {`);
      lines.push(`${indent}  toast('Nothing to export — bind a grid or chart first.', { variant: 'warning' });`);
      lines.push(`${indent}} else {`);
      lines.push(`${indent}  try {`);
      lines.push(`${indent}    await exportDesignerData({`);
      lines.push(`${indent}      format: ${JSON.stringify(action.exportFormat)},`);
      lines.push(`${indent}      rows: ${payloadVar}.rows,`);
      lines.push(`${indent}      columns: ${payloadVar}.columns,`);
      lines.push(`${indent}      filename: ${JSON.stringify(action.exportFilename ?? 'export')},`);
      lines.push(`${indent}    });`);
      lines.push(`${indent}  } catch (exportFailure) {`);
      lines.push(`${indent}    toast(exportFailure instanceof Error ? exportFailure.message : 'Export failed', { variant: 'danger' });`);
      lines.push(`${indent}  }`);
      lines.push(`${indent}}`);
      continue;
    }

    if (action.type === 'triggerWorkflow') {
      const workflowOkVar = `workflowOk_${action.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const inputExpression = renderWorkflowInputExpressionForCodegen(
        action.payloadMapping,
        DESIGNER_STORE_VAR,
      );
      lines.push(`${indent}let ${workflowOkVar} = true;`);
      lines.push(`${indent}try {`);
      lines.push(`${indent}  const response = await ${DESIGNER_FETCH_VAR}(${JSON.stringify(action.endpoint)}, {`);
      lines.push(`${indent}    method: 'POST',`);
      lines.push(`${indent}    headers: { 'Content-Type': 'application/json' },`);
      lines.push(`${indent}    body: JSON.stringify({ input: ${inputExpression}, startType: 'MANUAL_API' }),`);
      lines.push(`${indent}  });`);
      lines.push(`${indent}  if (!response.ok) {`);
      lines.push(`${indent}    toast(await parseApiErrorMessage(response), { variant: 'danger' });`);
      lines.push(`${indent}    ${workflowOkVar} = false;`);
      lines.push(`${indent}  }`);
      lines.push(`${indent}} catch (workflowFailure) {`);
      lines.push(`${indent}  toast(workflowFailure instanceof Error ? workflowFailure.message : 'Workflow start failed', { variant: 'danger' });`);
      lines.push(`${indent}  ${workflowOkVar} = false;`);
      lines.push(`${indent}}`);

      const remainingActions = actions.slice(index + 1);
      if (remainingActions.length > 0) {
        lines.push(`${indent}if (${workflowOkVar}) {`);
        lines.push(...renderDynamicActionSequenceLines(remainingActions, `${indent}  `, responseExpression));
        lines.push(`${indent}}`);
      }
      return lines;
    }

    if (action.type === 'showHide') {
      if (action.showHideEffect === 'show') {
        lines.push(`${indent}${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(action.visibilityStorePath)}, true);`);
      } else if (action.showHideEffect === 'hide') {
        lines.push(`${indent}${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(action.visibilityStorePath)}, false);`);
      } else {
        lines.push(
          `${indent}${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(action.visibilityStorePath)}, !${resolveStorePathExpression(action.visibilityStorePath)});`,
        );
      }
    }
  }

  return lines;
};

const collectDynamicActionHandlerDeps = (binding: ResolvedEventBinding): string[] => {
  const deps = new Set<string>();

  if (binding.trueActions?.some((action) => action.type === 'setValue' || action.type === 'showHide')) {
    deps.add(DESIGNER_STORE_PATCH_VAR);
  }

  for (const action of binding.trueActions ?? []) {
    if (action.type === 'refreshDataSource') {
      deps.add(action.refreshVar);
    }
    if (action.type === 'navigate') {
      deps.add('navigate');
    }
  }

  if (binding.storeWritePath) {
    deps.add(DESIGNER_STORE_PATCH_VAR);
  }

  if (deps.size === 0) {
    return [];
  }

  return Array.from(deps);
};

const resolveDynamicActionsOnlyHandlerSignature = (targetEvent: string): string => {
  switch (targetEvent) {
    case 'onSubmit':
      return 'async (event: React.FormEvent<HTMLFormElement>)';
    case 'onChange':
    case 'onSelectionChange':
    case 'onCheckedChange':
    case 'onAction':
    case 'onDataPointClick':
    case 'onTaskDrag':
      return '(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>)';
    case 'onBlur':
      return '(event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>)';
    case 'onClick':
      return 'async (event: React.MouseEvent<HTMLElement>)';
    case 'onKeyDown':
    case 'onKeyUp':
      return 'async (event: React.KeyboardEvent<HTMLElement>)';
    case 'onSortChange':
      return 'async (descriptor: { column?: string; direction?: string } | null)';
    case 'onPageChange':
      return 'async (nextPage: number)';
    default:
      return 'async (event: Event)';
  }
};

const renderDynamicActionsOnlyHandlerLines = (
  binding: ResolvedEventBinding,
  handlerName: string,
): string[] => {
  const lines: string[] = [];
  const signature = resolveDynamicActionsOnlyHandlerSignature(binding.targetEvent);
  const usesAsyncRefresh = binding.trueActions?.some(
    (action) => (
      action.type === 'refreshDataSource'
      || action.type === 'callMutation'
      || action.type === 'exportData'
      || action.type === 'triggerWorkflow'
    ),
  ) ?? false;
  lines.push(`  const ${handlerName} = React.useCallback(${signature} => {`);
  if (usesAsyncRefresh) {
    lines.push('    void (async () => {');
    lines.push(...renderDynamicActionExecutionLines(binding, '      '));
    lines.push('    })();');
  } else {
    lines.push(...renderDynamicActionExecutionLines(binding, '    '));
  }
  lines.push(`  }, [${collectDynamicActionHandlerDeps(binding).join(', ')}]);`);
  return lines;
};

const renderInvalidateQueriesLines = (
  binding: ResolvedEventBinding,
  context: TsxBindingRenderContext,
  indent: string,
): string[] => {
  const queryKeys = binding.definition.invalidateQueries ?? [];
  const lines: string[] = [];

  for (const queryKey of queryKeys) {
    const refreshVar = resolveFetchRefreshVar(queryKey.trim(), context);
    if (!refreshVar) {
      continue;
    }

    lines.push(`${indent}await ${refreshVar}();`);
  }

  return lines;
};

const createDebounceTimerVar = (binding: ResolvedEventBinding): string =>
  `debounceTimer_${sanitizeHandlerSuffix(binding.nodeId)}_${sanitizeHandlerSuffix(binding.targetEvent)}`;

const renderDebounceTimerRefLines = (bindings: ResolvedEventBinding[]): string[] => {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const binding of bindings) {
    const debounceMs = binding.definition.debounceMs;
    if (!debounceMs || debounceMs <= 0 || !binding.endpoint) {
      continue;
    }

    const timerVar = createDebounceTimerVar(binding);
    if (seen.has(timerVar)) {
      continue;
    }

    seen.add(timerVar);
    lines.push(`  const ${timerVar} = React.useRef<ReturnType<typeof setTimeout> | null>(null);`);
  }

  return lines;
};

const isFormNode = (node: DesignerNode): boolean => {
  const paletteItemId = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  if (paletteItemId === 'html.form') {
    return true;
  }

  return node.type === 'container' && resolveDesignerHtmlTag(node, 'div') === 'form';
};

const formHasSubmitMutation = (formNodeId: string, context: TsxBindingRenderContext): boolean =>
  context.plan.eventBindings.some(
    (binding) => binding.nodeId === formNodeId
      && binding.targetEvent === 'onSubmit'
      && (Boolean(binding.endpoint) || Boolean(binding.regionSubmitPlan)),
  );

const isRegionSubmitButton = (node: DesignerNode, context: TsxBindingRenderContext): boolean =>
  context.plan.eventBindings.some(
    (binding) => binding.nodeId === node.id
      && binding.targetEvent === 'onClick'
      && Boolean(binding.regionSubmitPlan),
  );

export const isSubmitButtonInsideMutationForm = (
  node: DesignerNode,
  context: TsxBindingRenderContext,
): boolean => {
  const buttonType = readString(node.props.type).trim().toLowerCase();
  if (buttonType !== 'submit') {
    return false;
  }

  let parentId = node.parentId;
  while (parentId) {
    const parent = context.document.nodes[parentId];
    if (!parent) {
      break;
    }

    if (isFormNode(parent) && formHasSubmitMutation(parent.id, context)) {
      return true;
    }

    parentId = parent.parentId;
  }

  return false;
};

export const resolveSubmitButtonIsDisabledValue = (
  node: DesignerNode,
  context: TsxBindingRenderContext,
): TsxBindingRawExpression | undefined => {
  if (!isSubmitButtonInsideMutationForm(node, context) && !isRegionSubmitButton(node, context)) {
    return undefined;
  }

  const staticallyDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  if (staticallyDisabled) {
    return tsxBindingRawExpr('isSubmitting || true');
  }

  return tsxBindingRawExpr('isSubmitting');
};

/**
 * Bug found (parity audit item P3.14): `isRequired`/`pattern`/`minLength`/`maxLength`/
 * `min`/`max`/`validationRule` are real, working, submission-BLOCKING validation in the live
 * preview (`previewFieldValidation.ts`'s `validateDesignerFieldNode`, wired into
 * `bindingMutationRuntime.ts`'s `executeDesignerRegionSubmit`/`executeDesignerFormSubmit`) —
 * but the exported/published `.tsx` bundle's Region submit handlers
 * (`renderRegionSubmitEventHandlerLines` below) never called any validation at all, so an
 * exported Create/Edit form always submitted regardless of these Inspector-configured rules.
 * Fixed by reusing the exact same `validateDesignerFieldNode` function (refactored to take a
 * plain `props` bag instead of a full `DesignerNode`, since that's all it ever read) with a
 * literal, per-field props subset baked in at export time — mirroring the same
 * "codegen-time-resolved literal config, not a runtime document blob" pattern already used for
 * App Table Grid's row-action dispatch.
 *
 * Scope: only the Region-bound submit path (`regionSubmitPlan`) is covered here, since that's
 * the only path with a reliable nodeId <-> form-field-name association at export time (a
 * region-bound field's `name` attribute IS its nodeId — see `resolveRegionFormFieldNameAttribute`
 * above). The plain/manual-`payloadMapping` `onSubmit` path has no such association (its
 * `formFieldName`s are freely authored strings with no guaranteed link back to a specific
 * node), so it is deliberately left as-is — flagged in the final summary, not silently dropped.
 */
type FieldValidationCodegenEntry = {
  nodeId: string;
  formFieldName: string;
  props: DesignerNode['props'];
};

const VALIDATION_RELEVANT_PROP_KEYS = [
  'isRequired',
  'required',
  'errorMessage',
  'validationRule',
  'validationErrorMessage',
  'minLength',
  'maxLength',
  'pattern',
  'min',
  'max',
] as const;

const nodeHasFieldValidationConstraints = (node: DesignerNode): boolean => {
  if (readBoolean(node.props.isRequired) || readBoolean(node.props.required)) {
    return true;
  }
  if (readString(node.props.validationRule).trim().length > 0) {
    return true;
  }
  if (Number.isFinite(readNumber(node.props.minLength, Number.NaN))) {
    return true;
  }
  if (Number.isFinite(readNumber(node.props.maxLength, Number.NaN))) {
    return true;
  }
  if (readString(node.props.pattern).trim().length > 0) {
    return true;
  }
  if (getNodePaletteItemId(node) === 'heroui.number-input') {
    if (readString(node.props.min).trim().length > 0 || readString(node.props.max).trim().length > 0) {
      return true;
    }
  }
  return false;
};

const resolveFieldValidationEntriesForPlan = (
  plan: NonNullable<ResolvedEventBinding['regionSubmitPlan']>,
  document: DesignerDocument,
): FieldValidationCodegenEntry[] => {
  const entries: FieldValidationCodegenEntry[] = [];
  for (const mapping of plan.fieldMappings) {
    const node = document.nodes[mapping.nodeId];
    if (!node || !nodeHasFieldValidationConstraints(node)) {
      continue;
    }
    const props: DesignerNode['props'] = { _designerPaletteItemId: getNodePaletteItemId(node) ?? '' };
    for (const key of VALIDATION_RELEVANT_PROP_KEYS) {
      if (node.props[key] !== undefined) {
        props[key] = node.props[key];
      }
    }
    entries.push({ nodeId: mapping.nodeId, formFieldName: mapping.formFieldName, props });
  }
  return entries;
};

export const documentHasRegionFieldValidationConstraints = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition> = {},
): boolean => {
  const registry = normalizeBindingDefinitions(bindingDefinitions);
  const plan = collectDocumentBindingPlan(document, registry);
  return plan.eventBindings.some(
    (binding) => binding.regionSubmitPlan
      && resolveFieldValidationEntriesForPlan(binding.regionSubmitPlan, document).length > 0,
  );
};

const renderFieldValidationLines = (
  entries: FieldValidationCodegenEntry[],
  formDataVar: string,
  indent: string,
): string[] => {
  if (entries.length === 0) {
    return [];
  }

  const entriesLiteral = JSON.stringify(
    entries.map((entry) => ({ nodeId: entry.nodeId, formFieldName: entry.formFieldName, props: entry.props })),
  );

  return [
    `${indent}const fieldValidationEntries = ${entriesLiteral} as Array<{ nodeId: string; formFieldName: string; props: Record<string, unknown> }>;`,
    `${indent}const fieldValidationErrors: Record<string, string> = {};`,
    `${indent}for (const entry of fieldValidationEntries) {`,
    `${indent}  const rawValue = ${formDataVar}.get(entry.formFieldName);`,
    `${indent}  const validationMessage = validateDesignerFieldNode(entry.props, typeof rawValue === 'string' ? rawValue : '');`,
    `${indent}  if (validationMessage) {`,
    `${indent}    fieldValidationErrors[entry.nodeId] = validationMessage;`,
    `${indent}  }`,
    `${indent}}`,
    `${indent}if (Object.keys(fieldValidationErrors).length > 0) {`,
    // Surface blocked submissions as a danger toast (same channel as mutation failures) —
    // never an inline page banner.
    `${indent}  toast(Object.values(fieldValidationErrors).join(' '), { variant: 'danger' });`,
    `${indent}  return;`,
    `${indent}}`,
  ];
};

// Bug found while building a full document end-to-end: the Inspector's Cross-Field Validation
// panel (InspectorContentRecordsField.tsx) always stores this prop as a JSON *string*
// (`content-records` field type, same contract as columns/toolbarConfig) — but this reader
// checked `Array.isArray(rules)` directly on the raw string, which is always false. Cross-field
// validation therefore never actually fired in Export, even when correctly configured through
// the UI. Fixed: parse the string (still accept a raw array for direct construction callers,
// e.g. tests/scripts that build a document without going through the Inspector).
export const resolveCrossFieldRulesForRegion = (
  document: DesignerDocument,
  regionNodeId: string,
): CrossFieldRule[] => {
  const node = document.nodes[regionNodeId];
  if (!node) return [];
  const rules = node.props.crossFieldValidationRules;
  if (Array.isArray(rules)) {
    return rules.length > 0 ? rules as CrossFieldRule[] : [];
  }
  if (typeof rules === 'string' && rules.trim().length > 0) {
    try {
      const parsed = JSON.parse(rules) as unknown;
      return Array.isArray(parsed) ? parsed as CrossFieldRule[] : [];
    } catch {
      return [];
    }
  }
  return [];
};

const renderCrossFieldValidationLines = (
  rules: CrossFieldRule[],
  formDataVar: string,
  indent: string,
): string[] => {
  if (rules.length === 0) return [];

  const rulesLiteral = JSON.stringify(rules);

  return [
    `${indent}const crossFieldRules = ${rulesLiteral} as Array<{ id: string; fields: string[]; rule: string; expression?: string; errorMessageKey: string; appliesTo: string }>;`,
    `${indent}const crossFieldErrors: string[] = [];`,
    `${indent}for (const cfRule of crossFieldRules) {`,
    `${indent}  const cfVals = cfRule.fields.map((f: string) => ${formDataVar}.get(f) ?? '');`,
    `${indent}  let cfFailed = false;`,
    `${indent}  switch (cfRule.rule) {`,
    `${indent}    case 'equals': cfFailed = !cfVals.every((v: unknown) => v === cfVals[0]); break;`,
    `${indent}    case 'notEquals': cfFailed = cfVals.length >= 2 && cfVals[0] === cfVals[1]; break;`,
    `${indent}    case 'greaterThan': { const a = Number(cfVals[0]), b = Number(cfVals[1]); cfFailed = !isNaN(a) && !isNaN(b) && !(a > b); break; }`,
    `${indent}    case 'lessThan': { const a = Number(cfVals[0]), b = Number(cfVals[1]); cfFailed = !isNaN(a) && !isNaN(b) && !(a < b); break; }`,
    `${indent}    default: break;`,
    `${indent}  }`,
    `${indent}  if (cfFailed) crossFieldErrors.push(cfRule.errorMessageKey || 'Validation failed.');`,
    `${indent}}`,
    `${indent}if (crossFieldErrors.length > 0) {`,
    `${indent}  toast(crossFieldErrors.join(' '), { variant: 'danger' });`,
    `${indent}  return;`,
    `${indent}}`,
  ];
};

const renderRegionSubmitPayloadLines = (
  fieldMappings: Array<{ column: string; formFieldName: string; payloadTransform?: string }>,
  indent: string,
): string[] => {
  const lines: string[] = [`${indent}const payload: Record<string, unknown> = {};`];
  for (const mapping of fieldMappings) {
    const rawValueExpression = `formData.get(${JSON.stringify(mapping.formFieldName)})`;
    const valueExpression = mapping.payloadTransform
      ? `applyPayloadFieldTransform(${rawValueExpression}, ${JSON.stringify(mapping.payloadTransform)})`
      : `${rawValueExpression} ?? ''`;
    lines.push(
      `${indent}payload[${JSON.stringify(mapping.column)}] = ${valueExpression};`,
    );
  }
  return lines;
};

const renderRegionSubmitFetchLines = (
  urlExpression: string,
  methodExpression: string,
  indent: string,
  bodyExpression: string,
  responseStorePath?: string,
): string[] => {
  const lines = [
    `${indent}const response = await ${DESIGNER_FETCH_VAR}(${urlExpression}, {`,
    `${indent}  method: ${methodExpression},`,
    `${indent}  headers: { 'Content-Type': 'application/json' },`,
    `${indent}  body: JSON.stringify(${bodyExpression}),`,
    `${indent}});`,
    `${indent}if (!response.ok) {`,
    `${indent}  throw new Error(await parseApiErrorMessage(response));`,
    `${indent}}`,
  ];
  if (responseStorePath) {
    lines.push(
      `${indent}const mutationResponse = await response.clone().json().catch(() => null);`,
      `${indent}${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(responseStorePath)}, mutationResponse);`,
    );
  }
  return lines;
};

const renderRegionSubmitFormDataLines = (
  plan: NonNullable<ResolvedEventBinding['regionSubmitPlan']>,
  indent: string,
): string[] => {
  const fieldNamesJson = JSON.stringify(plan.fieldMappings.map((mapping) => mapping.formFieldName));
  return [
    `${indent}let formData: FormData;`,
    `${indent}const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : event.currentTarget.closest('form');`,
    `${indent}if (form) {`,
    `${indent}  formData = new FormData(form);`,
    `${indent}} else {`,
    `${indent}  const regionRoot = document.querySelector(${JSON.stringify(`[data-designer-node-id="${plan.regionNodeId}"]`)});`,
    `${indent}  if (!regionRoot) {`,
    `${indent}    return;`,
    `${indent}  }`,
    `${indent}  formData = collectRegionFormDataFromContainer(regionRoot, ${fieldNamesJson});`,
    `${indent}}`,
  ];
};

const renderRegionSubmitEventHandlerLines = (
  binding: ResolvedEventBinding,
  handlerName: string,
  document: DesignerDocument,
): string[] => {
  const plan = binding.regionSubmitPlan;
  if (!plan) {
    return [];
  }

  const methodExpression = resolveRegionDmlMethodExpression(plan.dataVar, plan.primaryKey, plan.updateMethod);
  const urlExpression = resolveRegionDmlUrlExpressionForPlan(plan.dataVar, plan);
  const payloadFieldMappings = plan.fieldMappings.map((mapping) => ({
    column: mapping.column,
    formFieldName: mapping.formFieldName,
    payloadTransform: mapping.payloadTransform
      ?? binding.definition.payloadFieldTransforms?.[mapping.column],
  }));
  const deps = plan.primaryKey ? `[${plan.dataVar}]` : '[]';
  const validationEntries = resolveFieldValidationEntriesForPlan(plan, document);
  const crossRules = resolveCrossFieldRulesForRegion(document, plan.regionNodeId);
  const responseStorePath = binding.definition.responseStorePath?.trim();
  const lines: string[] = [];

  if (binding.targetEvent === 'onSubmit') {
    lines.push(`  const ${handlerName} = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {`);
    lines.push('    event.preventDefault();');
    lines.push('    const formData = new FormData(event.currentTarget);');
    lines.push(...renderFieldValidationLines(validationEntries, 'formData', '    '));
    lines.push(...renderCrossFieldValidationLines(crossRules, 'formData', '    '));
    lines.push('    setIsSubmitting(true);');
    lines.push('    try {');
    lines.push(...renderRegionSubmitPayloadLines(payloadFieldMappings, '      '));
    lines.push(`      const method = ${methodExpression};`);
    lines.push(`      const url = ${urlExpression};`);
    lines.push(...renderRegionSubmitFetchLines('url', 'method', '      ', 'payload', responseStorePath));
    lines.push(...renderDynamicActionExecutionLines(binding, '      ', responseStorePath ? 'mutationResponse' : undefined));
    lines.push(...renderMutationCatchLines('    '));
    lines.push('    finally {');
    lines.push('      setIsSubmitting(false);');
    lines.push('    }');
    lines.push(`  }, ${deps});`);
    return lines;
  }

  lines.push(`  const ${handlerName} = React.useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {`);
  lines.push('    event.preventDefault();');
  lines.push(...renderRegionSubmitFormDataLines(plan, '    '));
  lines.push(...renderFieldValidationLines(validationEntries, 'formData', '    '));
  lines.push(...renderCrossFieldValidationLines(crossRules, 'formData', '    '));
  lines.push('    setIsSubmitting(true);');
  lines.push('    try {');
  lines.push(...renderRegionSubmitPayloadLines(payloadFieldMappings, '      '));
  lines.push(`      const method = ${methodExpression};`);
  lines.push(`      const url = ${urlExpression};`);
  lines.push(...renderRegionSubmitFetchLines('url', 'method', '      ', 'payload', responseStorePath));
  lines.push(...renderDynamicActionExecutionLines(binding, '      ', responseStorePath ? 'mutationResponse' : undefined));
  lines.push(...renderMutationCatchLines('    '));
  lines.push('    finally {');
  lines.push('      setIsSubmitting(false);');
  lines.push('    }');
  lines.push(`  }, ${deps});`);
  return lines;
};

const renderFormDataPayloadLines = (
  payloadMapping: Record<string, string>,
  indent: string,
  fieldTransforms?: Record<string, string>,
): string[] => {
  const lines: string[] = [`${indent}const payload: Record<string, unknown> = {};`];

  for (const [apiPath, formField] of Object.entries(payloadMapping)) {
    const transform = fieldTransforms?.[apiPath];
    const rawValueExpression = `formData.get(${JSON.stringify(formField)})`;
    const valueExpression = transform
      ? `applyPayloadFieldTransform(${rawValueExpression}, ${JSON.stringify(transform)})`
      : `${rawValueExpression} ?? ''`;
    if (isNestedPayloadPath(apiPath)) {
      lines.push(`${indent}setNestedPayloadValue(payload, ${JSON.stringify(apiPath)}, ${valueExpression});`);
    } else {
      lines.push(`${indent}payload[${JSON.stringify(apiPath)}] = ${valueExpression};`);
    }
  }

  return lines;
};

const renderMutationFetchLines = (
  binding: ResolvedEventBinding,
  indent: string,
  bodyExpression: string,
  context: TsxBindingRenderContext,
): string[] => {
  const urlExpression = renderMutationUrlExpression(binding.endpoint!, binding.urlParams);
  const headersExpression = renderMutationHeadersExpression(binding.headers, binding.urlParams);

  return [
    `${indent}const response = await ${DESIGNER_FETCH_VAR}(${urlExpression}, {`,
    `${indent}  method: ${JSON.stringify(binding.actionType)},`,
    `${indent}  headers: ${headersExpression},`,
    `${indent}  body: JSON.stringify(${bodyExpression}),`,
    `${indent}});`,
    `${indent}if (!response.ok) {`,
    `${indent}  throw new Error(await parseApiErrorMessage(response));`,
    `${indent}}`,
    ...renderInvalidateQueriesLines(binding, context, indent),
  ];
};

const renderMutationCatchLines = (indent: string): string[] => [
  `${indent}} catch (mutationFailure) {`,
  `${indent}  toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' });`,
  `${indent}}`,
];

const renderStorePatchLines = (binding: ResolvedEventBinding, indent: string): string[] => {
  const storePath = binding.storeWritePath?.trim()
    || (typeof binding.definition.storeWritePath === 'string' ? binding.definition.storeWritePath.trim() : '');
  if (!storePath) {
    return [];
  }

  return renderStorePatchStatement(
    {
      bindingKey: binding.bindingKey,
      nodeId: binding.nodeId,
      targetEvent: binding.targetEvent,
      storePath,
      definition: binding.definition,
    },
    indent,
  );
};

const renderSubmitEventHandlerLines = (
  binding: ResolvedEventBinding,
  handlerName: string,
  context: TsxBindingRenderContext,
): string[] => {
  if (bindingHasTrueActions(binding) && !binding.endpoint && !binding.regionSubmitPlan && !binding.storeWritePath) {
    return renderDynamicActionsOnlyHandlerLines(binding, handlerName);
  }

  const lines: string[] = [];
  lines.push(`  const ${handlerName} = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {`);
  lines.push('    event.preventDefault();');

  if (!binding.endpoint) {
    lines.push(...renderStorePatchLines(binding, '    '));
    lines.push(...renderDynamicActionExecutionLines(binding, '    '));
    lines.push(`  }, [${collectDynamicActionHandlerDeps(binding).join(', ') || DESIGNER_STORE_PATCH_VAR}]);`);
    return lines;
  }

  const mutationBody = [
    '    setIsSubmitting(true);',
    '    try {',
    ...renderStorePatchLines(binding, '      '),
    '      const formData = new FormData(event.currentTarget);',
    ...(binding.payloadMapping && Object.keys(binding.payloadMapping).length > 0
      ? [
        ...renderFormDataPayloadLines(
          binding.payloadMapping,
          '      ',
          binding.payloadFieldTransforms as Record<string, string> | undefined,
        ),
        ...renderMutationFetchLines(binding, '      ', 'payload', context),
      ]
      : [
        '      const payload = Object.fromEntries(formData.entries());',
        ...renderMutationFetchLines(binding, '      ', 'payload', context),
      ]),
    ...renderInvalidateQueriesLines(binding, context, '      '),
    ...renderDynamicActionExecutionLines(binding, '      '),
    ...renderMutationCatchLines('    '),
    '    finally {',
    '      setIsSubmitting(false);',
    '    }',
  ];

  lines.push(...mutationBody);
  lines.push(`  }, [${BINDING_CONTEXT_VAR}]);`);
  return lines;
};

const renderValueEventHandlerLines = (
  binding: ResolvedEventBinding,
  handlerName: string,
  context: TsxBindingRenderContext,
): string[] => {
  if (bindingHasTrueActions(binding) && !binding.endpoint && !binding.storeWritePath) {
    return renderDynamicActionsOnlyHandlerLines(binding, handlerName);
  }

  const eventType = binding.targetEvent === 'onBlur'
    ? 'React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>'
    : 'React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>';
  const lines: string[] = [];
  lines.push(`  const ${handlerName} = React.useCallback((event: ${eventType}) => {`);

  if (!binding.endpoint) {
    lines.push(...renderStorePatchLines(binding, '    '));
    // Bug found (CRM 3c — a custom `onCardMove` event carries both `storeWritePath` and
    // `trueActions`, so it skips `renderDynamicActionsOnlyHandlerLines` above and lands here):
    // this branch emitted `await`-using dynamic-action lines (e.g. `callMutation`) inside a
    // non-`async` `React.useCallback`, which is an invalid-syntax generated component — it
    // would fail to even parse in the browser. Same fix as `renderDynamicActionsOnlyHandlerLines`:
    // wrap in a `void (async () => {...})()` IIFE when any trueAction needs to be awaited.
    const usesAsyncAction = binding.trueActions?.some(
      (action) => (
        action.type === 'refreshDataSource'
        || action.type === 'callMutation'
        || action.type === 'exportData'
        || action.type === 'triggerWorkflow'
      ),
    ) ?? false;
    if (usesAsyncAction) {
      lines.push('    void (async () => {');
      lines.push(...renderDynamicActionExecutionLines(binding, '      '));
      lines.push('    })();');
    } else {
      lines.push(...renderDynamicActionExecutionLines(binding, '    '));
    }
    lines.push(`  }, [${collectDynamicActionHandlerDeps(binding).join(', ') || DESIGNER_STORE_PATCH_VAR}]);`);
    return lines;
  }

  const emitMutationBody = (indent: string): string[] => [
    `${indent}setIsSubmitting(true);`,
    `${indent}try {`,
    ...renderStorePatchLines(binding, `${indent}  `),
    `${indent}  const payload = { value: event.target.value };`,
    ...renderMutationFetchLines(binding, `${indent}  `, 'payload', context),
    ...renderInvalidateQueriesLines(binding, context, `${indent}  `),
    ...renderDynamicActionExecutionLines(binding, `${indent}  `),
    ...renderMutationCatchLines(indent),
    `${indent}finally {`,
    `${indent}  setIsSubmitting(false);`,
    `${indent}}`,
  ];

  const debounceMs = binding.definition.debounceMs;
  if (debounceMs && debounceMs > 0) {
    const timerVar = createDebounceTimerVar(binding);
    lines.push(`    if (${timerVar}.current) {`);
    lines.push(`      clearTimeout(${timerVar}.current);`);
    lines.push('    }');
    lines.push(`    ${timerVar}.current = setTimeout(async () => {`);
    lines.push(...emitMutationBody('      '));
    lines.push(`    }, ${debounceMs});`);
    lines.push(`  }, [${BINDING_CONTEXT_VAR}, ${timerVar}]);`);
    return lines;
  }

  lines.push(...emitMutationBody('    '));
  lines.push(`  }, [${BINDING_CONTEXT_VAR}]);`);
  return lines;
};

const renderKeyboardEventHandlerLines = (
  binding: ResolvedEventBinding,
  handlerName: string,
  context: TsxBindingRenderContext,
): string[] => {
  if (bindingHasTrueActions(binding) && !binding.endpoint && !binding.storeWritePath) {
    return renderDynamicActionsOnlyHandlerLines(binding, handlerName);
  }

  const lines: string[] = [];
  lines.push(`  const ${handlerName} = React.useCallback(async (event: React.KeyboardEvent) => {`);

  if (!binding.endpoint) {
    lines.push(...renderStorePatchLines(binding, '    '));
    lines.push(...renderDynamicActionExecutionLines(binding, '    '));
    lines.push(`  }, [${collectDynamicActionHandlerDeps(binding).join(', ') || DESIGNER_STORE_PATCH_VAR}]);`);
    return lines;
  }

  lines.push('    setIsSubmitting(true);');
  lines.push('    try {');
  lines.push(...renderStorePatchLines(binding, '      '));
  lines.push('      const payload = { key: event.key, code: event.code };');
  lines.push(...renderMutationFetchLines(binding, '      ', 'payload', context));
  lines.push(...renderInvalidateQueriesLines(binding, context, '      '));
  lines.push(...renderDynamicActionExecutionLines(binding, '      '));
  lines.push(...renderMutationCatchLines('    '));
  lines.push('    finally {');
  lines.push('      setIsSubmitting(false);');
  lines.push('    }');
  lines.push(`  }, [${BINDING_CONTEXT_VAR}]);`);
  return lines;
};

const renderGridEventHandlerLines = (
  binding: ResolvedEventBinding,
  handlerName: string,
  context: TsxBindingRenderContext,
): string[] => {
  if (bindingHasTrueActions(binding) && !binding.endpoint && !binding.storeWritePath) {
    return renderDynamicActionsOnlyHandlerLines(binding, handlerName);
  }

  const payloadShape = binding.targetEvent === 'onSortChange'
    ? '{ sortColumn: descriptor?.column, sortDirection: descriptor?.direction }'
    : '{ page: nextPage }';
  // Bug found: `eventType` already included its own "paramName: Type" pair, but the signature
  // line below wrapped it in a SECOND "paramName: " prefix — producing invalid syntax like
  // `async (nextPage: nextPage: number)` / `async (descriptor: sortDescriptor: {...})`, which
  // failed to compile for any grid/data-grid with a real (non-dynamic-action-only) mutation
  // bound to onSortChange/onPageChange.
  const eventType = binding.targetEvent === 'onSortChange'
    ? '{ column?: string; direction?: string } | null'
    : 'number';
  const lines: string[] = [];
  lines.push(`  const ${handlerName} = React.useCallback(async (${binding.targetEvent === 'onSortChange' ? 'descriptor' : 'nextPage'}: ${eventType}) => {`);

  if (!binding.endpoint) {
    lines.push(...renderStorePatchLines(binding, '    '));
    lines.push(...renderDynamicActionExecutionLines(binding, '    '));
    lines.push(`  }, [${collectDynamicActionHandlerDeps(binding).join(', ') || DESIGNER_STORE_PATCH_VAR}]);`);
    return lines;
  }

  lines.push('    setIsSubmitting(true);');
  lines.push('    try {');
  lines.push(...renderStorePatchLines(binding, '      '));
  lines.push(`      const payload = ${payloadShape};`);
  lines.push(...renderMutationFetchLines(binding, '      ', 'payload', context));
  lines.push(...renderInvalidateQueriesLines(binding, context, '      '));
  lines.push(...renderDynamicActionExecutionLines(binding, '      '));
  lines.push(...renderMutationCatchLines('    '));
  lines.push('    finally {');
  lines.push('      setIsSubmitting(false);');
  lines.push('    }');
  lines.push(`  }, [${BINDING_CONTEXT_VAR}]);`);
  return lines;
};

const renderSimpleEventHandlerLines = (
  binding: ResolvedEventBinding,
  handlerName: string,
  context: TsxBindingRenderContext,
): string[] => {
  if (bindingHasTrueActions(binding) && !binding.endpoint && !binding.storeWritePath) {
    return renderDynamicActionsOnlyHandlerLines(binding, handlerName);
  }

  const lines: string[] = [];
  lines.push(`  const ${handlerName} = React.useCallback(async (event: React.MouseEvent<HTMLElement>) => {`);

  if (!binding.endpoint) {
    lines.push(...renderStorePatchLines(binding, '    '));
    lines.push(...renderDynamicActionExecutionLines(binding, '    '));
    lines.push(`  }, [${collectDynamicActionHandlerDeps(binding).join(', ') || DESIGNER_STORE_PATCH_VAR}]);`);
    return lines;
  }

  const urlExpression = renderMutationUrlExpression(binding.endpoint, binding.urlParams);
  const headersExpression = renderFetchHeadersExpression(binding.headers, binding.urlParams);

  lines.push('    setIsSubmitting(true);');
  lines.push('    try {');
  lines.push(...renderStorePatchLines(binding, '      '));
  lines.push(`      const response = await ${DESIGNER_FETCH_VAR}(${urlExpression}, {`);
  lines.push(`        method: ${JSON.stringify(binding.actionType)},`);
  lines.push(`        headers: ${headersExpression},`);
  lines.push('      });');
  lines.push('      if (!response.ok) {');
  lines.push('        throw new Error(await parseApiErrorMessage(response));');
  lines.push('      }');
  lines.push(...renderInvalidateQueriesLines(binding, context, '      '));
  lines.push(...renderDynamicActionExecutionLines(binding, '      '));
  lines.push(...renderMutationCatchLines('    '));
  lines.push('    finally {');
  lines.push('      setIsSubmitting(false);');
  lines.push('    }');
  lines.push(`  }, [${BINDING_CONTEXT_VAR}]);`);
  return lines;
};

const renderGridDetailRowActionHandlerLines = (
  flows: ResolvedGridDetailFlow[],
): string[] => {
  if (flows.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const flow of flows) {
    lines.push(`  const ${flow.handlerName} = React.useCallback(async (row: Record<string, unknown>, actionId: string) => {`);
    lines.push(`    if (actionId !== ${JSON.stringify(flow.config.rowActionId)}) {`);
    lines.push('      return;');
    lines.push('    }');
    lines.push(`    ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(flow.config.selectionStorePath)}, row[${JSON.stringify(flow.config.primaryKeyField)}] ?? null);`);
    lines.push(`    ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityStorePathForNode(flow.config.detailModalNodeId))}, true);`);
    lines.push(`    await ${flow.detailRefreshVar}();`);
    lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}, ${flow.detailRefreshVar}]);`);
  }

  return lines;
};

/**
 * Bug found: `renderAppTableGridCustomJsx` (tsxPhase2Palette.ts) unconditionally emitted
 * `onGridRowAction={handleGridRowAction_<id>}` whenever an App Table Grid had ANY action column,
 * but `renderGridDetailRowActionHandlerLines` only ever declares that handler for the single
 * legacy "detail-flow" scenario — a grid using arbitrary `open-modal` row actions (the normal
 * way to wire Edit/Delete) referenced an undeclared variable, a compile error. This renders one
 * combined handler per App Table Grid node covering every configured action's real behavior
 * (`open-modal` → the same 2 store patches `open-modal` already uses elsewhere; the grid's own
 * detail-flow action, if any → the existing patch+refresh sequence) under the SAME handler name
 * `renderAppTableGridCustomJsx` already references, so no other codegen needs to change.
 */
const renderAppTableGridRowActionHandlerLines = (
  document: DesignerDocument,
  appTableGridFlows: ResolvedGridDetailFlow[],
): string[] => {
  const flowByGridNodeId = new Map(appTableGridFlows.map((flow) => [flow.gridNodeId, flow]));
  const lines: string[] = [];

  for (const node of Object.values(document.nodes)) {
    if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
      continue;
    }

    const columns = parseDesignerAppTableGridColumns(node.props.columns);
    const actions = collectGridRowActionsFromColumns(columns);
    const flow = flowByGridNodeId.get(node.id);

    if (actions.length === 0 && !flow) {
      continue;
    }

    const handlerName = resolveGridDetailRowActionHandlerName(node.id);
    const deps = new Set<string>([DESIGNER_STORE_PATCH_VAR]);
    const needsAwait = Boolean(flow);
    const handledActionIds = new Set<string>();

    lines.push(`  const ${handlerName} = React.useCallback(${needsAwait ? 'async ' : ''}(row: Record<string, unknown>, actionId: string) => {`);
    lines.push('    switch (actionId) {');

    for (const action of actions) {
      const behavior = action.behavior;
      if (behavior?.kind === 'open-modal' && behavior.modalNodeId) {
        const primaryKeyField = behavior.primaryKeyField?.trim() || 'id';
        const selectionStorePath = behavior.selectionStorePath?.trim() || 'selection.id';
        lines.push(`      case ${JSON.stringify(action.actionId)}: {`);
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(selectionStorePath)}, row[${JSON.stringify(primaryKeyField)}] ?? null);`);
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityStorePathForNode(behavior.modalNodeId))}, true);`);
        lines.push('        return;');
        lines.push('      }');
        handledActionIds.add(action.actionId);
      } else if (behavior?.kind === 'navigate' && behavior.navigateTarget?.trim()) {
        const primaryKeyField = behavior.primaryKeyField?.trim() || 'id';
        const selectionStorePath = behavior.selectionStorePath?.trim() || 'selection.id';
        lines.push(`      case ${JSON.stringify(action.actionId)}: {`);
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(selectionStorePath)}, row[${JSON.stringify(primaryKeyField)}] ?? null);`);
        lines.push(`        navigate(${resolveNavigateTargetExpressionForCodegen(behavior.navigateTarget.trim())}, { replace: ${behavior.navigateReplace ? 'true' : 'false'} });`);
        lines.push('        return;');
        lines.push('      }');
        handledActionIds.add(action.actionId);
        deps.add('navigate');
      } else if (behavior?.kind === 'callMutation' && behavior.dataSourceRef?.trim()) {
        lines.push(`      case ${JSON.stringify(action.actionId)}: {`);
        lines.push('        // callMutation row actions are handled at preview runtime; export falls back to no-op.');
        lines.push('        return;');
        lines.push('      }');
        handledActionIds.add(action.actionId);
      } else if (behavior?.kind === 'none') {
        handledActionIds.add(action.actionId);
      } else if (behavior?.kind === 'detail-flow' && flow) {
        // Preview's executeConfiguredBehavior runs the grid's detail-flow for ANY action whose
        // behavior.kind is detail-flow, regardless of whether actionId matches flow.rowActionId
        // (parity audit item 71). Emit an explicit case per such actionId.
        lines.push(`      case ${JSON.stringify(action.actionId)}: {`);
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(flow.config.selectionStorePath)}, row[${JSON.stringify(flow.config.primaryKeyField)}] ?? null);`);
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityStorePathForNode(flow.config.detailModalNodeId))}, true);`);
        lines.push(`        await ${flow.detailRefreshVar}();`);
        lines.push('        return;');
        lines.push('      }');
        handledActionIds.add(action.actionId);
        deps.add(flow.detailRefreshVar);
      }
      // behavior undefined — resolved below via the grid's own detail flow rowActionId case.
    }

    if (flow && !handledActionIds.has(flow.config.rowActionId)) {
      lines.push(`      case ${JSON.stringify(flow.config.rowActionId)}: {`);
      lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(flow.config.selectionStorePath)}, row[${JSON.stringify(flow.config.primaryKeyField)}] ?? null);`);
      lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityStorePathForNode(flow.config.detailModalNodeId))}, true);`);
      lines.push(`        await ${flow.detailRefreshVar}();`);
      lines.push('        return;');
      lines.push('      }');
      deps.add(flow.detailRefreshVar);
    }

    lines.push('      default:');
    lines.push('        return;');
    lines.push('    }');
    lines.push(`  }, [${Array.from(deps).join(', ')}]);`);
  }

  return lines;
};

/**
 * Bug found (parity audit item 70): Export always passed `cellClickHandlerRef: { current: undefined }`
 * into `buildAppTableGridColumns`, so rich cells with `cellClickBehavior` looked clickable but
 * never fired. Mirror Preview's `executeDesignerGridCellClick` with per-column cases known at build time.
 */
const renderAppTableGridCellClickHandlerLines = (
  document: DesignerDocument,
  appTableGridFlows: ResolvedGridDetailFlow[],
): string[] => {
  const flowByGridNodeId = new Map(appTableGridFlows.map((flow) => [flow.gridNodeId, flow]));
  const lines: string[] = [];

  for (const node of Object.values(document.nodes)) {
    if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
      continue;
    }

    const columns = parseDesignerAppTableGridColumns(node.props.columns);
    const clickableColumns = columns.filter((column) => (
      Boolean(column.cellClickActionId?.trim())
      || Boolean(column.cellClickBehavior && column.cellClickBehavior.kind !== 'none')
    ));
    if (clickableColumns.length === 0) {
      continue;
    }

    const names = resolveAppTableGridVarNames(node.id);
    const flow = flowByGridNodeId.get(node.id);
    const rowActionHandler = resolveGridDetailRowActionHandlerName(node.id);
    const hasRowActionHandler = collectGridRowActionsFromColumns(columns).length > 0 || Boolean(flow);
    const deps = new Set<string>([DESIGNER_STORE_PATCH_VAR]);
    if (hasRowActionHandler) {
      deps.add(rowActionHandler);
    }
    if (flow) {
      deps.add(flow.detailRefreshVar);
    }

    lines.push(`  const ${names.cellClickHandler} = React.useCallback(async (row: Record<string, unknown>, column: { key?: string; id?: string }) => {`);
    lines.push('    const columnKey = String(column.key ?? column.id ?? \'\');');
    lines.push('    switch (columnKey) {');

    for (const column of clickableColumns) {
      const actionId = column.cellClickActionId?.trim();
      lines.push(`      case ${JSON.stringify(column.key)}: {`);
      if (actionId && hasRowActionHandler) {
        lines.push(`        await ${rowActionHandler}(row, ${JSON.stringify(actionId)});`);
        lines.push('        return;');
      } else if (column.cellClickBehavior?.kind === 'open-modal' && column.cellClickBehavior.modalNodeId) {
        const primaryKeyField = column.cellClickBehavior.primaryKeyField?.trim() || 'id';
        const selectionStorePath = column.cellClickBehavior.selectionStorePath?.trim() || 'selection.id';
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(selectionStorePath)}, row[${JSON.stringify(primaryKeyField)}] ?? null);`);
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityStorePathForNode(column.cellClickBehavior.modalNodeId))}, true);`);
        lines.push('        return;');
      } else if (column.cellClickBehavior?.kind === 'detail-flow' && flow) {
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(flow.config.selectionStorePath)}, row[${JSON.stringify(flow.config.primaryKeyField)}] ?? null);`);
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityStorePathForNode(flow.config.detailModalNodeId))}, true);`);
        lines.push(`        await ${flow.detailRefreshVar}();`);
        lines.push('        return;');
      } else if (column.cellClickBehavior?.kind === 'hwy-family-household') {
        deps.add('openHwyFamilyHouseholdFromGridRow');
        lines.push('        openHwyFamilyHouseholdFromGridRow(row, columnKey, column);');
        lines.push('        return;');
      } else if (column.cellClickBehavior?.kind === 'navigate' && column.cellClickBehavior.navigateTarget?.trim()) {
        const primaryKeyField = column.cellClickBehavior.primaryKeyField?.trim() || 'id';
        const selectionStorePath = column.cellClickBehavior.selectionStorePath?.trim() || 'selection.id';
        lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(selectionStorePath)}, row[${JSON.stringify(primaryKeyField)}] ?? null);`);
        lines.push(`        navigate(${resolveNavigateTargetExpressionForCodegen(column.cellClickBehavior.navigateTarget.trim())}, { replace: ${column.cellClickBehavior.navigateReplace ? 'true' : 'false'} });`);
        lines.push('        return;');
        deps.add('navigate');
      } else {
        lines.push('        return;');
      }
      lines.push('      }');
    }

    lines.push('      default:');
    lines.push('        return;');
    lines.push('    }');
    lines.push(`  }, [${Array.from(deps).join(', ')}]);`);
  }

  return lines;
};

/**
 * Bug found: the exported App Table Grid never passed `columns`/`rows`/`getRowKey` to the real
 * `<AppTableGrid>` component at all (only an inert `columnsMeta` JSON string, which isn't a real
 * prop) — the published grid didn't render, and TypeScript rejects the missing required props.
 * The footer's pagination/sort controls were also 100% hardcoded/non-functional
 * (`safePage={1}`, `sortBy=""`, `onPageChange={() => {}}`, ...). This renders one block of real
 * `React.useState`/`useMemo` hooks per App Table Grid node — reusing the exact same pure helpers
 * and `buildAppTableGridColumns` column-builder the live canvas/preview already uses (see
 * `DesignerRuntimeAppTableGrid.tsx`) — so the exported grid gets real rich-cell/action/disable-rule
 * rendering and a genuinely interactive footer, not a hand-rewritten parallel implementation.
 */
const renderAppTableGridStateHookLines = (
  document: DesignerDocument,
  context: TsxBindingRenderContext,
  appTableGridFlows: ResolvedGridDetailFlow[],
  usesDesignerStore: boolean,
): string[] => {
  const flowByGridNodeId = new Map(appTableGridFlows.map((flow) => [flow.gridNodeId, flow]));
  const lines: string[] = [];

  for (const node of Object.values(document.nodes)) {
    if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
      continue;
    }

    const names = resolveAppTableGridVarNames(node.id);
    const columns = parseDesignerAppTableGridColumns(node.props.columns);
    const gridQueryMode = readString(node.props.gridQueryMode, 'server') === 'client' ? 'client' : 'server';
    const pageSize = readNumber(node.props.pageSize, 50);
    const page = readNumber(node.props.page, 1);
    const designTimeTotal = readNumber(node.props.total, 0);
    const listModeDefault = readString(node.props.listMode, 'paging') === 'infinite' ? 'infinite' : 'paging';
    const toolbarConfig = normalizeDesignerGridToolbarConfig(parseDesignerGridToolbarConfig(node.props.toolbarConfig) ?? {});
    const aggregationConfig = parseGridAggregationConfig(node.props.gridAggregationConfig);
    const aggregationEnabled = isGridAggregationEnabled(aggregationConfig);
    const toolbarEnabled = toolbarConfig.enabled === true;
    const serverQueryEnabled = toolbarConfig.serverQuery?.enabled === true;
    const effectiveGridQueryMode = resolveEffectiveAppTableGridQueryMode(gridQueryMode, serverQueryEnabled);

    const actions = collectGridRowActionsFromColumns(columns);
    const flow = flowByGridNodeId.get(node.id);
    const hasRowActionHandler = actions.length > 0 || Boolean(flow);
    const handlerName = hasRowActionHandler ? resolveGridDetailRowActionHandlerName(node.id) : undefined;
    const hasCellClickHandler = columns.some((column) => (
      Boolean(column.cellClickActionId?.trim())
      || Boolean(column.cellClickBehavior && column.cellClickBehavior.kind !== 'none')
    ));
    const cellClickHandlerName = hasCellClickHandler ? names.cellClickHandler : undefined;

    const designerStoreArg = usesDesignerStore || toolbarEnabled ? DESIGNER_STORE_VAR : 'undefined';

    const rowsBinding = resolveNodePropertyBindingExpression(node.id, 'rows', context);
    const rowsExpr = rowsBinding ? `(${rowsBinding} ?? [])` : '([] as Record<string, unknown>[])';

    const gridFetch = context.plan.gridPlan.gridListFetches.find((entry) => entry.nodeId === node.id);
    const totalPath = gridFetch?.responseMapping?.totalPath?.trim();

    const columnsMemoDeps = [designerStoreArg, handlerName, cellClickHandlerName]
      .filter((entry): entry is string => Boolean(entry) && entry !== 'undefined');
    const usesGridCulture = appTableGridNodeUsesCultureKeys(node);
    const usesColumnTranslation = columns.some((column) => Boolean(column.labelTranslationKey?.trim()));
    if (usesGridCulture || usesColumnTranslation) {
      columnsMemoDeps.push('culture');
    }

    lines.push(`  const ${names.columns} = React.useMemo(() => buildAppTableGridColumns(${JSON.stringify(columns)}, ${JSON.stringify(effectiveGridQueryMode)}, {`);
    lines.push("    mode: 'runtime',");
    lines.push(`    detailFlowRef: { current: ${flow ? JSON.stringify(flow.config) : 'null'} },`);
    lines.push(`    rowActionHandlerRef: { current: ${handlerName ?? 'undefined'} },`);
    lines.push(`    cellClickHandlerRef: { current: ${cellClickHandlerName ?? 'undefined'} },`);
    lines.push(`    designerStoreRef: { current: ${designerStoreArg} },`);
    if (usesGridCulture || usesColumnTranslation) {
      lines.push('    translate: (key) => culture.t(key),');
    }
    const gridListScopeLegacy = gridFetch
      ? parseHwyMemberDirectoryGridListScopeLegacy(gridFetch.queryParams as Record<string, string>)
      : null;
    if (gridListScopeLegacy) {
      lines.push(`    hwyMemberDirectoryListScopeLegacy: ${JSON.stringify(gridListScopeLegacy)},`);
    }
    lines.push(`  }), [${columnsMemoDeps.join(', ')}]);`);

    const sortOptions = parseDesignerGridSortOptions(node.props.sortOptions);
    const usesSortTranslation = sortOptions.some((option) => Boolean(option.labelTranslationKey?.trim()));
    if (usesSortTranslation) {
      lines.push(`  const ${names.sortOptions} = React.useMemo(() => ${JSON.stringify(sortOptions)}.map((option) => ({ value: option.value, label: option.labelTranslationKey ? culture.t(option.labelTranslationKey) : option.label })), [culture]);`);
    }

    if (toolbarEnabled) {
      const toolbarFieldFilters = resolveEffectiveFieldFilters(toolbarConfig);
      for (const filter of toolbarFieldFilters) {
        if (filter.optionsSource !== 'lov' || !filter.lovRef?.trim()) {
          continue;
        }
        const lov = context.lovs[filter.lovRef.trim()];
        if (!lov?.endpoint?.trim()) {
          continue;
        }
        const dataVar = names.toolbarLovData(filter.id);
        lines.push(`  const { data: ${dataVar} } = useDataFetch<unknown>(${JSON.stringify(lov.endpoint.trim())}, {});`);
      }
    }
    // Bug found (parity audit item 13): the live canvas/interactive Preview
    // (DesignerRuntimeAppTableGrid.tsx) seeds the initial sort from `defaultSortBy` (falling back
    // to the first configured sort option, then the first column, then "id"), but the exported
    // state hook always started from a bare `EMPTY_GRID_QUERY` (sort: null) with no reference to
    // `defaultSortBy` anywhere — a published grid always opened unsorted regardless of the
    // Inspector's "Default Sort Field" setting.
    const defaultSortBy = readString(node.props.defaultSortBy, sortOptions[0]?.value ?? columns[0]?.key ?? 'id');
    const defaultSortDirection = readString(node.props.defaultSortDirection, 'asc') === 'desc' ? 'desc' : 'asc';
    const initialQueryExpr = defaultSortBy
      ? `{ ...EMPTY_GRID_QUERY, sort: { columnId: ${JSON.stringify(defaultSortBy)}, direction: ${JSON.stringify(defaultSortDirection)} } }`
      : 'EMPTY_GRID_QUERY';
    lines.push(`  const [${names.query}, ${names.setQuery}] = React.useState<GridQueryState>(() => (${initialQueryExpr}));`);
    lines.push(`  const [${names.page}, ${names.setPage}] = React.useState(${Math.max(1, Math.floor(page))});`);
    lines.push(`  const [${names.pageSize}, ${names.setPageSize}] = React.useState(${Math.max(1, Math.floor(pageSize))});`);
    lines.push(`  const [${names.listMode}, ${names.setListMode}] = React.useState<'paging' | 'infinite'>(${JSON.stringify(listModeDefault)});`);
    lines.push(`  const [${names.columnLayout}, ${names.setColumnLayout}] = React.useState(() => createDefaultColumnLayout(${names.columns}));`);

    if (toolbarEnabled) {
      lines.push(`  const [${names.searchInput}, ${names.setSearchInput}] = React.useState('');`);
      lines.push(`  const [${names.debouncedSearch}, ${names.setDebouncedSearch}] = React.useState('');`);
      const fieldFilters = resolveEffectiveFieldFilters(toolbarConfig);
      const initialCheckboxSelections = Object.fromEntries(
        fieldFilters
          .filter((filter) => filter.controlType === 'checkbox-group')
          .map((filter) => [
            filter.id,
            Object.fromEntries(resolveFieldFilterStaticOptions(filter).map((option) => [option.value, false])),
          ]),
      );
      const initialRadioSelections = Object.fromEntries(
        fieldFilters
          .filter((filter) => filter.controlType === 'radio-group' || filter.controlType === 'select')
          .map((filter) => {
            const options = resolveFieldFilterStaticOptions(filter);
            const defaultValue = filter.defaultValue?.trim() ?? '';
            const initial = defaultValue && options.some((option) => option.value === defaultValue)
              ? defaultValue
              : '';
            return [filter.id, initial];
          }),
      );
      const initialMatchLogic = Object.fromEntries(
        fieldFilters
          .filter((filter) => fieldFilterSupportsMatchLogic(filter))
          .map((filter) => [filter.id, filter.matchLogic ?? DEFAULT_FILTER_MATCH_LOGIC]),
      );
      // Keep legacy roleFilters alias for the first roles checkbox filter (older generated tests).
      const rolesFilter = fieldFilters.find((filter) => (
        filter.controlType === 'checkbox-group'
        && (filter.field === 'roles' || filter.id === 'roles' || filter.apiParam === 'roleNames')
      ));
      const initialRoleFilters = rolesFilter
        ? Object.fromEntries(resolveFieldFilterStaticOptions(rolesFilter).map((option) => [option.value, false]))
        : Object.fromEntries((toolbarConfig.roleFilters?.roles ?? []).map((role) => [role, false]));
      lines.push(`  const [${names.checkboxSelections}, ${names.setCheckboxSelections}] = React.useState<Record<string, Record<string, boolean>>>(${JSON.stringify(initialCheckboxSelections)});`);
      lines.push(`  const [${names.radioSelections}, ${names.setRadioSelections}] = React.useState<Record<string, string>>(${JSON.stringify(initialRadioSelections)});`);
      lines.push(`  const [${names.matchLogicByFilterId}, ${names.setMatchLogicByFilterId}] = React.useState<Record<string, 'and' | 'or'>>(${JSON.stringify(initialMatchLogic)});`);
      lines.push(`  const ${names.roleFilters} = ${rolesFilter
        ? `${names.checkboxSelections}[${JSON.stringify(rolesFilter.id)}] ?? ${JSON.stringify(initialRoleFilters)}`
        : JSON.stringify(initialRoleFilters)};`);
    }

    const queriedRowsExpr = `applyClientGridQuery(${rowsExpr}, ${names.query}, ${names.columns}, ${JSON.stringify(effectiveGridQueryMode)})`;
    if (toolbarEnabled && !serverQueryEnabled) {
      const fieldFiltersJson = JSON.stringify(resolveEffectiveFieldFilters(toolbarConfig));
      lines.push(`  const ${names.filteredRows} = React.useMemo(() => applyDesignerGridToolbarClientFilters(${queriedRowsExpr}, { searchText: ${names.debouncedSearch}, fieldFilters: ${fieldFiltersJson} as any, checkboxSelections: ${names.checkboxSelections}, radioSelections: ${names.radioSelections}, matchLogicByFilterId: ${names.matchLogicByFilterId}, roleFilters: ${names.roleFilters} }), [${names.query}, ${names.columns}, ${names.debouncedSearch}, ${names.checkboxSelections}, ${names.radioSelections}, ${names.matchLogicByFilterId}, ${names.roleFilters}]);`);
    } else {
      lines.push(`  const ${names.filteredRows} = React.useMemo(() => ${queriedRowsExpr}, [${names.query}, ${names.columns}]);`);
    }

    if (aggregationEnabled && aggregationConfig) {
      const configForCodegen = {
        ...aggregationConfig,
        ...(aggregationConfig.collapsibleGroups ? { collapsibleGroups: true } : {}),
      };
      if (!configForCodegen.collapsibleGroups) {
        delete (configForCodegen as { collapsibleGroups?: boolean }).collapsibleGroups;
      }
      lines.push(`  const ${names.aggregatedRows} = React.useMemo(() => applyGridAggregation(${names.filteredRows}, ${JSON.stringify(configForCodegen)}), [${names.filteredRows}]);`);
    } else {
      lines.push(`  const ${names.aggregatedRows} = ${names.filteredRows};`);
    }

    const shouldRegisterExport = toolbarConfig.export?.enabled === true
      || toolbarConfig.showExportButton === true
      || documentUsesExportDataAction(document);
    if (shouldRegisterExport) {
      // Phase 48 — publish filtered/sorted rows so Dynamic Action `exportData` / toolbar Export
      // always download the live view, not the raw dataset.
      lines.push(`  React.useEffect(() => registerDesignerExportSource('gridListResource', ${JSON.stringify(node.id)}, () => ({`);
      lines.push(`    rows: ${names.filteredRows} as Record<string, unknown>[],`);
      lines.push(`    filename: ${JSON.stringify(`grid-${node.id}`)},`);
      lines.push('  })), [' + names.filteredRows + ']);');
    }

    if (totalPath && gridFetch) {
      lines.push(`  const ${names.apiTotal} = React.useMemo(() => {`);
      lines.push(`    const raw = raw_${gridFetch.dataVar};`);
      lines.push(`    const value = readNestedContextValue((raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}), ${JSON.stringify(totalPath)});`);
      lines.push('    const parsed = typeof value === \'number\' ? value : Number(value);');
      lines.push(`    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : ${designTimeTotal};`);
      lines.push(`  }, [raw_${gridFetch.dataVar}]);`);
      lines.push(`  const ${names.totalCount} = resolveDataGridTotalCount({ page: ${names.page}, pageSize: ${names.pageSize}, total: ${names.apiTotal}, gridQueryMode: ${JSON.stringify(effectiveGridQueryMode)} }, ${names.aggregatedRows}.length);`);
    } else {
      lines.push(`  const ${names.totalCount} = resolveDataGridTotalCount({ page: ${names.page}, pageSize: ${names.pageSize}, total: ${designTimeTotal}, gridQueryMode: ${JSON.stringify(effectiveGridQueryMode)} }, ${names.aggregatedRows}.length);`);
    }
    lines.push(`  const ${names.paging} = sliceDataGridRowsForDisplay(${names.aggregatedRows}, ${names.page}, ${names.pageSize}, ${names.totalCount}, ${JSON.stringify(effectiveGridQueryMode)});`);

    lines.push(`  const handleGridQueryChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((nextQuery: GridQueryState) => {`);
    lines.push(`    ${names.setQuery}(nextQuery);`);
    lines.push(`    ${names.setPage}(1);`);
    if (toolbarEnabled && serverQueryEnabled) {
      lines.push(`    ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(toolbarConfig.serverQuery?.sortByStorePath ?? 'gridQuery.sortBy')}, nextQuery.sort?.columnId ?? '');`);
      lines.push(`    ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(toolbarConfig.serverQuery?.sortDirStorePath ?? 'gridQuery.sortDir')}, nextQuery.sort?.direction ?? '');`);
    }
    lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}]);`);

    lines.push(`  const handleGridPageChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((nextPage: number) => {`);
    lines.push(`    ${names.setPage}(nextPage);`);
    if (toolbarEnabled && serverQueryEnabled) {
      lines.push(`    ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(toolbarConfig.serverQuery?.pageStorePath ?? 'gridQuery.page')}, nextPage);`);
    }
    lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}]);`);

    lines.push(`  const handleGridPageSizeChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((nextSize: number) => {`);
    lines.push(`    ${names.setPageSize}(nextSize);`);
    lines.push(`    ${names.setPage}(1);`);
    if (toolbarEnabled && serverQueryEnabled) {
      lines.push(`    ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(toolbarConfig.serverQuery?.pageSizeStorePath ?? 'gridQuery.pageSize')}, nextSize);`);
    }
    lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}]);`);

    lines.push(`  const handleGridSortByChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((nextSortBy: string) => {`);
    lines.push(`    ${names.setQuery}((current: GridQueryState) => ({ ...current, sort: nextSortBy ? { columnId: nextSortBy, direction: current.sort?.direction ?? 'asc' } : null }));`);
    lines.push('  }, []);');

    lines.push(`  const handleGridToggleSortDirection_${sanitizeHandlerSuffix(node.id)} = React.useCallback(() => {`);
    lines.push(`    ${names.setQuery}((current: GridQueryState) => (current.sort ? { ...current, sort: { ...current.sort, direction: current.sort.direction === 'asc' ? 'desc' : 'asc' } } : current));`);
    lines.push('  }, []);');

    if (toolbarEnabled) {
      if (toolbarConfig.search?.enabled) {
        // Bug found (parity audit item 14): debounce store patch; also reset page + update
        // debouncedSearch for client-fallback filtering (items 74/76).
        const searchDebounceMs = toolbarConfig.search.debounceMs ?? 300;
        const searchDebounceTimerVar = `searchDebounceTimer_${sanitizeHandlerSuffix(node.id)}`;
        lines.push(`  const ${searchDebounceTimerVar} = React.useRef<ReturnType<typeof setTimeout> | null>(null);`);
        lines.push(`  const handleGridSearchChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((nextValue: string) => {`);
        lines.push(`    ${names.setSearchInput}(nextValue);`);
        lines.push(`    if (${searchDebounceTimerVar}.current) {`);
        lines.push(`      clearTimeout(${searchDebounceTimerVar}.current);`);
        lines.push('    }');
        lines.push(`    ${searchDebounceTimerVar}.current = setTimeout(() => {`);
        lines.push(`      ${names.setDebouncedSearch}(nextValue);`);
        lines.push(`      ${names.setPage}(1);`);
        lines.push(`      ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(toolbarConfig.search.storePath ?? 'gridToolbar.search')}, nextValue);`);
        lines.push(`    }, ${searchDebounceMs});`);
        lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}]);`);
      }

      if (resolveEffectiveFieldFilters(toolbarConfig).some((filter) => filter.controlType === 'checkbox-group')) {
        lines.push(`  const handleGridCheckboxFilterChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((filterId: string, optionValue: string, checked: boolean) => {`);
        lines.push(`    ${names.setCheckboxSelections}((current: Record<string, Record<string, boolean>>) => {`);
        lines.push('      const next = { ...current, [filterId]: { ...(current[filterId] ?? {}), [optionValue]: checked } };');
        lines.push(`      ${names.setPage}(1);`);
        for (const filter of resolveEffectiveFieldFilters(toolbarConfig).filter((entry) => entry.controlType === 'checkbox-group')) {
          lines.push(`      if (filterId === ${JSON.stringify(filter.id)}) {`);
          lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(filter.storePath)}, Object.entries(next[${JSON.stringify(filter.id)}] ?? {}).filter(([, isChecked]) => isChecked).map(([value]) => value).join(','));`);
          lines.push('      }');
        }
        lines.push('      return next;');
        lines.push('    });');
        lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}]);`);

        // Legacy alias used by older export toolbar markup.
        lines.push(`  const handleGridRoleFilterChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((role: string, checked: boolean) => {`);
        const rolesFilterForHandler = resolveEffectiveFieldFilters(toolbarConfig).find((filter) => (
          filter.controlType === 'checkbox-group'
          && (filter.field === 'roles' || filter.id === 'roles' || filter.apiParam === 'roleNames')
        ));
        if (rolesFilterForHandler) {
          lines.push(`    handleGridCheckboxFilterChange_${sanitizeHandlerSuffix(node.id)}(${JSON.stringify(rolesFilterForHandler.id)}, role, checked);`);
        }
        lines.push(`  }, [handleGridCheckboxFilterChange_${sanitizeHandlerSuffix(node.id)}]);`);
      }

      if (resolveEffectiveFieldFilters(toolbarConfig).some((filter) => fieldFilterSupportsMatchLogic(filter))) {
        lines.push(`  const handleGridMatchLogicChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((filterId: string, nextLogic: 'and' | 'or') => {`);
        lines.push(`    ${names.setMatchLogicByFilterId}((current: Record<string, 'and' | 'or'>) => {`);
        lines.push('      const next = { ...current, [filterId]: nextLogic };');
        for (const filter of resolveEffectiveFieldFilters(toolbarConfig).filter((entry) => fieldFilterSupportsMatchLogic(entry))) {
          const matchStorePath = filter.matchLogicStorePath
            ?? defaultMatchLogicStorePathForFieldFilter(filter);
          lines.push(`      if (filterId === ${JSON.stringify(filter.id)}) {`);
          lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(matchStorePath)}, nextLogic);`);
          lines.push('      }');
        }
        lines.push('      return next;');
        lines.push('    });');
        lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}]);`);
      }

      if (resolveEffectiveFieldFilters(toolbarConfig).some((filter) => (
        filter.controlType === 'radio-group' || filter.controlType === 'select'
      ))) {
        lines.push(`  const handleGridRadioFilterChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((filterId: string, value: string) => {`);
        lines.push(`    ${names.setRadioSelections}((current: Record<string, string>) => {`);
        lines.push('      const next = { ...current, [filterId]: value };');
        lines.push(`      ${names.setPage}(1);`);
        for (const filter of resolveEffectiveFieldFilters(toolbarConfig).filter((entry) => (
          entry.controlType === 'radio-group' || entry.controlType === 'select'
        ))) {
          lines.push(`      if (filterId === ${JSON.stringify(filter.id)}) {`);
          lines.push(`        ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(filter.storePath)}, value);`);
          lines.push('      }');
        }
        lines.push('      return next;');
        lines.push('    });');
        lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}]);`);
      }

      // Legacy roleFilters-only documents without fieldFilters after normalize still get a handler.
      if (
        toolbarConfig.roleFilters?.enabled
        && !resolveEffectiveFieldFilters(toolbarConfig).some((filter) => filter.controlType === 'checkbox-group')
      ) {
        lines.push(`  const handleGridRoleFilterChange_${sanitizeHandlerSuffix(node.id)} = React.useCallback((role: string, checked: boolean) => {`);
        lines.push(`    ${names.setCheckboxSelections}((current: Record<string, Record<string, boolean>>) => {`);
        lines.push(`      const nextForRoles = { ...(current.roles ?? {}), [role]: checked };`);
        lines.push(`      const next = { ...current, roles: nextForRoles };`);
        lines.push(`      ${names.setPage}(1);`);
        lines.push(`      ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(toolbarConfig.roleFilters.storePath ?? 'gridToolbar.roleNames')}, Object.entries(nextForRoles).filter(([, isChecked]) => isChecked).map(([roleName]) => roleName).join(','));`);
        lines.push('      return next;');
        lines.push('    });');
        lines.push(`  }, [${DESIGNER_STORE_PATCH_VAR}]);`);
      }
    }

    lines.push('');
  }

  return lines;
};

export const documentUsesGridCellNavigateBehavior = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    if (getNodePaletteItemId(node) !== APP_TABLE_GRID_PALETTE_ITEM_ID) {
      continue;
    }
    const columns = parseDesignerAppTableGridColumns(node.props.columns);
    if (columns.some((column) => (
      column.cellClickBehavior?.kind === 'navigate'
      && Boolean(column.cellClickBehavior.navigateTarget?.trim())
    ))) {
      return true;
    }
  }
  return false;
};

export const renderBindingComponentPreamble = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition> = {},
): string[] => {
  const registry = normalizeBindingDefinitions(bindingDefinitions);
  const context = createTsxBindingRenderContext(document, registry);
  const lines: string[] = [];

  if (documentUsesTranslationKeys(document) || Object.values(document.nodes).some((node) => appTableGridNodeUsesCultureKeys(node))) {
    lines.push('  const culture = useCulture();');
  }
  if (documentUsesNavigateAction(document) || documentUsesGridCellNavigateBehavior(document)) {
    lines.push('  const routerNavigate = useNavigate();');
    lines.push('  const location = useLocation();');
    lines.push('  const mountPathPrefix = useOptionalPlatformMount()?.pathPrefix ?? null;');
    lines.push('  const navigate = React.useCallback((to: string, options?: { replace?: boolean }) => {');
    lines.push('    routerNavigate(resolvePublishedDesignerNavigateTarget(to, location.pathname, mountPathPrefix), { replace: options?.replace === true });');
    lines.push('  }, [location.pathname, mountPathPrefix, routerNavigate]);');
  }
  // `bindingContext` (built from the hydration fetch result + store) is only consumed by
  // endpoint-driven mutation handlers, which run on user interaction *after* it is declared.
  // Region-submit and dynamic-action handlers never read it, so it is no longer tied to the
  // mere presence of a hydration fetch (that previously produced a use-before-declaration crash).
  const needsBindingContext = context.plan.eventBindings.some(
    (binding) => (Boolean(binding.endpoint) && !binding.regionSubmitPlan)
      || Object.keys(binding.urlParams).length > 0
      || Object.keys(binding.headers).length > 0,
  );

  const usesDesignerStore = designerStoreCodegenRequired(document, registry);

  if (usesDesignerStore) {
    const storeHookLines = renderDesignerStoreHookLines(registry);
    if (storeHookLines.length > 0) {
      lines.push(...storeHookLines);
    } else {
      lines.push(`  const { store: ${DESIGNER_STORE_VAR}, patch: ${DESIGNER_STORE_PATCH_VAR} } = useDesignerStore<Record<string, unknown>>({});`);
    }
  } else if (documentUsesVisibilityConditions(document) || fetchHooksReferenceDesignerStore(context)) {
    // Fetch/region/grid hooks resolve their URL params from `designerStore`; declare it before
    // those hooks run so the generated component does not reference an undefined identifier.
    lines.push(`  const ${DESIGNER_STORE_VAR}: Record<string, unknown> = {};`);
  }

  if (documentUsesHwyFamilyHouseholdCellClick(document)) {
    lines.push('  const { dialog: hwyFamilyHouseholdDialog, openFromGridRow: openHwyFamilyHouseholdFromGridRow } = useHwyFamilyHouseholdDialog();');
  }

  if (context.plan.fetchConfigs.length > 0) {
    lines.push(...renderFetchHookLines(context));
  }

  if (context.plan.regionPlan.regionFetches.length > 0) {
    lines.push(...renderRegionFetchHookLines(context));
  }

  const gridDetailFlows = collectDocumentGridDetailFlows(document, registry);
  const appTableGridDetailFlows = gridDetailFlows.filter(
    (flow) => getNodePaletteItemId(document.nodes[flow.gridNodeId]) === APP_TABLE_GRID_PALETTE_ITEM_ID,
  );
  const otherGridDetailFlows = gridDetailFlows.filter((flow) => !appTableGridDetailFlows.includes(flow));
  if (otherGridDetailFlows.length > 0) {
    lines.push(...renderGridDetailRowActionHandlerLines(otherGridDetailFlows));
  }
  lines.push(...renderAppTableGridRowActionHandlerLines(document, appTableGridDetailFlows));
  lines.push(...renderAppTableGridCellClickHandlerLines(document, appTableGridDetailFlows));

  if (context.plan.gridPlan.gridListFetches.length > 0) {
    lines.push(...renderGridListFetchHookLines(context));
  }

  lines.push(...renderAppTableGridStateHookLines(document, context, appTableGridDetailFlows, usesDesignerStore));

  if (context.plan.repeaterPlan.repeaterListFetches.length > 0) {
    lines.push(...renderRepeaterListFetchHookLines(context));
  }

  if (context.plan.chartPlan.chartListFetches.length > 0) {
    lines.push(...renderChartListFetchHookLines(context));
  }

  if (context.plan.vizPlan.vizListFetches.length > 0) {
    lines.push(...renderVizListFetchHookLines(context));
  }

  if (context.plan.contentPlan.contentListFetches.length > 0) {
    lines.push(...renderContentListFetchHookLines(context));
  }

  if (context.plan.regionPlan.regionColumnLovFetches.length > 0) {
    lines.push(...renderRegionColumnLovFetchHookLines(context));
  }

  if (context.dynamicActionFetches.length > 0) {
    lines.push(...renderDynamicActionFetchHookLines(context));
  }

  // Bug found (Phase 20 Auto CRUD): visibility wrappers always call
  // `evaluateDesignerCondition(designerStore, dataContext, ...)`, but `dataContext` was only
  // declared when BOTH legacy fetchConfigs AND regionFetches were empty. A page with a Grid
  // list fetch + Edit region detail fetch + modal `visibleCondition`s therefore referenced an
  // undeclared `dataContext` (TS2304) in Export. Declare a null placeholder whenever visibility
  // conditions need it and no legacy fetchConfigs[0] already owns the `dataContext` name.
  if (
    context.plan.fetchConfigs.length === 0
    && (
      documentUsesVisibilityConditions(document)
      || (
        context.plan.regionPlan.regionFetches.length === 0
        && (
          context.plan.propertyBindings.length > 0
          || context.plan.storeReadBindings.length > 0
        )
      )
    )
  ) {
    lines.push(`  const ${context.dataContextVar}: Record<string, unknown> | null = null;`);
  }

  if (needsBindingContext) {
    lines.push(...renderBindingContextInitialization({
      dataContextVar: context.plan.fetchConfigs.length > 0
        || context.plan.propertyBindings.length > 0
        || context.plan.storeReadBindings.length > 0
        || documentUsesVisibilityConditions(document)
        ? context.dataContextVar
        : undefined,
      storeVar: usesDesignerStore ? DESIGNER_STORE_VAR : undefined,
    }));
  }

  for (const entityPickerConfig of context.entityPickerConfigs) {
    lines.push(...renderEntityPickerHookLines(entityPickerConfig));
  }

  const apiEventBindings = context.plan.eventBindings.filter(
    (binding) => Boolean(binding.endpoint) || Boolean(binding.regionSubmitPlan),
  );

  if (apiEventBindings.length > 0) {
    lines.push('  const [isSubmitting, setIsSubmitting] = React.useState(false);');
    lines.push(...renderDebounceTimerRefLines(apiEventBindings));
  }

  for (const binding of context.plan.eventBindings) {
    const handlerName = createHandlerName(binding);
    if (binding.regionSubmitPlan) {
      lines.push(...renderRegionSubmitEventHandlerLines(binding, handlerName, context.document));
      continue;
    }

    if (binding.targetEvent === 'onSubmit') {
      lines.push(...renderSubmitEventHandlerLines(binding, handlerName, context));
      continue;
    }

    if (
      binding.targetEvent === 'onChange'
      || binding.targetEvent === 'onBlur'
      || binding.targetEvent === 'onSelectionChange'
      || binding.targetEvent === 'onCheckedChange'
      || binding.targetEvent === 'onAction'
      || binding.targetEvent === 'onDataPointClick'
      || binding.targetEvent === 'onTaskDrag'
      || binding.targetEvent === 'onCardMove'
    ) {
      lines.push(...renderValueEventHandlerLines(binding, handlerName, context));
      continue;
    }

    if (binding.targetEvent === 'onKeyDown' || binding.targetEvent === 'onKeyUp') {
      lines.push(...renderKeyboardEventHandlerLines(binding, handlerName, context));
      continue;
    }

    if (binding.targetEvent === 'onSortChange' || binding.targetEvent === 'onPageChange') {
      lines.push(...renderGridEventHandlerLines(binding, handlerName, context));
      continue;
    }

    lines.push(...renderSimpleEventHandlerLines(binding, handlerName, context));
  }

  for (const entityPickerConfig of context.entityPickerConfigs) {
    // Parity audit item 96: previously duplicated inline here while an identical helper in
    // tsxPhase2Palette.ts was never called (dead code / divergence risk). Single shared helper.
    lines.push(...renderEntityPickerSearchHandlerLines(entityPickerConfig));
  }

  return lines;
};

export const bindingCodegenRequiresReactHooks = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition> = {},
): boolean => bindingCodegenRequiresRuntimeHelpers(document, bindingDefinitions);

export const resolveRegionFormFieldNameAttribute = (
  nodeId: string,
  context: TsxBindingRenderContext,
): string => {
  const hasRegionColumnBinding = context.plan.regionPlan.regionColumnBindings.some(
    (binding) => binding.nodeId === nodeId,
  );

  if (!hasRegionColumnBinding) {
    return '';
  }

  return ` name=${JSON.stringify(nodeId)}`;
};

export const resolveBoundAttributeForNodeProp = (
  nodeId: string,
  targetProp: string,
  context: TsxBindingRenderContext,
): string => {
  const expression = resolveNodePropertyBindingExpression(nodeId, targetProp, context);
  if (!expression) {
    return '';
  }

  const propertyBinding = context.plan.propertyBindings.find(
    (item) => item.nodeId === nodeId && item.targetProp === targetProp,
  );

  // Bug found (recurred for heroui.listbox during the parity audit, and again for
  // heroui.dropdown when its items-binding gap was fixed — parity audit item 7): `items` is
  // rendered as JSX CHILDREN (a `.map()`/render-prop expression built directly by the
  // per-widget codegen case), not as a real JSX attribute, for select/autocomplete/listbox/
  // dropdown alike — so the generic bound-attribute loop appending `items={...}` here as well
  // produced a duplicate `items=` JSX attribute (TS17001) whenever `items` was bound on any of
  // these widgets.
  if (
    targetProp === 'items'
    && ['heroui.select', 'heroui.autocomplete', 'heroui.listbox', 'heroui.dropdown'].includes(
      getNodePaletteItemId(context.document.nodes[nodeId]) ?? '',
    )
  ) {
    return '';
  }

  // Bug found (parity audit item 15): `text` is rendered as JSX CHILDREN (via
  // renderTranslatableJsxTextContent), not as a real JSX attribute, for these 4 HTML primitives
  // — the real `<p>`/`<h1-6>`/`<a>`/`<li>` elements don't declare a `text` prop at all. The
  // generic bound-attribute loop appending `text={expr}` here as well produced a duplicate,
  // dead `text=` attribute whenever `text` was bound on any of them (the static/bound children
  // already correctly reflect the binding).
  if (
    targetProp === 'text'
    && ['html.text', 'html.heading', 'html.link', 'html.list-item'].includes(
      getNodePaletteItemId(context.document.nodes[nodeId]) ?? '',
    )
  ) {
    return '';
  }

  // Bug found (parity audit item 24): `label` on heroui.dropdown is rendered as JSX CHILDREN of
  // `Dropdown.Trigger` (tsxNodeRenderer.ts, via renderBoundJsxTextExpression), not a real JSX
  // attribute — the real `<Dropdown>` root has no `label` prop. Same duplicate-attribute class as
  // `items`/`text` above.
  if (targetProp === 'label' && getNodePaletteItemId(context.document.nodes[nodeId]) === 'heroui.dropdown') {
    return '';
  }

  // Bug found (parity audit item 69): `selectedKeys` on heroui.listbox is consumed as
  // `defaultSelectedKeys` (CSV → string[] expression) inside the listbox codegen case — the real
  // react-aria ListBox needs Iterable<Key>, not a raw bound string attribute. Suppress the
  // generic loop's `selectedKeys={expr}` emission so it doesn't duplicate / type-mismatch.
  if (targetProp === 'selectedKeys' && getNodePaletteItemId(context.document.nodes[nodeId]) === 'heroui.listbox') {
    return '';
  }

  // Bug found (parity audit item 94): Color was removed from button Inspector (real Button has no
  // color variant), but a leftover Property Binding still emitted `color={expr}` via the generic
  // bound-attribute loop. Static leftovers were already excluded; bound ones were not.
  if (
    targetProp === 'color'
    && ['heroui.button-solid', 'heroui.button-outline'].includes(
      getNodePaletteItemId(context.document.nodes[nodeId]) ?? '',
    )
  ) {
    return '';
  }

  // Bug found (parity audit item 95): `ariaLabel` was removed from tooltip-trigger Inspector
  // (never reached a real DOM element on Tooltip.Root). Static excludeKeys already strip it, but
  // a leftover Property Binding still emitted `aria-label={expr}` on `<Tooltip.Root>`.
  if (
    targetProp === 'ariaLabel'
    && getNodePaletteItemId(context.document.nodes[nodeId]) === 'heroui.tooltip-trigger'
  ) {
    return '';
  }

  // Bug found (parity audit item 66): Color removed from typography-lead Inspector — suppress
  // leftover bound `color={expr}` on the exported raw `<p>`.
  if (
    targetProp === 'color'
    && getNodePaletteItemId(context.document.nodes[nodeId]) === 'heroui.typography-lead'
  ) {
    return '';
  }

  // Bug found (parity audit item P3.16): `page`/`total` on heroui.pagination are consumed
  // directly as codegen-time numeric/expression values by `renderPaginationParityJsx`
  // (tsxParityPalette.ts) — baked into the Summary text, the active Link, and the
  // Previous/Next Math.max/min bounds — never as a real JSX attribute (the real `<Pagination>`
  // component has no such props at all). Without this exclusion, binding either one produced
  // a dead, inert `page={...}`/`total={...}` attribute directly on `<Pagination>` in addition
  // to the correct expression-based rendering.
  if (
    (targetProp === 'page' || targetProp === 'total')
    && getNodePaletteItemId(context.document.nodes[nodeId]) === 'heroui.pagination'
  ) {
    return '';
  }

  // Bug found (parity audit item 38): `direction`/`defaultSplit` on layout.split-pane drive
  // className/style/`data-split-*` inside `renderSplitPaneContainerJsx` — they are not real
  // DOM props on the wrapper `<div>`. Without this skip, the generic bound-attribute loop
  // appended dead `direction={...}`/`defaultSplit={...}` attributes while layout still used
  // the static baked values.
  if (
    (targetProp === 'direction' || targetProp === 'defaultSplit')
    && getNodePaletteItemId(context.document.nodes[nodeId]) === 'layout.split-pane'
  ) {
    return '';
  }

  if (
    targetProp === 'dock'
    && getNodePaletteItemId(context.document.nodes[nodeId]) === 'layout.dock-pane'
  ) {
    return '';
  }

  // Bug found (cluster D — heroui-data-display; recurred for content.stat-trend during the
  // Universal/Content binding audit): 'defaultValue' only exists on real form controls
  // (uncontrolled inputs). `isFormValueProp('value')` is a pure string check with no node
  // context, so ANY widget with a plain, always-controlled `value` prop — @heroui/react's
  // <ProgressBar> (react-aria's ProgressBarBaseProps has `value` only, no `defaultValue`) and
  // `DesignerUniversalStatTrend` (a read-only display prop, not a form input) alike — got the
  // same wrong default: a Property Binding on "Value" silently produced a `defaultValue={...}`
  // attribute the component doesn't have/read at all, so the export always rendered the static
  // fallback instead of the bound value. Force real 'value' for these known non-form widgets.
  const isPresentationalValueProp = targetProp === 'value'
    && (getNodePaletteItemId(context.document.nodes[nodeId]) === 'heroui.progress'
      || getNodePaletteItemId(context.document.nodes[nodeId]) === 'content.stat-trend');

  const jsxProp = propertyBinding?.valueMode === 'defaultValue'
    && isDefaultValueCandidate(targetProp)
    && !isPresentationalValueProp
    ? 'defaultValue'
    : toJsxPropName(targetProp);

  return renderBoundJsxAttribute(jsxProp, expression);
};

/**
 * Dual-Mode content blocks: resolve a bound JSX attribute for list or scalar props.
 * Returns empty string when the node is not content-data-bound for this prop.
 */
export const resolveContentBoundAttributeForProp = (
  nodeId: string,
  targetProp: string,
  context: TsxBindingRenderContext,
  fallbackLiteral?: string,
): string => {
  const contentFetch = context.plan.contentPlan.contentListFetches.find((item) => item.nodeId === nodeId);
  if (!contentFetch) {
    return '';
  }

  const listProp = contentFetch.targetListProp;
  if (listProp === targetProp) {
    const expression = listProp === 'steps' || listProp === 'options'
      ? resolveContentCsvExpression(contentFetch.dataVar)
      : resolveContentListJsonExpression(contentFetch.dataVar);
    return renderBoundJsxAttribute(toJsxPropName(targetProp), expression);
  }

  // Scalar props for non-list Dual-Mode widgets (hero, cta, icon, …)
  if (
    listProp === null
    && [
      'title', 'subtitle', 'description', 'actionLabel', 'primaryCta', 'secondaryCta',
      'placeholder', 'buttonLabel', 'label', 'value', 'trend', 'trendDirection',
      'iconName', 'mediaSrc', 'mediaSide', 'submitLabel',
    ].includes(targetProp)
  ) {
    const expression = resolveContentScalarPropExpression(
      contentFetch.dataVar,
      targetProp,
      fallbackLiteral ?? '',
    );
    return renderBoundJsxAttribute(toJsxPropName(targetProp), expression);
  }

  return '';
};

export const resolveBoundEventAttribute = (
  nodeId: string,
  targetEvent: string,
  context: TsxBindingRenderContext,
): string => {
  const handlerName = context.handlerNames.get(`${nodeId}:${targetEvent}`);
  if (!handlerName) {
    return '';
  }

  return renderBoundJsxAttribute(resolveDesignerEventJsxAttributeName(targetEvent), handlerName);
};

const isDefaultValueCandidate = (targetProp: string): boolean =>
  targetProp === 'value'
  || targetProp === 'placeholder'
  || targetProp === 'text'
  || targetProp === 'src'
  || targetProp === 'alt'
  || targetProp === 'selectedKeys'
  || targetProp === 'errorMessage'
  || targetProp === 'fallbackSrc'
  || targetProp === 'rows';

const toJsxPropName = (targetProp: string): string => {
  if (targetProp === 'ariaLabel') {
    return 'aria-label';
  }

  return targetProp;
};