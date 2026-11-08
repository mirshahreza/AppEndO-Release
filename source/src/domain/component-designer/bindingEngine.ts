import type {
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerBindingRole,
  DesignerBindingValueMode,
  DesignerDocument,
  DesignerNode,
  PayloadFieldTransform,
} from './types';
import { getBindingDefinitionEntries, coerceBindingDefinitions } from './bindingRegistry';
import {
  resolvePropertyBindingFetchEndpoint,
  resolvePropertyBindingLovMapping,
  type LovColumnMapping,
} from './bindingLovRegistry';
import {
  collectDocumentStorePlan,
  getNodeStoreReadBindingForProp,
  type ResolvedStoreReadBinding,
  type ResolvedStoreWriteBinding,
} from './bindingStoreEngine';
import {
  formatSessionBoundPlaceholder,
  getNodeSessionReadBindingForProp,
  parseDesignerSessionField,
} from './bindingSessionEngine';
import {
  formatFormulaBoundPlaceholder,
  getNodeFormulaBindingForProp,
  isFormulaBindingDefinition,
  resolveFormulaExpressionText,
} from './bindingFormulaEngine';
import {
  createFetchConfigKey,
  resolveBindingRequestHeaders,
  resolveBindingUrlParams,
} from './bindingApiHelpers';
import {
  DESIGNER_FORM_INPUT_PALETTE_ITEM_ID_SET,
  DESIGNER_HOVER_EVENT_PALETTE_ITEM_ID_SET,
} from './catalog';
import {
  collectDocumentRegionPlan,
  formatRegionColumnPlaceholder,
  getNodeRegionColumnBinding,
  isRegionSubmitBindingDefinition,
  resolveRegionSubmitPlanForEvent,
  type DocumentRegionPlan,
  type ResolvedRegionColumnBinding,
  type ResolvedRegionFetch,
  type ResolvedRegionSubmitPlan,
} from './bindingRegionEngine';
import {
  collectDocumentGridPlan,
  type DocumentGridPlan,
} from './bindingGridEngine';
import {
  collectDocumentRepeaterPlan,
  type DocumentRepeaterPlan,
} from './bindingRepeaterEngine';
import {
  collectDocumentChartPlan,
  type DocumentChartPlan,
} from './bindingChartEngine';
import {
  collectDocumentVizPlan,
  type DocumentVizPlan,
} from './bindingVizEngine';
import {
  collectDocumentContentPlan,
  type DocumentContentPlan,
} from './bindingContentEngine';
import {
  buildExistingDataSourceRefreshVarMap,
  hasTrueActions,
  resolveDynamicActions,
  type ResolvedDynamicAction,
} from './bindingDynamicActionsEngine';
import { resolveDesignerHtmlTag } from './domProps';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';

const PROPERTY_BINDING_KEY_PREFIX = 'prop:';
const EVENT_BINDING_KEY_PREFIX = 'event:';

export type DesignerEventBindingTarget =
  | 'onSubmit'
  | 'onClick'
  | 'onChange'
  | 'onBlur'
  | 'onHover'
  | 'onKeyDown'
  | 'onKeyUp'
  | 'onSortChange'
  | 'onPageChange'
  | 'onSelectionChange'
  | 'onCellChange'
  | 'onCheckedChange'
  | 'onAction'
  | 'onDataPointClick'
  | 'onTaskDrag'
  | 'onCardMove';

const DESIGNER_EVENT_BINDING_TARGETS: readonly DesignerEventBindingTarget[] = [
  'onSubmit',
  'onClick',
  'onChange',
  'onBlur',
  'onHover',
  'onKeyDown',
  'onKeyUp',
  'onSortChange',
  'onPageChange',
  'onSelectionChange',
  'onCellChange',
  'onCheckedChange',
  'onAction',
  'onDataPointClick',
  'onTaskDrag',
  'onCardMove',
];

/** Maps designer event binding keys to React JSX handler attribute names. */
const DESIGNER_EVENT_JSX_ATTRIBUTE_MAP: Record<DesignerEventBindingTarget, string> = {
  onSubmit: 'onSubmit',
  onClick: 'onClick',
  onChange: 'onChange',
  onBlur: 'onBlur',
  onHover: 'onMouseEnter',
  onKeyDown: 'onKeyDown',
  onKeyUp: 'onKeyUp',
  onSortChange: 'onSortChange',
  onPageChange: 'onPageChange',
  onSelectionChange: 'onSelectionChange',
  onCellChange: 'onCellChange',
  onCheckedChange: 'onCheckedChange',
  onAction: 'onAction',
  onDataPointClick: 'onDataPointClick',
  onTaskDrag: 'onTaskDrag',
  onCardMove: 'onCardMove',
};

export const DESIGNER_EVENT_BINDING_LABELS: Record<DesignerEventBindingTarget, string> = {
  onSubmit: 'Form Submit',
  onClick: 'Button Click',
  onChange: 'Value Change',
  onBlur: 'Focus Lost',
  onHover: 'Mouse Enter',
  onKeyDown: 'Key Down',
  onKeyUp: 'Key Up',
  onSortChange: 'Sort Change',
  onPageChange: 'Page Change',
  onSelectionChange: 'Selection Change',
  onCellChange: 'Cell Change',
  onCheckedChange: 'Checked Change',
  onAction: 'Menu Action',
  onDataPointClick: 'Chart Data Point Click',
  onTaskDrag: 'Task Drag',
  onCardMove: 'Kanban Card Move',
};

export const resolveDesignerEventJsxAttributeName = (targetEvent: string): string =>
  DESIGNER_EVENT_JSX_ATTRIBUTE_MAP[targetEvent as DesignerEventBindingTarget] ?? targetEvent;

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

export const resolveNodeEventBindingTargets = (node: DesignerNode): DesignerEventBindingTarget[] => {
  const paletteItemId = resolveNodePaletteItemId(node);
  const targets: DesignerEventBindingTarget[] = [];

  if (node.type === 'container' && resolveDesignerHtmlTag(node, 'div') === 'form') {
    targets.push('onSubmit');
  }

  if (paletteItemId === 'heroui.button-solid' || paletteItemId === 'heroui.button-outline') {
    targets.push('onClick');
  }

  if (paletteItemId && DESIGNER_FORM_INPUT_PALETTE_ITEM_ID_SET.has(paletteItemId)) {
    targets.push('onChange', 'onBlur', 'onKeyDown', 'onKeyUp');
  }

  if (paletteItemId === 'html.file-upload') {
    targets.push('onChange');
  }

  if (paletteItemId === 'heroui.data-grid' || paletteItemId === 'heroui.app-table-grid' || paletteItemId === 'heroui.table') {
    targets.push('onSortChange', 'onPageChange', 'onSelectionChange', 'onCellChange');
  }

  if (paletteItemId === 'heroui.pagination') {
    targets.push('onPageChange');
  }

  if (paletteItemId === 'heroui.listbox' || paletteItemId === 'heroui.tabs') {
    targets.push('onSelectionChange');
  }

  if (paletteItemId === 'viz.tree-view') {
    // Both modes coexist on the node (selectionMode picks which one the widget actually
    // uses at runtime) — exposing both targets lets either be wired regardless of mode.
    targets.push('onSelectionChange', 'onCheckedChange');
  }

  if (
    paletteItemId === 'viz.tree-select'
    || paletteItemId === 'viz.cascader'
    || paletteItemId === 'viz.tree-combobox'
    || paletteItemId === 'viz.timeline'
  ) {
    // Picking a tree node / clicking a timeline entry or Gantt bar emits the picked id via the
    // same {target:{value}} shape every other adapted widget uses (see DesignerRuntimeListbox).
    targets.push('onSelectionChange');
  }

  if (paletteItemId === 'viz.gantt') {
    targets.push('onSelectionChange', 'onTaskDrag');
  }

  if (paletteItemId === 'viz.kanban') {
    targets.push('onCardMove');
  }

  if (paletteItemId === 'heroui.dropdown') {
    targets.push('onAction');
  }

  if (
    paletteItemId === 'viz.chart-bar'
    || paletteItemId === 'viz.chart-line'
    || paletteItemId === 'viz.chart-pie'
    || paletteItemId === 'viz.chart-sparkline'
    || paletteItemId === 'viz.chart'
  ) {
    targets.push('onDataPointClick');
  }

  if (paletteItemId === 'heroui.entity-picker') {
    targets.push('onChange', 'onBlur');
  }

  if (paletteItemId === 'form.date-range') {
    targets.push('onChange', 'onBlur');
  }

  if (
    paletteItemId === 'heroui.switch'
    || paletteItemId === 'heroui.slider'
    || paletteItemId === 'heroui.checkbox-group'
    || paletteItemId === 'heroui.radio-group'
    || paletteItemId === 'form.time-input'
    || paletteItemId === 'form.datetime-input'
    || paletteItemId === 'form.rating'
    || paletteItemId === 'form.otp-input'
  ) {
    // heroui.switch/slider/checkbox-group/radio-group dispatch a real onChange to the designer
    // event system (see adaptValueChangeToDesignerEvent / adaptChoiceGroupValueToDesignerEvent).
    // None of these eight are part of DESIGNER_FORM_INPUT_PALETTE_ITEM_ID_SET (that set also
    // drives onBlur/onKeyDown/onKeyUp, which are not wired for any of these). Only expose
    // onChange. All eight now fire onChange in BOTH the interactive canvas preview and
    // exported/published code — form.rating/form.time-input/form.datetime-input/form.otp-input's
    // DesignerRuntimeUniversalWidgets.tsx components already call onChange with the correct
    // {target:{value}} shape natively, so tsxUniversalPalette.ts's generic bound-attrs pass needs
    // no value-shape adapter, just a real bound `value`→`defaultValue` attribute instead of the
    // static-literal-only bug from before this session (previously form.rating/form.otp-input had
    // no onChange target at all, and form.time-input/form.datetime-input's export path silently
    // dropped the value binding and never emitted onChange).
    targets.push('onChange');
  }

  if (paletteItemId === 'content.segmented-control') {
    // Bug found: every segment rendered as a plain non-interactive <span> — clicking could never
    // change the selection anywhere (canvas, preview, or exported code); fixed alongside this
    // registration (DesignerUniversalSegmentedControl/DesignerRuntimeSegmentedControl).
    targets.push('onSelectionChange');
  }

  if (paletteItemId && DESIGNER_HOVER_EVENT_PALETTE_ITEM_ID_SET.has(paletteItemId)) {
    targets.push('onHover');
  }

  return targets;
};

const isDesignerEventBindingTarget = (value: string): value is DesignerEventBindingTarget =>
  DESIGNER_EVENT_BINDING_TARGETS.includes(value as DesignerEventBindingTarget);

export type { DocumentRegionPlan, ResolvedRegionColumnBinding, ResolvedRegionFetch, ResolvedRegionSubmitPlan, RegionColumnLovFetch } from './bindingRegionEngine';
export type { DocumentGridPlan, ResolvedGridListFetch } from './bindingGridEngine';
export type { DocumentRepeaterPlan, ResolvedRepeaterListFetch } from './bindingRepeaterEngine';
export type { DocumentChartPlan, ResolvedChartListFetch } from './bindingChartEngine';
export type { DocumentVizPlan, ResolvedVizListFetch } from './bindingVizEngine';
export type { ResolvedDynamicAction } from './bindingDynamicActionsEngine';
export { resolveBindingRequestHeaders, resolveBindingUrlParams } from './bindingApiHelpers';
export { createDynamicActionsEventBindingDefinition } from './bindingDynamicActionsEngine';

export type ResolvedFetchConfig = {
  configKey: string;
  endpointTemplate: string;
  urlParams: Record<string, string>;
  headers: Record<string, string>;
};

export type ResolvedPropertyBinding = {
  bindingKey: string;
  nodeId: string;
  targetProp: string;
  dataPath: string;
  valueMode: DesignerBindingValueMode;
  fetchEndpoint?: string;
  fetchConfig?: ResolvedFetchConfig;
  lovRef?: string;
  lovMapping?: LovColumnMapping;
  definition: DesignerBindingDefinition;
};

export type ResolvedEventBinding = {
  bindingKey: string;
  nodeId: string;
  targetEvent: string;
  actionType: NonNullable<DesignerBindingDefinition['actionType']>;
  endpoint?: string;
  storeWritePath?: string;
  payloadMapping?: Record<string, string>;
  payloadFieldTransforms?: Record<string, PayloadFieldTransform>;
  urlParams: Record<string, string>;
  headers: Record<string, string>;
  regionSubmitPlan?: ResolvedRegionSubmitPlan;
  trueActions?: ResolvedDynamicAction[];
  definition: DesignerBindingDefinition;
};

export type DocumentBindingPlan = {
  propertyBindings: ResolvedPropertyBinding[];
  eventBindings: ResolvedEventBinding[];
  storeReadBindings: ResolvedStoreReadBinding[];
  storeWriteBindings: ResolvedStoreWriteBinding[];
  hydrationEndpoints: string[];
  fetchConfigs: ResolvedFetchConfig[];
  regionPlan: DocumentRegionPlan;
  gridPlan: DocumentGridPlan;
  repeaterPlan: DocumentRepeaterPlan;
  chartPlan: DocumentChartPlan;
  vizPlan: DocumentVizPlan;
  contentPlan: DocumentContentPlan;
};

export const resolveBindingRole = (definition: DesignerBindingDefinition, bindingKey?: string): DesignerBindingRole => {
  if (definition.bindingRole === 'property' || definition.bindingRole === 'event' || definition.bindingRole === 'general') {
    return definition.bindingRole;
  }

  if (bindingKey?.startsWith(PROPERTY_BINDING_KEY_PREFIX)) {
    return 'property';
  }

  if (bindingKey?.startsWith(EVENT_BINDING_KEY_PREFIX)) {
    return 'event';
  }

  if (bindingKey?.startsWith('store:')) {
    return 'property';
  }

  return 'general';
};

const resolvePropertyBindingTargetProp = (
  definition: DesignerBindingDefinition,
  bindingKey?: string,
): string | undefined => {
  if (typeof definition.targetProp === 'string' && definition.targetProp.trim().length > 0) {
    return definition.targetProp.trim();
  }

  if (bindingKey?.startsWith(PROPERTY_BINDING_KEY_PREFIX)) {
    return bindingKey.slice(PROPERTY_BINDING_KEY_PREFIX.length);
  }

  return undefined;
};

const resolveEventBindingTargetEvent = (
  definition: DesignerBindingDefinition,
  bindingKey?: string,
): string | undefined => {
  if (typeof definition.targetEvent === 'string' && definition.targetEvent.trim().length > 0) {
    return definition.targetEvent.trim();
  }

  if (bindingKey?.startsWith(EVENT_BINDING_KEY_PREFIX)) {
    return bindingKey.slice(EVENT_BINDING_KEY_PREFIX.length);
  }

  return undefined;
};

export const resolvePropertyBindingDataPath = (definition: DesignerBindingDefinition): string | undefined => {
  if (isFormulaBindingDefinition(definition)) {
    return resolveFormulaExpressionText(definition);
  }

  if (typeof definition.dataPath === 'string' && definition.dataPath.trim().length > 0) {
    return definition.dataPath.trim();
  }

  if (definition.sourceType === 'expression' && typeof definition.sourcePath === 'string' && definition.sourcePath.trim().length > 0) {
    return definition.sourcePath.trim();
  }

  return undefined;
};

export const createPropertyBindingDefinition = (
  targetProp: string,
  dataPath: string,
  options: {
    valueMode?: DesignerBindingValueMode;
    fetchEndpoint?: string;
    lovRef?: string;
    urlParams?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): DesignerBindingDefinition => ({
  sourceType: 'expression',
  bindingRole: 'property',
  targetProp,
  dataPath,
  sourcePath: dataPath,
  valueMode: options.valueMode ?? (isFormValueProp(targetProp) ? 'defaultValue' : 'value'),
  fetchEndpoint: options.fetchEndpoint,
  lovRef: options.lovRef,
  urlParams: options.urlParams,
  requestConfig: options.headers && Object.keys(options.headers).length > 0
    ? { method: 'GET', headers: options.headers }
    : undefined,
});

export const createEventBindingDefinition = (
  targetEvent: string,
  endpoint: string,
  actionType: NonNullable<DesignerBindingDefinition['actionType']>,
  payloadMapping?: Record<string, string>,
  options: {
    urlParams?: Record<string, string>;
    headers?: Record<string, string>;
    storeWritePath?: string;
    invalidateQueries?: string[];
    debounceMs?: number;
    payloadFieldTransforms?: Record<string, PayloadFieldTransform>;
  } = {},
): DesignerBindingDefinition => ({
  sourceType: 'apiRef',
  bindingRole: 'event',
  targetEvent,
  endpoint,
  endpointRef: endpoint,
  actionType,
  payloadMapping,
  storeWritePath: options.storeWritePath,
  invalidateQueries: options.invalidateQueries,
  debounceMs: options.debounceMs,
  urlParams: options.urlParams,
  payloadFieldTransforms: options.payloadFieldTransforms,
  requestConfig: {
    method: actionType,
    headers: options.headers,
  },
});

const resolveFetchConfigFromDefinition = (
  endpointTemplate: string,
  definition: DesignerBindingDefinition,
): ResolvedFetchConfig => {
  const urlParams = resolveBindingUrlParams(definition);
  const headers = resolveBindingRequestHeaders(definition);

  return {
    configKey: createFetchConfigKey(endpointTemplate, urlParams, headers),
    endpointTemplate,
    urlParams,
    headers,
  };
};

export const propertyBindingKeyForProp = (targetProp: string): string => `${PROPERTY_BINDING_KEY_PREFIX}${targetProp}`;

export const eventBindingKeyForEvent = (targetEvent: string): string => `${EVENT_BINDING_KEY_PREFIX}${targetEvent}`;

export const getNodePropertyBinding = (
  node: DesignerNode,
  targetProp: string,
): { bindingKey: string; definition: DesignerBindingDefinition } | null => {
  const bindingKey = propertyBindingKeyForProp(targetProp);
  const definition = node.binding[bindingKey];
  if (!definition || resolveBindingRole(definition, bindingKey) !== 'property') {
    return null;
  }

  const dataPath = resolvePropertyBindingDataPath(definition);
  if (!dataPath) {
    return null;
  }

  return { bindingKey, definition };
};

/** Count events that actually have an action (not "No action"). Used by Behavior badge. */
export const countActiveNodeEventBindings = (node: DesignerNode): number =>
  resolveNodeEventBindingTargets(node).filter((targetEvent) => getNodeEventBinding(node, targetEvent) !== null).length;

export const getNodeEventBinding = (
  node: DesignerNode,
  targetEvent: string,
): { bindingKey: string; definition: DesignerBindingDefinition } | null => {
  const bindingKey = eventBindingKeyForEvent(targetEvent);
  const definition = node.binding[bindingKey];
  if (!definition || resolveBindingRole(definition, bindingKey) !== 'event') {
    return null;
  }

  const endpoint = definition.endpoint ?? definition.endpointRef;
  const storeWritePath = typeof definition.storeWritePath === 'string' ? definition.storeWritePath.trim() : '';
  const actionType = definition.actionType ?? definition.requestConfig?.method;
  if (isRegionSubmitBindingDefinition(definition)) {
    return { bindingKey, definition };
  }

  if (hasTrueActions(definition)) {
    return { bindingKey, definition };
  }

  if (!endpoint && !storeWritePath) {
    return null;
  }

  if (endpoint && (!actionType || actionType === 'GET')) {
    return null;
  }

  return { bindingKey, definition };
};

const collectNodePropertyBindings = (
  node: DesignerNode,
  registry?: DesignerBindingDefinitions,
): ResolvedPropertyBinding[] => {
  const resolved: ResolvedPropertyBinding[] = [];

  for (const [bindingKey, definition] of Object.entries(node.binding)) {
    if (!definition) {
      continue;
    }

    if (resolveBindingRole(definition, bindingKey) !== 'property') {
      continue;
    }

    if (definition.sourceType === 'regionColumn' || definition.sourceType === 'session') {
      continue;
    }

    const targetProp = resolvePropertyBindingTargetProp(definition, bindingKey);
    const dataPath = resolvePropertyBindingDataPath(definition);
    if (!targetProp || !dataPath) {
      continue;
    }

    const fetchEndpoint = registry
      ? resolvePropertyBindingFetchEndpoint(definition, registry)
      : definition.fetchEndpoint;
    const lovMapping = registry ? resolvePropertyBindingLovMapping(definition, registry) : undefined;

    resolved.push({
      bindingKey,
      nodeId: node.id,
      targetProp,
      dataPath,
      valueMode: definition.valueMode ?? (isFormValueProp(targetProp) ? 'defaultValue' : 'value'),
      fetchEndpoint,
      fetchConfig: fetchEndpoint
        ? resolveFetchConfigFromDefinition(fetchEndpoint, definition)
        : undefined,
      lovRef: definition.lovRef,
      lovMapping,
      definition,
    });
  }

  return resolved;
};

export const collectNodeEventBindings = (
  node: DesignerNode,
  registry?: DesignerBindingDefinitions,
): ResolvedEventBinding[] => {
  const resolved: ResolvedEventBinding[] = [];

  for (const [bindingKey, definition] of Object.entries(node.binding)) {
    if (resolveBindingRole(definition, bindingKey) !== 'event') {
      continue;
    }

    const targetEvent = resolveEventBindingTargetEvent(definition, bindingKey);
    const endpoint = definition.endpoint ?? definition.endpointRef;
    const storeWritePath = typeof definition.storeWritePath === 'string' ? definition.storeWritePath.trim() : '';
    const actionType = definition.actionType ?? definition.requestConfig?.method;
    if (!targetEvent) {
      continue;
    }

    if (isRegionSubmitBindingDefinition(definition)) {
      resolved.push({
        bindingKey,
        nodeId: node.id,
        targetEvent,
        actionType: 'POST',
        urlParams: {},
        headers: {},
        definition,
      });
      continue;
    }

    if (hasTrueActions(definition)) {
      resolved.push({
        bindingKey,
        nodeId: node.id,
        targetEvent,
        actionType: 'POST',
        urlParams: {},
        headers: {},
        storeWritePath: storeWritePath || undefined,
        trueActions: registry ? resolveDynamicActions(definition, registry) : [],
        definition,
      });
      continue;
    }

    if (!endpoint && !storeWritePath) {
      continue;
    }

    if (endpoint && (!actionType || actionType === 'GET')) {
      continue;
    }

    resolved.push({
      bindingKey,
      nodeId: node.id,
      targetEvent,
      actionType: actionType && actionType !== 'GET' ? actionType : 'POST',
      endpoint,
      storeWritePath: storeWritePath || undefined,
      payloadMapping: definition.payloadMapping,
      payloadFieldTransforms: definition.payloadFieldTransforms,
      urlParams: resolveBindingUrlParams(definition),
      headers: resolveBindingRequestHeaders(definition),
      definition,
    });
  }

  return resolved;
};

export const collectDocumentBindingPlan = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition> = {},
): DocumentBindingPlan => {
  const normalizedDefinitions = getBindingDefinitionEntries(coerceBindingDefinitions(bindingDefinitions));
  const registry = coerceBindingDefinitions(bindingDefinitions);
  const propertyBindings: ResolvedPropertyBinding[] = [];
  const eventBindings: ResolvedEventBinding[] = [];
  const hydrationEndpoints = new Set<string>();
  const fetchConfigMap = new Map<string, ResolvedFetchConfig>();
  const storePlan = collectDocumentStorePlan(document, registry);
  const regionPlan = collectDocumentRegionPlan(document, registry);
  const gridPlan = collectDocumentGridPlan(document, registry);
  const repeaterPlan = collectDocumentRepeaterPlan(document, registry);
  const chartPlan = collectDocumentChartPlan(document, registry);
  const vizPlan = collectDocumentVizPlan(document, registry);
  const contentPlan = collectDocumentContentPlan(document, registry);

  for (const node of Object.values(document.nodes)) {
    propertyBindings.push(...collectNodePropertyBindings(node, registry));
    eventBindings.push(...collectNodeEventBindings(node, registry));
  }

  for (let index = 0; index < eventBindings.length; index += 1) {
    const binding = eventBindings[index];
    if (!isRegionSubmitBindingDefinition(binding.definition)) {
      continue;
    }

    const regionSubmitPlan = resolveRegionSubmitPlanForEvent(document, binding.nodeId, registry);
    if (!regionSubmitPlan) {
      continue;
    }

    eventBindings[index] = {
      ...binding,
      regionSubmitPlan,
      endpoint: regionSubmitPlan.endpoint,
    };
  }

  // Build the live-fetch refresh map BEFORE resolving Dynamic Actions so a
  // `refreshDataSource` trueAction targeting the same dataSourceId as a Grid/Chart/Viz/Region
  // reuses that fetch's refresh_<dataVar> instead of minting a phantom regionData_* hook.
  const existingRefreshVarByDataSourceId = buildExistingDataSourceRefreshVarMap({
    regionFetches: regionPlan.regionFetches,
    gridListFetches: gridPlan.gridListFetches,
    chartListFetches: chartPlan.chartListFetches,
    vizListFetches: vizPlan.vizListFetches,
    repeaterListFetches: repeaterPlan.repeaterListFetches,
  });

  for (let index = 0; index < eventBindings.length; index += 1) {
    const binding = eventBindings[index];
    if (!hasTrueActions(binding.definition)) {
      continue;
    }

    eventBindings[index] = {
      ...binding,
      trueActions: resolveDynamicActions(binding.definition, registry, existingRefreshVarByDataSourceId),
    };
  }

  for (const binding of propertyBindings) {
    if (binding.fetchEndpoint) {
      hydrationEndpoints.add(binding.fetchEndpoint);
    }
    if (binding.fetchConfig) {
      fetchConfigMap.set(binding.fetchConfig.configKey, binding.fetchConfig);
    }
  }

  for (const definition of Object.values(normalizedDefinitions)) {
    const endpoint = definition.fetchEndpoint ?? definition.endpoint ?? definition.endpointRef;
    const method = definition.requestConfig?.method ?? definition.actionType;
    if (!endpoint) {
      continue;
    }

    if (resolveBindingRole(definition) === 'property' && definition.fetchEndpoint) {
      hydrationEndpoints.add(definition.fetchEndpoint);
      const fetchConfig = resolveFetchConfigFromDefinition(definition.fetchEndpoint, definition);
      fetchConfigMap.set(fetchConfig.configKey, fetchConfig);
    }

    if (definition.sourceType === 'apiRef' && (method === undefined || method === 'GET')) {
      hydrationEndpoints.add(endpoint);
      const fetchConfig = resolveFetchConfigFromDefinition(endpoint, definition);
      fetchConfigMap.set(fetchConfig.configKey, fetchConfig);
    }
  }

  // Region / grid / LOV fetches have their own dedicated hook renderers
  // (renderRegionFetchHookLines, renderGridListFetchHookLines, ...). They must NOT also be
  // added to `fetchConfigMap`, otherwise the same endpoint would be fetched twice — once as a
  // redundant top-level `dataContext` hook and once as its dedicated region/grid/LOV hook.
  // We still record their endpoints as hydration endpoints so the runtime helpers are emitted.
  for (const regionFetch of regionPlan.regionFetches) {
    hydrationEndpoints.add(regionFetch.fetchConfig.endpointTemplate);
  }

  for (const gridFetch of gridPlan.gridListFetches) {
    hydrationEndpoints.add(gridFetch.fetchConfig.endpointTemplate);
  }

  for (const repeaterFetch of repeaterPlan.repeaterListFetches) {
    hydrationEndpoints.add(repeaterFetch.fetchConfig.endpointTemplate);
  }

  for (const chartFetch of chartPlan.chartListFetches) {
    hydrationEndpoints.add(chartFetch.fetchConfig.endpointTemplate);
  }

  for (const vizFetch of vizPlan.vizListFetches) {
    hydrationEndpoints.add(vizFetch.fetchConfig.endpointTemplate);
  }

  for (const contentFetch of contentPlan.contentListFetches) {
    hydrationEndpoints.add(contentFetch.fetchConfig.endpointTemplate);
  }

  for (const lovFetch of regionPlan.regionColumnLovFetches) {
    hydrationEndpoints.add(lovFetch.fetchConfig.endpointTemplate);
  }

  for (const binding of propertyBindings) {
    if (hydrationEndpoints.size === 0 && binding.dataPath) {
      // Property bindings imply hydration even when endpoint is configured later at document level.
      continue;
    }
  }

  return {
    propertyBindings,
    eventBindings,
    storeReadBindings: storePlan.readBindings,
    storeWriteBindings: storePlan.writeBindings,
    hydrationEndpoints: Array.from(hydrationEndpoints),
    fetchConfigs: Array.from(fetchConfigMap.values()),
    regionPlan,
    gridPlan,
    repeaterPlan,
    chartPlan,
    vizPlan,
    contentPlan,
  };
};

export const formatBoundPlaceholder = (dataPath: string): string => `[Bound: ${dataPath}]`;

export const dataPathToOptionalChainExpression = (dataPath: string, rootVar = 'dataContext'): string => {
  const segments = dataPath
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return rootVar;
  }

  return segments.reduce((expression, segment) => `${expression}?.${segment}`, rootVar);
};

export const isFormValueProp = (targetProp: string): boolean =>
  targetProp === 'value'
  || targetProp === 'defaultValue'
  || targetProp === 'placeholder'
  || targetProp === 'selectedKeys'
  || targetProp === 'checked'
  || targetProp === 'isSelected'
  || targetProp === 'errorMessage'
  || targetProp === 'fallbackSrc'
  || targetProp === 'rows';

export const resolveBoundCanvasPropValue = (
  node: DesignerNode,
  targetProp: string,
  staticValue: unknown,
): unknown => {
  const sessionBinding = getNodeSessionReadBindingForProp(node, targetProp);
  if (sessionBinding) {
    return formatSessionBoundPlaceholder(sessionBinding.sessionField);
  }

  const formulaBinding = getNodeFormulaBindingForProp(node, targetProp);
  if (formulaBinding) {
    return formatFormulaBoundPlaceholder(formulaBinding.formula);
  }

  const storeBinding = getNodeStoreReadBindingForProp(node, targetProp);
  if (storeBinding) {
    // Session bindings are also surfaced via getNodeStoreReadBindingForProp (store-path projection).
    // Prefer the session placeholder when the underlying definition is sourceType session.
    if (storeBinding.definition.sourceType === 'session') {
      const sessionField = parseDesignerSessionField(storeBinding.definition.sessionField);
      if (sessionField) {
        return formatSessionBoundPlaceholder(sessionField);
      }
    }
    return formatBoundPlaceholder(`store.${storeBinding.storePath}`);
  }

  const regionColumnBinding = getNodeRegionColumnBinding(node, targetProp);
  if (regionColumnBinding) {
    return formatRegionColumnPlaceholder(regionColumnBinding.column);
  }

  const binding = getNodePropertyBinding(node, targetProp);
  if (!binding) {
    return staticValue;
  }

  if (isFormulaBindingDefinition(binding.definition)) {
    const formula = resolveFormulaExpressionText(binding.definition);
    if (formula) {
      return formatFormulaBoundPlaceholder(formula);
    }
  }

  const dataPath = resolvePropertyBindingDataPath(binding.definition);
  if (!dataPath) {
    return staticValue;
  }

  return formatBoundPlaceholder(dataPath);
};

export const resolveBoundCanvasTextContent = (node: DesignerNode, fallback: string): string => {
  const sessionBinding = getNodeSessionReadBindingForProp(node, 'text');
  if (sessionBinding) {
    return formatSessionBoundPlaceholder(sessionBinding.sessionField);
  }

  const formulaBinding = getNodeFormulaBindingForProp(node, 'text');
  if (formulaBinding) {
    return formatFormulaBoundPlaceholder(formulaBinding.formula);
  }

  const storeBinding = getNodeStoreReadBindingForProp(node, 'text');
  if (storeBinding) {
    if (storeBinding.definition.sourceType === 'session') {
      const sessionField = parseDesignerSessionField(storeBinding.definition.sessionField);
      if (sessionField) {
        return formatSessionBoundPlaceholder(sessionField);
      }
    }
    return formatBoundPlaceholder(`store.${storeBinding.storePath}`);
  }

  const textBinding = getNodePropertyBinding(node, 'text');
  if (textBinding) {
    if (isFormulaBindingDefinition(textBinding.definition)) {
      const formula = resolveFormulaExpressionText(textBinding.definition);
      if (formula) {
        return formatFormulaBoundPlaceholder(formula);
      }
    }
    const dataPath = resolvePropertyBindingDataPath(textBinding.definition);
    if (dataPath) {
      return formatBoundPlaceholder(dataPath);
    }
  }

  if (typeof node.props.text === 'string' && node.props.text.trim().length > 0) {
    return node.props.text;
  }

  return fallback;
};

const createDesignerMockEventHandler = (
  binding: ResolvedEventBinding,
): ((event: Event) => void) => {
  return (event: Event) => {
    event.preventDefault?.();
    // eslint-disable-next-line no-console
    console.log(
      `[Designer Binding Preview] ${binding.targetEvent} → ${binding.actionType} ${binding.endpoint}`,
      binding.payloadMapping ?? {},
    );
  };
};

export const resolveNodeMockEventHandlers = (
  node: DesignerNode,
): Record<string, (event: Event) => void> => {
  const handlers: Record<string, (event: Event) => void> = {};

  for (const binding of collectNodeEventBindings(node)) {
    handlers[binding.targetEvent] = createDesignerMockEventHandler(binding);
  }

  return handlers;
};

const documentUsesBindingEngine = (plan: DocumentBindingPlan): boolean =>
  plan.propertyBindings.length > 0 || plan.eventBindings.length > 0 || plan.hydrationEndpoints.length > 0;
