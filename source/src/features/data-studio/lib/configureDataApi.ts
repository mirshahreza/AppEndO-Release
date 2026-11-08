import {
  deriveConfigureDataApiKey,
} from '../../../shared/lib/dataApiManagedFunctions';
import { operationSupportsWriteFields } from '../../../shared/lib/edgeApiOperations';
import type { EdgeApiDefinition, EdgeApiOperation, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import {
  defaultEdgeApiAccessControl,
  defaultEdgeApiRuntimeSettings,
} from '../../../shared/api/contracts/data-api';
import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';
import { validateLatinSlug } from '../../../shared/lib/latinSlug';
import {
  type RouteComposerOption,
  type RouteValidationField,
} from './routeComposerTypes';
import {
  composerOptionRequiresPrimaryKey,
  getComposerOptionSelectLabel,
  getComposerOptionsForObjectType,
  routeEntrySupportsFieldEditing,
  routeEntrySupportsOutputFieldEditing,
  slugifyRouteSegment,
  stripSchemaPrefix,
  suggestFieldsForOption,
  suggestOutputFieldsForOption,
  toUrlFriendlySlug,
} from './dataApiRouteMethods';
import {
  defaultConfigureDataApiQueryOptions,
  buildDefaultIncludeConfigs,
} from './configureDataApiHydration';
import type { ConfigureDataApiFormState } from './configureDataApiTypes';
import {
  defaultWriteClientContext,
} from '../../../shared/api/contracts/client-context';
import {
  emptyChangeReasonPolicyForm,
  pruneChangeReasonPolicy,
} from '../../../shared/ui';

export type {
  ConfigureDataApiComputedField,
  ConfigureDataApiConfigTabId,
  ConfigureDataApiDialogMode,
  ConfigureDataApiEnrichment,
  ConfigureDataApiFormState,
  ConfigureDataApiIncludeConfig,
  ConfigureDataApiQueryOptions,
} from './configureDataApiTypes';

export {
  buildDefaultIncludeConfigs,
  createDefaultEnrichmentForField,
  defaultConfigureDataApiQueryOptions,
  findMatchingOperationForModel,
  hydrateConfigureDataApiFormFromOperation,
  mergeOperationIntoDefinition,
  resolveOperationIdForForm,
  suggestEnrichmentOutputField,
} from './configureDataApiHydration';

export type ConfigureDataApiObjectType = 'TABLE' | 'VIEW';

const MODEL_API_NAME_SUGGESTIONS: Record<RouteComposerOption, string> = {
  GET_LIST: 'list',
  GET_ONE: 'read-by-key',
  GET_LOOKUP: 'lookup',
  POST: 'create',
  PUT: 'update',
  PATCH: 'patch',
  DELETE: 'delete',
  POST_PIVOT: 'pivot',
};

export const extractApiNameSlugFromRoutePath = (
  routePath: string,
  folderSlug: string,
): string | null => {
  const normalized = routePath.trim();
  const prefix = `/api/${folderSlug}/`;
  if (!normalized.startsWith(prefix)) {
    return null;
  }

  const remainder = normalized.slice(prefix.length);
  const firstSegment = remainder.split('/').filter(Boolean)[0];
  if (!firstSegment || firstSegment.startsWith(':')) {
    return null;
  }

  return slugifyRouteSegment(firstSegment) || null;
};

export type ReservedApiRouteCandidate = {
  path: string;
  engineType?: string | null;
  metadataJson?: Record<string, unknown> | null;
};

const isDataApiRouteCandidate = (candidate: ReservedApiRouteCandidate): boolean => (
  candidate.engineType === 'DATA_API' || candidate.metadataJson?.origin === 'data-api'
);

const definitionOwnsApiNameSlug = (
  definitions: EdgeApiDefinition[],
  edgeModelId: string,
  folderSlug: string,
  slug: string,
): boolean => (
  definitions.some((definition) => {
    if (definition.edgeModelId !== edgeModelId) {
      return false;
    }

    const paths = [
      definition.basePath,
      ...definition.operations.map((operation) => operation.pathPattern),
    ];

    return paths.some((routePath) => (
      extractApiNameSlugFromRoutePath(routePath, folderSlug) === slug
    ));
  })
);

const shouldIgnoreRouteCandidateForReservation = (
  candidate: ReservedApiRouteCandidate,
  definitions: EdgeApiDefinition[],
  edgeModelId: string,
  folderSlug: string,
): boolean => {
  if (!isDataApiRouteCandidate(candidate)) {
    return false;
  }

  const definitionId = candidate.metadataJson?.edgeApiDefinitionId;
  if (typeof definitionId === 'string' && definitionId.length > 0) {
    return !definitions.some((definition) => definition.id === definitionId);
  }

  const slug = extractApiNameSlugFromRoutePath(candidate.path, folderSlug);
  if (!slug) {
    return true;
  }

  return !definitionOwnsApiNameSlug(definitions, edgeModelId, folderSlug, slug);
};

const normalizeReservedApiRouteCandidate = (
  candidate: string | ReservedApiRouteCandidate,
): ReservedApiRouteCandidate => (
  typeof candidate === 'string' ? { path: candidate } : candidate
);

export const isEdgeApiDefinitionActiveForReservation = (
  definition: EdgeApiDefinition,
  activeManagedFunctionIds?: ReadonlySet<string>,
): boolean => {
  if (!definition.publishedAt) {
    return true;
  }

  if (!activeManagedFunctionIds) {
    return true;
  }

  if (!definition.managedFunctionId) {
    return false;
  }

  return activeManagedFunctionIds.has(definition.managedFunctionId);
};

export const collectReservedApiNameSlugsForObject = (
  objectName: string,
  edgeModelId: string,
  definitions: EdgeApiDefinition[],
  routeCandidates: Array<string | ReservedApiRouteCandidate> = [],
  options?: {
    activeManagedFunctionIds?: ReadonlySet<string>;
  },
): string[] => {
  const folderSlug = deriveObjectFolderSlug(objectName);
  const reserved = new Set<string>();

  for (const definition of definitions) {
    if (definition.edgeModelId !== edgeModelId) {
      continue;
    }

    if (!isEdgeApiDefinitionActiveForReservation(definition, options?.activeManagedFunctionIds)) {
      continue;
    }

    const definitionKeySlug = slugifyRouteSegment(definition.key);
    if (definitionKeySlug) {
      reserved.add(definitionKeySlug);
    }

    for (const operation of definition.operations) {
      const slug = extractApiNameSlugFromRoutePath(operation.pathPattern, folderSlug);
      if (slug) {
        reserved.add(slug);
      }
    }

    const baseSlug = extractApiNameSlugFromRoutePath(definition.basePath, folderSlug);
    if (baseSlug) {
      reserved.add(baseSlug);
    }
  }

  for (const routeCandidate of routeCandidates) {
    const candidate = normalizeReservedApiRouteCandidate(routeCandidate);
    if (shouldIgnoreRouteCandidateForReservation(candidate, definitions, edgeModelId, folderSlug)) {
      continue;
    }

    const slug = extractApiNameSlugFromRoutePath(candidate.path, folderSlug);
    if (slug) {
      reserved.add(slug);
    }
  }

  return Array.from(reserved).sort();
};

export const suggestConfigureDataApiName = (
  model: RouteComposerOption,
  reservedNames: string[],
): string => {
  const base = MODEL_API_NAME_SUGGESTIONS[model] ?? 'api';
  const reserved = new Set(reservedNames.map((name) => slugifyRouteSegment(name)).filter(Boolean));

  if (!reserved.has(base)) {
    return base;
  }

  let counter = 2;
  while (reserved.has(`${base}-${counter}`)) {
    counter += 1;
  }

  return `${base}-${counter}`;
};

export const excludeDefinitionApiNameSlugsFromReserved = (
  objectName: string,
  definition: EdgeApiDefinition,
  reservedNames: string[],
): string[] => {
  const folderSlug = deriveObjectFolderSlug(objectName);
  const ownSlugs = new Set<string>();

  const addSlug = (value: string | null | undefined) => {
    if (!value) {
      return;
    }
    const slug = slugifyRouteSegment(value);
    if (slug) {
      ownSlugs.add(slug);
    }
  };

  addSlug(definition.key);
  addSlug(extractApiNameSlugFromRoutePath(definition.basePath, folderSlug));
  for (const operation of definition.operations) {
    addSlug(extractApiNameSlugFromRoutePath(operation.pathPattern, folderSlug));
  }

  return reservedNames.filter((name) => !ownSlugs.has(slugifyRouteSegment(name)));
};

export const validateConfigureDataApiName = (
  apiName: string,
  options: {
    required?: boolean;
    reservedNames?: string[];
    objectName?: string;
    republishingKey?: string | null;
  } = {},
): string | null => {
  const formatError = validateLatinSlug(apiName, {
    fieldLabel: 'API name',
    required: options.required,
  });
  if (formatError) {
    return formatError;
  }

  const trimmed = apiName.trim();
  if (!trimmed) {
    return null;
  }

  const slug = slugifyRouteSegment(trimmed);
  const reserved = new Set((options.reservedNames ?? []).map((name) => slugifyRouteSegment(name)).filter(Boolean));

  if (!reserved.has(slug)) {
    return null;
  }

  if (options.objectName && options.republishingKey) {
    const key = deriveDataApiKey(options.objectName, trimmed);
    if (key === options.republishingKey) {
      return null;
    }
  }

  return 'An API with this name already exists in this folder.';
};


export const deriveObjectFolderSlug = (objectName: string): string => {
  const slug = toUrlFriendlySlug(stripSchemaPrefix(objectName));
  return slug || 'object';
};

export const deriveDataApiLabelFromName = (apiName: string): string => (
  apiName
    .trim()
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
);

export const deriveDataApiKey = (_objectName: string, apiName: string): string => (
  deriveConfigureDataApiKey(apiName)
);

export const buildConfigureDataApiPath = (
  objectName: string,
  apiName: string,
  model: RouteComposerOption,
  primaryKey: string,
  objectType: ConfigureDataApiObjectType = 'TABLE',
): string => {
  const folderSlug = deriveObjectFolderSlug(objectName);
  const apiSlug = slugifyRouteSegment(apiName) || 'api';
  const pkSegment = slugifyRouteSegment(primaryKey) || 'id';
  const base = `/api/${folderSlug}/${apiSlug}`;

  if (composerOptionRequiresPrimaryKey(model, objectType)) {
    return `${base}/:${pkSegment}`;
  }

  return base;
};

const resolveMethodOption = (option: RouteComposerOption): {
  method: EdgeApiOperation['method'];
  kind: EdgeApiOperation['kind'];
} => {
  switch (option) {
    case 'GET_LIST':
      return { method: 'GET', kind: 'list' };
    case 'GET_ONE':
      return { method: 'GET', kind: 'getOne' };
    case 'GET_LOOKUP':
      return { method: 'GET', kind: 'lookup' };
    case 'POST':
      return { method: 'POST', kind: 'create' };
    case 'PUT':
      return { method: 'PUT', kind: 'update' };
    case 'PATCH':
      return { method: 'PATCH', kind: 'patch' };
    case 'DELETE':
      return { method: 'DELETE', kind: 'delete' };
    case 'POST_PIVOT':
      return { method: 'POST', kind: 'pivot' };
    default:
      return { method: 'GET', kind: 'list' };
  }
};

const columnNamesToModelFields = (
  model: EdgeModelDefinition | undefined,
  columnNames: string[],
): string[] => (
  columnNames.map((name) => {
    const column = model?.columns.find((item) => item.name === name);
    return column?.field ?? name;
  })
);

const validationFieldsToWriteFields = (
  model: EdgeModelDefinition | undefined,
  fields: RouteValidationField[],
): { write: string[]; required: string[] } => {
  if (fields.length === 0) {
    return { write: [], required: [] };
  }

  const write = fields
    .map((field) => {
      const column = model?.columns.find((item) => item.name === field.name);
      return column?.field ?? field.name;
    })
    .filter(Boolean);

  const required = fields
    .filter((field) => field.required)
    .map((field) => {
      const column = model?.columns.find((item) => item.name === field.name);
      return column?.field ?? field.name;
    })
    .filter(Boolean);

  return { write, required };
};

export const getConfigureDataApiModelOptions = (
  objectType: ConfigureDataApiObjectType,
): RouteComposerOption[] => getComposerOptionsForObjectType(objectType);

export const getConfigureDataApiModelLabel = (
  option: RouteComposerOption,
  objectType: ConfigureDataApiObjectType,
): string => getComposerOptionSelectLabel(option, objectType);

export const supportsConfigureDataApiInputFields = (
  model: RouteComposerOption,
  objectType: ConfigureDataApiObjectType,
): boolean => routeEntrySupportsFieldEditing(model, objectType);

export const supportsConfigureDataApiOutputFields = (
  model: RouteComposerOption,
  objectType: ConfigureDataApiObjectType,
): boolean => routeEntrySupportsOutputFieldEditing(model, objectType);

export const createDefaultConfigureDataApiFormState = (
  objectType: ConfigureDataApiObjectType,
  columnOptions: SchemaFieldInfo[],
  primaryKey: string,
  modelDefinition?: EdgeModelDefinition,
): ConfigureDataApiFormState => {
  const model = getConfigureDataApiModelOptions(objectType)[0] ?? 'GET_LIST';
  return {
    apiName: '',
    model,
    outputFields: suggestOutputFieldsForOption(model, objectType, columnOptions),
    inputFields: suggestFieldsForOption(model, objectType, columnOptions, primaryKey),
    enrichments: [],
    includeConfigs: buildDefaultIncludeConfigs(modelDefinition),
    computedFields: [],
    queryOptions: defaultConfigureDataApiQueryOptions(),
    accessControl: defaultEdgeApiAccessControl(),
    runtime: defaultEdgeApiRuntimeSettings(),
    recordScopeMode: 'default',
    recordPolicyId: '',
    bypassRecordPolicy: false,
    clientContextFields: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(model)
      ? defaultWriteClientContext().fields
      : [],
    changeReason: emptyChangeReasonPolicyForm(),
  };
};

export const refreshConfigureDataApiFieldsForModel = (
  state: ConfigureDataApiFormState,
  objectType: ConfigureDataApiObjectType,
  columnOptions: SchemaFieldInfo[],
  primaryKey: string,
  modelDefinition?: EdgeModelDefinition,
): ConfigureDataApiFormState => ({
  ...state,
  outputFields: supportsConfigureDataApiOutputFields(state.model, objectType)
    ? suggestOutputFieldsForOption(state.model, objectType, columnOptions)
    : [],
  inputFields: supportsConfigureDataApiInputFields(state.model, objectType)
    ? suggestFieldsForOption(state.model, objectType, columnOptions, primaryKey)
    : [],
  enrichments: state.enrichments.filter((item) => (
    columnOptions.some((column) => column.name === item.sourceField)
    || (modelDefinition?.columns.some((column) => column.field === item.sourceField) ?? false)
  )),
  includeConfigs: state.includeConfigs.length > 0
    ? state.includeConfigs
    : buildDefaultIncludeConfigs(modelDefinition),
});

export const buildConfigureDataApiOperation = (
  objectName: string,
  objectType: ConfigureDataApiObjectType,
  form: ConfigureDataApiFormState,
  primaryKey: string,
  modelDefinition?: EdgeModelDefinition,
): EdgeApiOperation => {
  const { method, kind } = resolveMethodOption(form.model);
  const pathPattern = buildConfigureDataApiPath(
    objectName,
    form.apiName,
    form.model,
    primaryKey || 'id',
    objectType,
  );
  const operation: EdgeApiOperation = {
    id: form.operationId ?? `op_${kind}`,
    method,
    kind,
    pathPattern,
    enabled: true,
  };

  if (kind === 'list' || kind === 'getOne' || kind === 'pivot') {
    const queryOptions = form.queryOptions ?? defaultConfigureDataApiQueryOptions();
    operation.query = {
      allowFilter: queryOptions.allowFilter,
      allowSort: queryOptions.allowSort,
      maxPageSize: queryOptions.maxPageSize,
      defaultPageSize: kind === 'getOne' ? 1 : queryOptions.defaultPageSize,
      allowLangParam: queryOptions.allowLangParam,
      includes: (form.includeConfigs ?? []).filter((item) => item.enabled).map((item) => item.as),
      ...(kind === 'list' && queryOptions.forcedPresetIds.length > 0
        ? { forcedPresetIds: [...queryOptions.forcedPresetIds] }
        : {}),
      ...(kind === 'list' && queryOptions.clientPresetIds.length > 0
        ? { clientPresetIds: [...queryOptions.clientPresetIds] }
        : {}),
      ...(kind === 'list' && queryOptions.listCountMode === 'none'
        ? { countMode: 'none' as const }
        : {}),
      ...(kind === 'list' && queryOptions.listCountMode === 'exact'
        ? { countMode: 'exact' as const }
        : {}),
      ...(kind === 'list' && queryOptions.listCountMode === 'query'
        ? { defaultIncludeCount: queryOptions.defaultIncludeCountWhenQuery }
        : {}),
    };
  }

  const enrichments = form.enrichments ?? [];
  if (enrichments.length > 0) {
    operation.enrichments = enrichments.map((item) => ({ ...item }));
  }

  const enabledIncludeConfigs = (form.includeConfigs ?? []).filter((item) => item.enabled);
  if (enabledIncludeConfigs.length > 0) {
    operation.includeConfigs = enabledIncludeConfigs.map((item) => ({ ...item }));
  }

  const computedFields = form.computedFields ?? [];
  if (computedFields.length > 0) {
    operation.computedFields = computedFields.map((item) => ({ ...item }));
  }

  if (supportsConfigureDataApiOutputFields(form.model, objectType) && form.outputFields.length > 0) {
    operation.fields = {
      ...operation.fields,
      read: columnNamesToModelFields(modelDefinition, form.outputFields),
    };
  }

  if (operationSupportsWriteFields(kind)) {
    const { write, required } = validationFieldsToWriteFields(modelDefinition, form.inputFields);
    if (write.length > 0 || required.length > 0) {
      operation.fields = {
        ...operation.fields,
        write: write.length > 0 ? write : undefined,
        required: required.length > 0 ? required : undefined,
      };
    }
  }

  if (form.recordScopeMode === 'bypass') {
    operation.bypassRecordPolicy = true;
  } else if (form.recordScopeMode === 'policy') {
    const policyId = form.recordPolicyId.trim();
    if (policyId) {
      operation.recordPolicyId = policyId;
    }
  }

  const clientContextFields = (form.clientContextFields ?? []).filter((field) => field.mode !== 'off');
  if (clientContextFields.length > 0) {
    operation.clientContext = { fields: clientContextFields };
  }

  return operation;
};

export const buildConfigureDataApiDefinitionPayload = (
  objectName: string,
  form: ConfigureDataApiFormState,
) => {
  const apiSlug = slugifyRouteSegment(form.apiName) || 'api';
  const folderSlug = deriveObjectFolderSlug(objectName);

  return {
    key: deriveDataApiKey(objectName, form.apiName),
    label: deriveDataApiLabelFromName(form.apiName),
    basePath: `/api/${folderSlug}/${apiSlug}`,
    changeReason: pruneChangeReasonPolicy(form.changeReason ?? emptyChangeReasonPolicyForm()),
  };
};
