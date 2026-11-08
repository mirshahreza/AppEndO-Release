import type {
  EdgeApiDefinition,
  EdgeApiOperation,
  EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';
import {
  defaultEdgeApiAccessControl,
  defaultEdgeApiRuntimeSettings,
} from '../../../shared/api/contracts/data-api';
import { defaultWriteClientContext } from '../../../shared/api/contracts/client-context';
import {
  changeReasonPolicyFromMeta,
} from '../../../shared/ui';
import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';
import { resolveBaseInfoRootForField } from '../../../domain/component-designer/baseInfoFieldInference';
import type { RouteComposerOption } from './routeComposerTypes';
import {
  composerOptionRequiresPrimaryKey,
} from './dataApiRouteMethods';
import type {
  ConfigureDataApiComputedField,
  ConfigureDataApiEnrichment,
  ConfigureDataApiFormState,
  ConfigureDataApiIncludeConfig,
  ConfigureDataApiQueryOptions,
} from './configureDataApiTypes';
import {
  buildConfigureDataApiPath,
  deriveObjectFolderSlug,
  extractApiNameSlugFromRoutePath,
} from './configureDataApi';

const createId = (prefix: string): string => (
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`
);

export const defaultConfigureDataApiQueryOptions = (): ConfigureDataApiQueryOptions => ({
  allowFilter: true,
  allowSort: true,
  maxPageSize: 100,
  defaultPageSize: 20,
  allowLangParam: true,
  forcedPresetIds: [],
  clientPresetIds: [],
  listCountMode: 'inherit',
  defaultIncludeCountWhenQuery: true,
});

export const buildDefaultIncludeConfigs = (
  model: EdgeModelDefinition | undefined,
): ConfigureDataApiIncludeConfig[] => (
  (model?.associations ?? []).map((association) => ({
    as: association.as,
    enabled: false,
    separate: association.kind === 'hasMany' || association.kind === 'belongsToMany'
      ? true
      : undefined,
  }))
);

export const suggestEnrichmentOutputField = (sourceField: string): string => {
  if (sourceField.endsWith('_code')) {
    return `${sourceField.slice(0, -5)}_title`;
  }
  if (sourceField.endsWith('Code')) {
    return `${sourceField.slice(0, -4)}Title`;
  }
  if (sourceField.endsWith('Id') || sourceField.endsWith('_id')) {
    return `${sourceField}_Title`;
  }
  return `${sourceField}_Title`;
};

export const createDefaultEnrichmentForField = (
  sourceField: string,
  model?: EdgeModelDefinition,
): ConfigureDataApiEnrichment | null => {
  const column = model?.columns.find((item) => item.field === sourceField || item.name === sourceField);
  const fieldName = column?.name ?? sourceField;
  const rootId = resolveBaseInfoRootForField(fieldName);
  if (!rootId) {
    return null;
  }

  return {
    id: createId('enrich'),
    sourceField: column?.field ?? sourceField,
    kind: 'base_info_title',
    joinTableSource: 'base_info',
    rootId,
    outputField: suggestEnrichmentOutputField(column?.field ?? sourceField),
    langSource: 'query:lang',
    includeUiMeta: false,
  };
};

const modelFieldsToColumnNames = (
  model: EdgeModelDefinition | undefined,
  fields: string[] | undefined,
): string[] => {
  if (!fields || fields.length === 0) {
    return [];
  }

  return fields.map((field) => {
    const column = model?.columns.find((item) => item.field === field || item.name === field);
    return column?.name ?? field;
  });
};

const resolveComposerOptionFromOperation = (
  operation: EdgeApiOperation,
  objectType: 'TABLE' | 'VIEW',
  primaryKey: string,
): RouteComposerOption => {
  switch (operation.kind) {
    case 'list':
      return 'GET_LIST';
    case 'getOne':
      return 'GET_ONE';
    case 'lookup':
      return 'GET_LOOKUP';
    case 'create':
      return 'POST';
    case 'update':
      return 'PUT';
    case 'patch':
      return 'PATCH';
    case 'delete':
      return 'DELETE';
    case 'pivot':
      return 'POST_PIVOT';
    default:
      return composerOptionRequiresPrimaryKey('GET_ONE', objectType) ? 'GET_ONE' : 'GET_LIST';
  }
};

export const hydrateConfigureDataApiFormFromOperation = (
  definition: EdgeApiDefinition,
  operation: EdgeApiOperation,
  objectName: string,
  objectType: 'TABLE' | 'VIEW',
  model: EdgeModelDefinition,
  columnOptions: SchemaFieldInfo[],
  primaryKey: string,
): ConfigureDataApiFormState => {
  const folderSlug = deriveObjectFolderSlug(objectName);
  const apiName = extractApiNameSlugFromRoutePath(operation.pathPattern, folderSlug)
    ?? definition.key;

  const inputFields = (operation.fields?.write ?? []).map((field) => {
    const column = model.columns.find((item) => item.field === field || item.name === field);
    return {
      id: createId('field'),
      name: column?.name ?? field,
      type: columnOptions.find((item) => item.name === column?.name)?.suggestedFieldType ?? 'string',
      required: (operation.fields?.required ?? []).includes(field),
    };
  });

  return {
    apiName,
    model: resolveComposerOptionFromOperation(operation, objectType, primaryKey),
    outputFields: modelFieldsToColumnNames(model, operation.fields?.read),
    inputFields,
    enrichments: (operation.enrichments ?? []).map((item) => {
      if (item.kind === 'base_info_title') {
        return {
          ...item,
          joinTableSource: item.joinTableSource ?? 'base_info',
        };
      }
      return { ...item };
    }),
    includeConfigs: (operation.includeConfigs && operation.includeConfigs.length > 0)
      ? operation.includeConfigs.map((item) => ({ ...item }))
      : buildDefaultIncludeConfigs(model),
    computedFields: (operation.computedFields ?? []).map((item) => ({ ...item })),
    queryOptions: {
      allowFilter: operation.query?.allowFilter ?? true,
      allowSort: operation.query?.allowSort ?? true,
      maxPageSize: operation.query?.maxPageSize ?? 100,
      defaultPageSize: operation.query?.defaultPageSize ?? 20,
      allowLangParam: operation.query?.allowLangParam ?? true,
      forcedPresetIds: operation.query?.forcedPresetIds ?? [],
      clientPresetIds: operation.query?.clientPresetIds ?? [],
      listCountMode: operation.query?.countMode === 'none'
        ? 'none'
        : operation.query?.countMode === 'exact'
          ? 'exact'
          : typeof operation.query?.defaultIncludeCount === 'boolean'
            ? 'query'
            : 'inherit',
      defaultIncludeCountWhenQuery: operation.query?.defaultIncludeCount ?? true,
    },
    accessControl: definition.accessControl ?? defaultEdgeApiAccessControl(),
    runtime: definition.runtime ?? defaultEdgeApiRuntimeSettings(),
    operationId: operation.id,
    definitionId: definition.id,
    recordScopeMode: operation.bypassRecordPolicy
      ? 'bypass'
      : operation.recordPolicyId
        ? 'policy'
        : 'default',
    recordPolicyId: operation.recordPolicyId ?? '',
    bypassRecordPolicy: Boolean(operation.bypassRecordPolicy),
    clientContextFields: operation.clientContext?.fields?.length
      ? operation.clientContext.fields
      : (['create', 'update', 'patch', 'delete'].includes(operation.kind)
        ? defaultWriteClientContext().fields
        : []),
    changeReason: changeReasonPolicyFromMeta(definition.changeReason),
  };
};

export const resolveOperationIdForForm = (
  form: ConfigureDataApiFormState,
  kind: EdgeApiOperation['kind'],
): string => form.operationId ?? `op_${kind}`;

export const mergeOperationIntoDefinition = (
  existingOperations: EdgeApiOperation[],
  nextOperation: EdgeApiOperation,
): EdgeApiOperation[] => {
  const index = existingOperations.findIndex((item) => item.id === nextOperation.id);
  if (index === -1) {
    return [...existingOperations, nextOperation];
  }

  const merged = [...existingOperations];
  merged[index] = nextOperation;
  return merged;
};

export const findMatchingOperationForModel = (
  definition: EdgeApiDefinition,
  model: RouteComposerOption,
  objectType: 'TABLE' | 'VIEW',
  primaryKey: string,
  objectName: string,
): EdgeApiOperation | null => {
  const expectedPath = buildConfigureDataApiPath(objectName, 'placeholder', model, primaryKey, objectType);
  const pathSuffix = expectedPath.replace('/placeholder', '');

  return definition.operations.find((operation) => {
    if (operation.kind === 'list' && model === 'GET_LIST') return true;
    if (operation.kind === 'getOne' && model === 'GET_ONE') return true;
    if (operation.kind === 'lookup' && model === 'GET_LOOKUP') return true;
    if (operation.kind === 'create' && model === 'POST') return true;
    if (operation.kind === 'update' && model === 'PUT') return true;
    if (operation.kind === 'patch' && model === 'PATCH') return true;
    if (operation.kind === 'delete' && model === 'DELETE') return true;
    if (operation.kind === 'pivot' && model === 'POST_PIVOT') return true;
    return operation.pathPattern.includes(pathSuffix.replace('/:id', ''));
  }) ?? definition.operations[0] ?? null;
};
