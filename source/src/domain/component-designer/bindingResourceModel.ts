import { extractUrlTemplateParamNames } from './bindingApiHelpers';
import { DESIGNER_FORM_INPUT_PALETTE_ITEM_ID_SET } from './catalog';
import { createDynamicAction } from './bindingDynamicActionsEngine';
import { isFormValueProp, propertyBindingKeyForProp } from './bindingEngine';
import {
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
  collectRegionFormFieldMappings,
  getNodeRegionDataSourceRef,
  isDataRegionEligibleContainer,
  REGION_DATA_SOURCE_BINDING_KEY,
} from './bindingRegionEngine';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import type {
  DataSourceDefinition,
  DesignerApiOperation,
  DesignerApiOperationMethod,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDataResourceCrudKey,
  DesignerDataResourceKind,
  DesignerDataResourceOperations,
  DesignerDocument,
  DesignerKnownMutationOperation,
  DesignerNode,
  DesignerResponseMapping,
} from './types';

export type {
  DesignerApiOperation,
  DesignerApiOperationMethod,
  DesignerDataResourceCrudKey,
  DesignerDataResourceKind,
  DesignerDataResourceOperations,
  DesignerKnownMutationOperation,
  DesignerResponseMapping,
};

export const DESIGNER_DATA_RESOURCE_CRUD_KEYS = [
  'list',
  'detail',
  'create',
  'update',
  'delete',
] as const satisfies ReadonlyArray<DesignerDataResourceCrudKey>;

export const DESIGNER_KNOWN_MUTATION_OPERATIONS = [
  'create',
  'update',
  'delete',
] as const satisfies ReadonlyArray<DesignerKnownMutationOperation>;

export type ResolveCallMutationOperationResult =
  | {
    ok: true;
    operationKey: string;
    operation: DesignerApiOperation;
    kind: 'known' | 'custom';
  }
  | {
    ok: false;
    operationKey: string;
    reason: 'missing-data-source' | 'missing-operation';
  };

export const isCallMutationOperationFailure = (
  result: ResolveCallMutationOperationResult,
): result is Extract<ResolveCallMutationOperationResult, { ok: false }> => result.ok === false;

const isKnownMutationOperation = (value: string): value is DesignerKnownMutationOperation =>
  (DESIGNER_KNOWN_MUTATION_OPERATIONS as readonly string[]).includes(value);

/**
 * Resolves a `callMutation.mutationOperation` against a Data Source:
 * create/update/delete → `operations.<key>`; anything else → `operations.custom[key]`.
 */
export const resolveCallMutationOperation = (
  dataSource: DataSourceDefinition | undefined,
  mutationOperation: string | undefined,
): ResolveCallMutationOperationResult => {
  const operationKey = mutationOperation?.trim() || 'delete';

  if (!dataSource) {
    return { ok: false, operationKey, reason: 'missing-data-source' };
  }

  if (isKnownMutationOperation(operationKey)) {
    const operation = dataSource.operations?.[operationKey];
    if (operation?.endpoint?.trim()) {
      return { ok: true, operationKey, operation, kind: 'known' };
    }
    return { ok: false, operationKey, reason: 'missing-operation' };
  }

  const customOperation = dataSource.operations?.custom?.[operationKey];
  if (customOperation?.endpoint?.trim()) {
    return { ok: true, operationKey, operation: customOperation, kind: 'custom' };
  }

  return { ok: false, operationKey, reason: 'missing-operation' };
};

/** Inspector options for Call Mutation — fixed CRUD mutate slots + named custom ops. */
export const listCallMutationOperationOptions = (
  dataSource: DataSourceDefinition | undefined,
): Array<{ value: string; label: string }> => {
  const options: Array<{ value: string; label: string }> = [
    { value: 'delete', label: 'Delete' },
    { value: 'create', label: 'Create' },
    { value: 'update', label: 'Update' },
  ];

  const custom = dataSource?.operations?.custom;
  if (!custom) {
    return options;
  }

  for (const [key, operation] of Object.entries(custom)) {
    const trimmedKey = key.trim();
    if (!trimmedKey || !operation?.endpoint?.trim()) {
      continue;
    }
    if (isKnownMutationOperation(trimmedKey)) {
      continue;
    }
    options.push({
      value: trimmedKey,
      label: operation.label?.trim() || trimmedKey,
    });
  }

  return options;
};

export type DesignerDataResource = {
  id: string;
  name: string;
  kind: DesignerDataResourceKind;
  baseEndpoint: string;
  primaryKey?: string;
  fields: string[];
  operations: DesignerDataResourceOperations;
  response: DesignerResponseMapping;
};

export type FormBindingScenario =
  | 'create'
  | 'edit'
  | 'createEdit'
  | 'detail'
  | 'search'
  | 'custom'
  | 'wizard';

export type FormBindingScenarioOption = {
  value: FormBindingScenario;
  label: string;
  hint: string;
  primary?: boolean;
};

/** Primary scenarios shown first in the simplified connect wizard. */
export const FORM_BINDING_PRIMARY_SCENARIOS: readonly FormBindingScenarioOption[] = [
  {
    value: 'createEdit',
    label: 'Save form',
    hint: 'Create new records or update when an id is present.',
    primary: true,
  },
  {
    value: 'detail',
    label: 'View only',
    hint: 'Load and display a record — no submit button.',
    primary: true,
  },
  {
    value: 'search',
    label: 'Search / filter',
    hint: 'Bind filter inputs to a list endpoint.',
    primary: true,
  },
];

/** Advanced scenarios hidden under "More options". */
export const FORM_BINDING_ADVANCED_SCENARIOS: readonly FormBindingScenarioOption[] = [
  { value: 'create', label: 'Create only', hint: 'Always POST — never update existing records.' },
  { value: 'edit', label: 'Edit only', hint: 'Always load and PUT/PATCH an existing record.' },
  { value: 'custom', label: 'Custom', hint: 'Map fields only — configure load/submit manually.' },
];

export type FormBindingSuccessBehavior =
  | 'none'
  | 'refresh'
  | 'reset'
  | 'toast'
  | 'close';

/** Canonical order for combining success options (toast → refresh → reset → close). */
export const FORM_BINDING_SUCCESS_BEHAVIOR_ORDER: readonly Exclude<FormBindingSuccessBehavior, 'none'>[] = [
  'toast',
  'refresh',
  'reset',
  'close',
] as const;

export type FormFieldMappingDraft = {
  nodeId: string;
  fieldKey: string;
  column: string;
  enabled: boolean;
};

export type FormBindingWizardConfig = {
  scenario: FormBindingScenario;
  regionNodeId: string;
  dataSourceId: string;
  fieldMappings: FormFieldMappingDraft[];
  /**
   * Single success option (legacy). Prefer `successBehaviors` when multiple options should
   * run together (toast + refresh + close, etc.).
   */
  successBehavior?: FormBindingSuccessBehavior;
  /** Combinable success options. When both are set, `successBehaviors` wins. */
  successBehaviors?: FormBindingSuccessBehavior[];
  submitEventTarget: 'onSubmit' | 'onClick';
  submitNodeId?: string;
};

/** Normalize wizard success options into an ordered, deduped list (excluding `none`). */
export const normalizeFormBindingSuccessBehaviors = (
  config: Pick<FormBindingWizardConfig, 'successBehavior' | 'successBehaviors'>,
): Array<Exclude<FormBindingSuccessBehavior, 'none'>> => {
  const raw = (config.successBehaviors && config.successBehaviors.length > 0)
    ? config.successBehaviors
    : (config.successBehavior ? [config.successBehavior] : []);
  const selected = new Set(raw.filter((entry): entry is Exclude<FormBindingSuccessBehavior, 'none'> => entry !== 'none'));
  return FORM_BINDING_SUCCESS_BEHAVIOR_ORDER.filter((entry) => selected.has(entry));
};

const trimEndpoint = (endpoint: string): string => endpoint.trim().replace(/\/+$/, '');

const LATIN_SLUG_SEGMENT_RE = /^[a-z][a-z0-9_-]*$/;

/** Stable key for wizard state when a data source's discovered fields change. */
export const buildDataSourceFieldsSyncKey = (
  dataSourceId: string,
  dataSource: DataSourceDefinition | undefined,
): string => {
  const fields = dataSource?.fields ?? [];
  const endpoint = dataSource?.endpoint ?? '';
  return `${dataSourceId}\u0001${endpoint}\u0001${fields.join('\u0002')}`;
};

export const inferResourceIdFromEndpoint = (endpoint: string): string => {
  const trimmed = trimEndpoint(endpoint);
  if (!trimmed) {
    return '';
  }

  const segments = trimmed.split('/').filter(Boolean);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index] ?? '';
    if (segment.startsWith(':') || segment.startsWith('{')) {
      continue;
    }

    const normalized = segment.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    if (normalized.length > 0 && LATIN_SLUG_SEGMENT_RE.test(normalized)) {
      return normalized;
    }
  }

  return 'resource';
};

export const inferResourceNameFromEndpoint = (endpoint: string): string => {
  const resourceId = inferResourceIdFromEndpoint(endpoint);
  if (!resourceId) {
    return 'New Resource';
  }

  return resourceId
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const isParamSegment = (segment: string): boolean =>
  segment.startsWith(':') || (segment.startsWith('{') && segment.endsWith('}'));

/**
 * Strips trailing path parameters (e.g. `:id`, `{id}`) so a specific route such as
 * `/api/users/:id` resolves back to its collection base `/api/users`.
 */
export const deriveResourceBaseEndpoint = (endpoint: string): string => {
  const trimmed = trimEndpoint(endpoint);
  if (!trimmed) {
    return '';
  }

  const segments = trimmed.split('/');
  while (segments.length > 1 && isParamSegment(segments[segments.length - 1] ?? '')) {
    segments.pop();
  }

  const base = segments.join('/').replace(/\/+$/, '');
  return base || trimmed;
};

const assignExactRouteOperation = (
  operations: DesignerDataResourceOperations,
  exactEndpoint: string,
  method: DesignerApiOperationMethod,
  hasTrailingParam: boolean,
): void => {
  const operation: DesignerApiOperation = { method, endpoint: exactEndpoint };
  switch (method) {
    case 'GET':
      operations[hasTrailingParam ? 'detail' : 'list'] = operation;
      break;
    case 'POST':
      operations.create = operation;
      break;
    case 'PUT':
    case 'PATCH':
      operations.update = operation;
      break;
    case 'DELETE':
      operations.delete = operation;
      break;
    default:
      break;
  }
};

export const buildDataSourceFromEndpoint = (
  endpoint: string,
  options: {
    fields?: string[];
    primaryKey?: string;
    existingId?: string;
    /** HTTP method of the picked route — recorded onto the matching REST operation. */
    method?: DesignerApiOperationMethod;
  } = {},
): DataSourceDefinition => {
  const trimmedEndpoint = trimEndpoint(endpoint);
  const baseEndpoint = deriveResourceBaseEndpoint(trimmedEndpoint);
  const hasTrailingParam = trimmedEndpoint.length > 0 && baseEndpoint !== trimmedEndpoint;
  const inferredId = options.existingId?.trim() || inferResourceIdFromEndpoint(baseEndpoint) || `resource_${Date.now().toString(36)}`;
  const primaryKey = options.primaryKey?.trim() || 'id';
  const operations = buildDefaultRestOperations(baseEndpoint, primaryKey);

  if (options.method) {
    assignExactRouteOperation(operations, trimmedEndpoint, options.method, hasTrailingParam);
  }

  return {
    id: inferredId,
    name: inferResourceNameFromEndpoint(baseEndpoint),
    endpoint: baseEndpoint,
    primaryKey,
    fields: options.fields ?? [],
    kind: 'record',
    operations,
    responseMapping: { arrayPath: 'data' },
  };
};

export const mergeResourceFieldsFromMappings = (
  dataSource: DataSourceDefinition,
  mappedColumns: string[],
): DataSourceDefinition => {
  if (dataSource.fields.length > 0) {
    return dataSource;
  }

  const merged = new Set<string>();
  const primaryKey = dataSource.primaryKey?.trim();
  if (primaryKey) {
    merged.add(primaryKey);
  }

  for (const column of mappedColumns) {
    const trimmed = column.trim();
    if (trimmed.length > 0) {
      merged.add(trimmed);
    }
  }

  return {
    ...dataSource,
    fields: Array.from(merged),
  };
};

export const buildDefaultRestOperations = (
  baseEndpoint: string,
  primaryKey?: string,
): DesignerDataResourceOperations => {
  const base = trimEndpoint(baseEndpoint);
  if (!base) {
    return {};
  }

  const pkSegment = primaryKey?.trim() ? `:${primaryKey.trim()}` : ':id';

  return {
    list: { method: 'GET', endpoint: base },
    detail: { method: 'GET', endpoint: `${base}/${pkSegment}` },
    create: { method: 'POST', endpoint: base },
    update: { method: 'PUT', endpoint: `${base}/${pkSegment}` },
    delete: { method: 'DELETE', endpoint: `${base}/${pkSegment}` },
  };
};

export const inferDataResourceKind = (dataSource: DataSourceDefinition): DesignerDataResourceKind => {
  if (dataSource.kind) {
    return dataSource.kind;
  }

  if (dataSource.primaryKey?.trim()) {
    return 'record';
  }

  return 'collection';
};

export const dataSourceToResource = (dataSource: DataSourceDefinition): DesignerDataResource => {
  const baseEndpoint = dataSource.endpoint.trim();
  const operations = dataSource.operations ?? buildDefaultRestOperations(baseEndpoint, dataSource.primaryKey);

  return {
    id: dataSource.id,
    name: dataSource.name,
    kind: inferDataResourceKind(dataSource),
    baseEndpoint,
    primaryKey: dataSource.primaryKey,
    fields: dataSource.fields,
    operations,
    response: dataSource.responseMapping ?? {},
  };
};

export const resolveResourceOperation = (
  resource: DesignerDataResource,
  operation: DesignerDataResourceCrudKey,
): DesignerApiOperation | undefined => resource.operations[operation];

const PATH_PARAM_PATTERN = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;

export const extractPathStyleParamNames = (endpoint: string): string[] => {
  const names = new Set<string>();
  for (const match of endpoint.matchAll(PATH_PARAM_PATTERN)) {
    const name = match[1]?.trim();
    if (name) {
      names.add(name);
    }
  }
  for (const name of extractUrlTemplateParamNames(endpoint)) {
    names.add(name);
  }
  return Array.from(names);
};

export const resolveDataSourceOperationEndpoint = (
  dataSource: DataSourceDefinition,
  operation: DesignerDataResourceCrudKey,
): string => {
  const resource = dataSourceToResource(dataSource);
  const resolved = resolveResourceOperation(resource, operation);
  if (resolved?.endpoint.trim()) {
    return resolved.endpoint.trim();
  }

  return dataSource.endpoint.trim();
};

export const resolveRegionLoadConfig = (
  dataSource: DataSourceDefinition,
  regionBinding?: DesignerBindingDefinition,
): {
  method: 'GET';
  endpoint: string;
  urlParams: Record<string, string>;
  responseMapping?: DesignerResponseMapping;
} => {
  const resource = dataSourceToResource(dataSource);
  const loadOperation = regionBinding?.loadOperation;
  let endpoint = dataSource.endpoint.trim();

  if (loadOperation === 'list') {
    endpoint = resolveDataSourceOperationEndpoint(dataSource, 'list');
  } else if (loadOperation === 'detail') {
    endpoint = resolveDataSourceOperationEndpoint(dataSource, 'detail');
  } else if (inferDataResourceKind(dataSource) === 'record' && dataSource.primaryKey?.trim()) {
    endpoint = resolveDataSourceOperationEndpoint(dataSource, 'detail');
  }

  const urlParams = { ...(regionBinding?.urlParams ?? {}) };
  const pk = dataSource.primaryKey?.trim();
  // Bug found (API wizards follow-up): this used to only run when `loadOperation === 'detail'`
  // explicitly. But the branch above ALSO resolves to the detail endpoint template (e.g.
  // "/api/orders/:id") whenever loadOperation is unset and the data source merely looks
  // record-shaped (has a primaryKey) — which is true for every data source the Auto Form/Table/CRUD
  // wizards build via buildDataSourceFromEndpoint, including plain Create-only forms. Gating only on
  // the explicit 'detail' case left that inferred path's `:id`/`{id}` placeholder completely
  // unresolved, so a Create form fired a broken GET with a literal ":id" in the URL on mount.
  // Populate whenever the resolved endpoint actually has a matching path param, regardless of why
  // the detail template was chosen.
  if (pk) {
    const pathParams = extractPathStyleParamNames(endpoint);
    const pkParam = pathParams.find((name) => name.toLowerCase() === pk.toLowerCase()) ?? pathParams[0];
    if (pkParam && !urlParams[pkParam]) {
      urlParams[pkParam] = `selection.${pk}`;
    }
  }

  return {
    method: 'GET',
    endpoint,
    urlParams,
    responseMapping: resource.response,
  };
};

export const resolveRegionSubmitEndpoints = (
  dataSource: DataSourceDefinition,
): { base: string; create: string; update: string } => {
  const resource = dataSourceToResource(dataSource);
  const base = dataSource.endpoint.trim();
  return {
    base,
    create: resource.operations.create?.endpoint.trim() || base,
    update: resource.operations.update?.endpoint.trim() || base,
  };
};

export const readNestedContextValue = (
  context: Record<string, unknown> | null | undefined,
  path: string,
): unknown => {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  let cursor: unknown = context;
  for (const segment of segments) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
};

export const resolveOperationUrl = (
  endpointTemplate: string,
  context: Record<string, unknown> | null | undefined,
  urlParams: Record<string, string> = {},
): string => {
  let resolved = endpointTemplate.trim();

  for (const [paramName, dataPath] of Object.entries(urlParams)) {
    const value = readNestedContextValue(context, dataPath);
    const text = value === undefined || value === null ? '' : String(value);
    resolved = resolved.replaceAll(`{${paramName}}`, encodeURIComponent(text));
    resolved = resolved.replace(new RegExp(`:${paramName}(?=/|$)`, 'g'), encodeURIComponent(text));
  }

  return resolved.replace(/\/+$/, '');
};

export const unwrapStandardApiPayload = (payload: unknown): unknown => {
  if (payload === undefined || payload === null) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== 'object') {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const data = record.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (data !== undefined && data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }

  for (const key of ['items', 'rows', 'results'] as const) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return payload;
};

export const coerceApiRecordValue = (value: unknown): Record<string, unknown> | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.find(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && !Array.isArray(entry),
    );
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return undefined;
};

export type HydrationResultShape = 'record' | 'rows';

export const normalizeHydrationResolvedValue = (
  resolved: unknown,
  shape: HydrationResultShape,
): unknown => {
  if (shape === 'rows') {
    if (Array.isArray(resolved)) {
      return resolved;
    }

    const record = coerceApiRecordValue(resolved);
    return record ? [record] : [];
  }

  return coerceApiRecordValue(resolved);
};

export const applyResponseDataPath = (
  payload: unknown,
  responseMapping?: DesignerResponseMapping,
): unknown => {
  const hasExplicitMapping = Boolean(
    responseMapping?.arrayPath?.trim() || responseMapping?.dataPath?.trim(),
  );

  if (!hasExplicitMapping) {
    return unwrapStandardApiPayload(payload);
  }

  const arrayPath = responseMapping!.arrayPath?.trim();
  if (arrayPath) {
    const arrayValue = readNestedContextValue(
      payload && typeof payload === 'object' ? payload as Record<string, unknown> : {},
      arrayPath,
    );
    if (Array.isArray(arrayValue)) {
      return arrayValue;
    }

    if (arrayValue !== undefined && arrayValue !== null && typeof arrayValue === 'object') {
      return arrayValue;
    }
  }

  const dataPath = responseMapping!.dataPath?.trim();
  if (!dataPath) {
    return unwrapStandardApiPayload(payload);
  }

  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const mapped = readNestedContextValue(payload as Record<string, unknown>, dataPath);
  return mapped ?? unwrapStandardApiPayload(payload);
};

export const buildDefaultDetailUrlParams = (
  dataSource: DataSourceDefinition,
  storePathPrefix = 'selection',
): Record<string, string> => {
  const pk = dataSource.primaryKey?.trim();
  if (!pk) {
    return {};
  }

  const detailEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'detail');
  const pathParams = extractPathStyleParamNames(detailEndpoint);
  const paramName = pathParams.find((name) => name.toLowerCase() === pk.toLowerCase()) ?? pathParams[0] ?? pk;
  return { [paramName]: `${storePathPrefix}.${pk}` };
};

export const createRegionDataSourceBindingWithLoad = (
  dataSourceRef: string,
  options: {
    loadOperation?: DesignerBindingDefinition['loadOperation'];
    urlParams?: Record<string, string>;
  } = {},
): DesignerBindingDefinition => ({
  sourceType: 'static',
  dataSourceRef: dataSourceRef.trim(),
  sourcePath: dataSourceRef.trim(),
  loadOperation: options.loadOperation,
  urlParams: options.urlParams,
});

export const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

const CLOSABLE_OVERLAY_PALETTE_ITEM_IDS = new Set(['heroui.modal', 'heroui.alert-dialog', 'heroui.drawer']);

/** Walks up from `nodeId` to the nearest ancestor Modal/Drawer/Alert Dialog, if any — used to
 * resolve the "Close dialog" form-wizard success option to a concrete `showHide` target. */
export const findAncestorOverlayNodeId = (
  document: DesignerDocument,
  nodeId: string,
): string | undefined => {
  let cursor = document.nodes[nodeId]?.parentId ?? null;
  while (cursor) {
    const node: DesignerNode | undefined = document.nodes[cursor];
    if (!node) {
      return undefined;
    }
    if (CLOSABLE_OVERLAY_PALETTE_ITEM_IDS.has(resolveNodePaletteItemId(node) ?? '')) {
      return node.id;
    }
    cursor = node.parentId;
  }
  return undefined;
};

export const resolvePreferredValuePropForNode = (node: DesignerNode): string => {
  const paletteItemId = resolveNodePaletteItemId(node);

  if (paletteItemId === 'heroui.switch') {
    return 'isSelected';
  }

  if (paletteItemId === 'heroui.select' || paletteItemId === 'heroui.autocomplete' || paletteItemId === 'heroui.entity-picker') {
    return 'selectedKeys';
  }

  if (paletteItemId === 'html.image' || paletteItemId === 'heroui.avatar') {
    return 'src';
  }

  return 'value';
};

const COLUMN_NAME_FROM_PROPS_RE = /^[a-z][a-z0-9_]*$/i;

export const inferColumnNameFromNodeProps = (node: DesignerNode): string => {
  for (const key of ['name', 'id'] as const) {
    const value = node.props[key];
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0 && COLUMN_NAME_FROM_PROPS_RE.test(trimmed)) {
      return trimmed;
    }
  }

  const label = node.props.label;
  if (typeof label === 'string') {
    const trimmed = label.trim();
    if (trimmed.length > 0 && !trimmed.includes(' ') && COLUMN_NAME_FROM_PROPS_RE.test(trimmed)) {
      return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    }
  }

  return '';
};

export const suggestColumnForNode = (
  node: DesignerNode,
  fieldKey: string,
  availableFields: string[],
): string => {
  const normalizedCandidates = new Set<string>();

  const pushCandidate = (value: unknown) => {
    if (typeof value !== 'string') {
      return;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      normalizedCandidates.add(trimmed);
      normalizedCandidates.add(trimmed.toLowerCase());
    }
  };

  pushCandidate(node.props.name);
  pushCandidate(node.props.id);
  pushCandidate(node.props.label);
  pushCandidate(node.props.placeholder);
  pushCandidate(fieldKey);

  for (const candidate of normalizedCandidates) {
    const exact = availableFields.find((field) => field === candidate);
    if (exact) {
      return exact;
    }
  }

  for (const candidate of normalizedCandidates) {
    const caseInsensitive = availableFields.find((field) => field.toLowerCase() === candidate.toLowerCase());
    if (caseInsensitive) {
      return caseInsensitive;
    }
  }

  const inferred = inferColumnNameFromNodeProps(node);
  if (!inferred) {
    return '';
  }

  if (availableFields.length === 0) {
    return inferred;
  }

  return availableFields.find((field) => field.toLowerCase() === inferred.toLowerCase()) ?? inferred;
};

export type BindableRegionFieldNode = {
  nodeId: string;
  node: DesignerNode;
  fieldKey: string;
  label: string;
  suggestedColumn: string;
};

export const resolveFormWizardRecordFieldOptions = (
  dataSourceFields: string[],
  fieldMappings: FormFieldMappingDraft[],
  bindableNodes: BindableRegionFieldNode[],
): string[] => {
  const merged = new Set<string>();

  for (const field of dataSourceFields) {
    const trimmed = field.trim();
    if (trimmed.length > 0) {
      merged.add(trimmed);
    }
  }

  for (const mapping of fieldMappings) {
    const trimmed = mapping.column.trim();
    if (trimmed.length > 0) {
      merged.add(trimmed);
    }
  }

  for (const entry of bindableNodes) {
    const suggested = entry.suggestedColumn.trim();
    if (suggested.length > 0) {
      merged.add(suggested);
    }

    const inferred = inferColumnNameFromNodeProps(entry.node);
    if (inferred.length > 0) {
      merged.add(inferred);
    }
  }

  return [...merged].sort((left, right) => left.localeCompare(right));
};

const collectDescendantIds = (document: DesignerDocument, rootId: string): string[] => {
  const result: string[] = [];
  const queue = [...(document.nodes[rootId]?.children ?? [])];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      continue;
    }

    result.push(nodeId);
    const node = document.nodes[nodeId];
    if (node) {
      queue.push(...node.children);
    }
  }

  return result;
};

export const collectBindableRegionFieldNodes = (
  document: DesignerDocument,
  regionNodeId: string,
  bindingDefinitions: DesignerBindingDefinitions,
  options?: {
    /** Wizard-only: suggest columns from this resource before the region is bound. */
    dataSourceId?: string;
  },
): BindableRegionFieldNode[] => {
  const dataSourceRef = options?.dataSourceId
    ?? getNodeRegionDataSourceRef(document.nodes[regionNodeId] ?? { binding: {} } as DesignerNode);
  const dataSource = dataSourceRef ? bindingDefinitions.dataSources[dataSourceRef] : undefined;
  const availableFields = dataSource?.fields ?? [];

  const descendants = collectDescendantIds(document, regionNodeId);
  const bindable: BindableRegionFieldNode[] = [];

  for (const nodeId of descendants) {
    const node = document.nodes[nodeId];
    if (!node) {
      continue;
    }

    const paletteItemId = resolveNodePaletteItemId(node);
    if (!paletteItemId || !DESIGNER_FORM_INPUT_PALETTE_ITEM_ID_SET.has(paletteItemId)) {
      continue;
    }

    const fieldKey = resolvePreferredValuePropForNode(node);
    if (!isFormValueProp(fieldKey)) {
      continue;
    }

    const label = typeof node.props.label === 'string' && node.props.label.trim().length > 0
      ? node.props.label.trim()
      : typeof node.props.name === 'string' && node.props.name.trim().length > 0
        ? node.props.name.trim()
        : paletteItemId;

    bindable.push({
      nodeId,
      node,
      fieldKey,
      label,
      suggestedColumn: suggestColumnForNode(node, fieldKey, availableFields),
    });
  }

  return bindable;
};

export const buildDefaultFieldMappings = (
  document: DesignerDocument,
  regionNodeId: string,
  bindingDefinitions: DesignerBindingDefinitions,
  options?: {
    dataSourceId?: string;
  },
): FormFieldMappingDraft[] =>
  collectBindableRegionFieldNodes(document, regionNodeId, bindingDefinitions, options).map((entry) => ({
    nodeId: entry.nodeId,
    fieldKey: entry.fieldKey,
    column: entry.suggestedColumn,
    enabled: entry.suggestedColumn.length > 0,
  }));

export type FormBindingWizardDispatchAction =
  | {
    type: 'set-data-source';
    dataSourceId: string;
    dataSource: DataSourceDefinition;
  }
  | {
    type: 'set-node-binding';
    nodeId: string;
    bindingKey: string;
    definition: DesignerBindingDefinition;
  }
  | {
    type: 'remove-node-binding';
    nodeId: string;
    bindingKey: string;
  };

const resolveWizardLoadConfig = (
  scenario: FormBindingScenario,
  dataSource: DataSourceDefinition,
): {
  loadOperation?: DesignerBindingDefinition['loadOperation'];
  urlParams?: Record<string, string>;
} => {
  if (scenario === 'edit' || scenario === 'detail' || scenario === 'createEdit') {
    return {
      loadOperation: 'detail',
      urlParams: buildDefaultDetailUrlParams(dataSource),
    };
  }

  if (scenario === 'search') {
    return { loadOperation: 'list' };
  }

  return {};
};

export type GridBindingWizardConfig = {
  gridNodeId: string;
  dataSourceId: string;
};

/**
 * Shared success-action builder for Binding Form wizard + Auto Form Builder.
 * Canonical order matches `FORM_BINDING_SUCCESS_BEHAVIOR_ORDER`.
 * `reset` needs `regionNodeId`; `close` needs `overlayNodeId` (or warns).
 * `refresh` is skipped when `dataSourceId` is empty (static forms).
 */
export const buildFormSuccessTrueActions = (options: {
  behaviors: ReadonlyArray<Exclude<FormBindingSuccessBehavior, 'none'>>;
  dataSourceId?: string;
  regionNodeId?: string;
  overlayNodeId?: string;
  warnOnMissingCloseTarget?: boolean;
}): {
  trueActions: import('./types').DesignerDynamicAction[];
  invalidateQueries: string[];
} => {
  const trueActions: import('./types').DesignerDynamicAction[] = [];
  const invalidateQueries: string[] = [];
  const dataSourceId = options.dataSourceId?.trim() ?? '';

  for (const behavior of options.behaviors) {
    if (behavior === 'toast') {
      const toastAction = createDynamicAction('showToast');
      toastAction.toastTitle = 'Saved successfully';
      toastAction.toastVariant = 'success';
      trueActions.push(toastAction);
      continue;
    }

    if (behavior === 'refresh') {
      if (!dataSourceId) {
        continue;
      }
      const refreshAction = createDynamicAction('refreshDataSource');
      refreshAction.dataSourceRef = dataSourceId;
      trueActions.push(refreshAction);
      invalidateQueries.push(`region:${dataSourceId}`);
      continue;
    }

    if (behavior === 'reset') {
      if (!options.regionNodeId) {
        continue;
      }
      const resetAction = createDynamicAction('resetForm');
      resetAction.targetNodeId = options.regionNodeId;
      trueActions.push(resetAction);
      continue;
    }

    if (behavior === 'close') {
      if (options.overlayNodeId) {
        const closeAction = createDynamicAction('showHide');
        closeAction.targetNodeId = options.overlayNodeId;
        closeAction.showHideEffect = 'hide';
        trueActions.push(closeAction);
      } else if (
        options.warnOnMissingCloseTarget !== false
        && typeof console !== 'undefined'
        && typeof console.warn === 'function'
      ) {
        // Bug found (parity audit item 88): close with no overlay ancestor was a silent no-op.
        console.warn(
          '[Component Designer] Form success option "Close dialog" has no Modal/Drawer ancestor — it will have no effect.',
        );
      }
    }
  }

  return { trueActions, invalidateQueries };
};

export const buildFormBindingWizardActions = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  config: FormBindingWizardConfig,
): FormBindingWizardDispatchAction[] => {
  const actions: FormBindingWizardDispatchAction[] = [];
  const regionNode = document.nodes[config.regionNodeId];
  const dataSource = bindingDefinitions.dataSources[config.dataSourceId];

  if (!regionNode || !dataSource || !isDataRegionEligibleContainer(regionNode)) {
    return actions;
  }

  const loadConfig = resolveWizardLoadConfig(config.scenario, dataSource);

  actions.push({
    type: 'set-node-binding',
    nodeId: config.regionNodeId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(config.dataSourceId, loadConfig),
  });

  for (const mapping of config.fieldMappings) {
    const bindingKey = propertyBindingKeyForProp(mapping.fieldKey);
    if (!mapping.enabled || mapping.column.trim().length === 0) {
      actions.push({
        type: 'remove-node-binding',
        nodeId: mapping.nodeId,
        bindingKey,
      });
      continue;
    }

    actions.push({
      type: 'set-node-binding',
      nodeId: mapping.nodeId,
      bindingKey,
      definition: createRegionColumnBindingDefinition(mapping.fieldKey, mapping.column.trim()),
    });
  }

  const shouldAttachSubmit = config.scenario !== 'detail' && config.scenario !== 'search';
  if (shouldAttachSubmit) {
    const submitNodeId = config.submitNodeId ?? findDefaultSubmitNodeId(document, config.regionNodeId);
    if (submitNodeId) {
      const submitDefinition: DesignerBindingDefinition = {
        ...createRegionSubmitEventBindingDefinition(config.submitEventTarget),
      };

      const behaviors = normalizeFormBindingSuccessBehaviors(config);
      const { trueActions, invalidateQueries } = buildFormSuccessTrueActions({
        behaviors,
        dataSourceId: config.dataSourceId,
        regionNodeId: config.regionNodeId,
        overlayNodeId: findAncestorOverlayNodeId(document, config.regionNodeId),
      });

      if (trueActions.length > 0) {
        submitDefinition.trueActions = trueActions;
      }
      if (invalidateQueries.length > 0) {
        submitDefinition.invalidateQueries = invalidateQueries;
      }

      actions.push({
        type: 'set-node-binding',
        nodeId: submitNodeId,
        bindingKey: `event:${config.submitEventTarget}`,
        definition: submitDefinition,
      });
    }
  }

  return actions;
};

export const findDefaultSubmitNodeId = (
  document: DesignerDocument,
  regionNodeId: string,
): string | undefined => {
  const regionNode = document.nodes[regionNodeId];
  if (!regionNode) {
    return undefined;
  }

  if (regionNode.type === 'html' && resolveNodePaletteItemId(regionNode) === 'html.form') {
    return regionNodeId;
  }

  const descendants = collectDescendantIds(document, regionNodeId);
  for (const nodeId of descendants) {
    const node = document.nodes[nodeId];
    const paletteItemId = node ? resolveNodePaletteItemId(node) : undefined;
    if (
      paletteItemId === 'heroui.button-solid'
      || paletteItemId === 'heroui.button-outline'
    ) {
      return nodeId;
    }
  }

  return regionNodeId;
};

export const summarizeFormBindingPreview = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  config: FormBindingWizardConfig,
): {
  loadEndpoint?: string;
  submitMethod: string;
  submitEndpoint: string;
  mappedFieldCount: number;
  totalFieldCount: number;
} => {
  const dataSource = bindingDefinitions.dataSources[config.dataSourceId];
  const resource = dataSource ? dataSourceToResource(dataSource) : undefined;
  const mappedFieldCount = config.fieldMappings.filter((mapping) => mapping.enabled && mapping.column.trim().length > 0).length;
  const totalFieldCount = config.fieldMappings.length;

  let submitMethod = 'POST';
  let submitEndpoint = resource?.baseEndpoint ?? '';

  if (config.scenario === 'edit' || config.scenario === 'createEdit') {
    submitMethod = resource?.primaryKey ? 'PUT (when id present) / POST (when missing)' : 'POST';
    submitEndpoint = resource?.operations.update?.endpoint ?? submitEndpoint;
  } else if (config.scenario === 'create') {
    submitMethod = 'POST';
    submitEndpoint = resource?.operations.create?.endpoint ?? submitEndpoint;
  }

  const loadEndpoint = config.scenario === 'edit' || config.scenario === 'detail' || config.scenario === 'createEdit'
    ? resource?.operations.detail?.endpoint
    : undefined;

  const existingMappings = collectRegionFormFieldMappings(document, config.regionNodeId, bindingDefinitions);
  if (mappedFieldCount === 0 && existingMappings.length > 0) {
    return {
      loadEndpoint,
      submitMethod,
      submitEndpoint,
      mappedFieldCount: existingMappings.length,
      totalFieldCount: Math.max(totalFieldCount, existingMappings.length),
    };
  }

  return {
    loadEndpoint,
    submitMethod,
    submitEndpoint,
    mappedFieldCount,
    totalFieldCount,
  };
};
