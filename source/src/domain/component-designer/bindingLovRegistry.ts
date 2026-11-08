import type { DesignerAutocompleteItem } from './designerAutocompleteItems';
import { sanitizeLiveMode } from './liveDataSource';
import type {
  DataSourceDefinition,
  DesignerApiOperation,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDataResourceKind,
  DesignerDataResourceOperations,
  DesignerResponseMapping,
  LovDefinition,
} from './types';

export type LovColumnMapping = {
  returnColumn: string;
  displayColumn: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const resolveLovDefinition = (
  registry: DesignerBindingDefinitions,
  lovRef: string | undefined,
): LovDefinition | undefined => {
  const key = lovRef?.trim();
  if (!key) {
    return undefined;
  }

  return registry.lovs[key];
};

export const resolvePropertyBindingLovMapping = (
  definition: DesignerBindingDefinition,
  registry: DesignerBindingDefinitions,
): LovColumnMapping | undefined => {
  const lov = resolveLovDefinition(registry, definition.lovRef);
  if (!lov) {
    return undefined;
  }

  const returnColumn = lov.returnValue.trim();
  const displayColumn = lov.displayValue.trim();
  if (!returnColumn || !displayColumn) {
    return undefined;
  }

  return { returnColumn, displayColumn };
};

export const resolvePropertyBindingFetchEndpoint = (
  definition: DesignerBindingDefinition,
  registry: DesignerBindingDefinitions,
): string | undefined => {
  const directEndpoint = definition.fetchEndpoint?.trim();
  if (directEndpoint) {
    return directEndpoint;
  }

  const lov = resolveLovDefinition(registry, definition.lovRef);
  const lovEndpoint = lov?.endpoint.trim();
  return lovEndpoint && lovEndpoint.length > 0 ? lovEndpoint : undefined;
};

export const mapLovApiItemsToSelectOptions = (
  payload: unknown,
  mapping: LovColumnMapping,
): DesignerAutocompleteItem[] => {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  const rawItems = Array.isArray(record?.items)
    ? record.items
    : Array.isArray(payload)
      ? payload
      : [];

  return rawItems
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const id = String(item[mapping.returnColumn] ?? '').trim();
      if (!id) {
        return null;
      }

      const label = String(item[mapping.displayColumn] ?? id).trim();
      return {
        id,
        textValue: label || id,
      };
    })
    .filter((entry): entry is DesignerAutocompleteItem => entry !== null);
};

export const findLovRefByEndpointAndColumns = (
  registry: DesignerBindingDefinitions,
  endpoint: string,
  returnColumn: string,
  displayColumn: string,
): string | undefined => {
  const normalizedEndpoint = endpoint.trim();
  if (!normalizedEndpoint) {
    return undefined;
  }

  for (const [lovId, lov] of Object.entries(registry.lovs)) {
    if (
      lov.endpoint.trim() === normalizedEndpoint
      && lov.returnValue.trim() === returnColumn.trim()
      && lov.displayValue.trim() === displayColumn.trim()
    ) {
      return lovId;
    }
  }

  return undefined;
};

const sanitizeApiOperation = (value: unknown): DesignerApiOperation | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const method = value.method;
  const endpoint = typeof value.endpoint === 'string' ? value.endpoint.trim() : '';
  if (!endpoint) {
    return undefined;
  }

  if (method !== 'GET' && method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return undefined;
  }

  const label = typeof value.label === 'string' && value.label.trim().length > 0
    ? value.label.trim()
    : undefined;

  return label ? { method, endpoint, label } : { method, endpoint };
};

const sanitizeCustomOperations = (
  value: unknown,
): Record<string, DesignerApiOperation> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const custom: Record<string, DesignerApiOperation> = {};
  for (const [rawKey, rawOperation] of Object.entries(value)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }
    const operation = sanitizeApiOperation(rawOperation);
    if (operation) {
      custom[key] = operation;
    }
  }

  return Object.keys(custom).length > 0 ? custom : undefined;
};

const sanitizeOperations = (value: unknown): DesignerDataResourceOperations | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const operations: DesignerDataResourceOperations = {};
  const list = sanitizeApiOperation(value.list);
  const detail = sanitizeApiOperation(value.detail);
  const create = sanitizeApiOperation(value.create);
  const update = sanitizeApiOperation(value.update);
  const del = sanitizeApiOperation(value.delete);
  const custom = sanitizeCustomOperations(value.custom);

  if (list) operations.list = list;
  if (detail) operations.detail = detail;
  if (create) operations.create = create;
  if (update) operations.update = update;
  if (del) operations.delete = del;
  if (custom) operations.custom = custom;

  return Object.keys(operations).length > 0 ? operations : undefined;
};

const sanitizeResponseMapping = (value: unknown): DesignerResponseMapping | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const mapping: DesignerResponseMapping = {};
  for (const key of ['dataPath', 'arrayPath', 'totalPath', 'errorPath'] as const) {
    const segment = value[key];
    if (typeof segment === 'string' && segment.trim().length > 0) {
      mapping[key] = segment.trim();
    }
  }

  return Object.keys(mapping).length > 0 ? mapping : undefined;
};

const sanitizeConnectorType = (
  value: unknown,
): import('./dataConnectorTypes').DesignerConnectorType | undefined => {
  if (
    value === 'internal-api'
    || value === 'rest-external'
    || value === 'graphql'
    || value === 'static-file'
  ) {
    return value;
  }
  return undefined;
};

const sanitizeGraphqlConfig = (
  value: unknown,
): import('./dataConnectorTypes').DataSourceGraphqlConfig | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const query = typeof value.query === 'string' ? value.query.trim() : '';
  if (!query) {
    return undefined;
  }
  const variables: Record<string, string> = {};
  if (isRecord(value.variables)) {
    for (const [key, entry] of Object.entries(value.variables)) {
      if (typeof entry === 'string' && key.trim()) {
        variables[key.trim()] = entry;
      }
    }
  }
  return {
    query,
    variables: Object.keys(variables).length > 0 ? variables : undefined,
  };
};

const sanitizeStaticFileConfig = (
  value: unknown,
): import('./dataConnectorTypes').DataSourceStaticFileConfig | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const path = typeof value.path === 'string' ? value.path.trim() : '';
  if (!path) {
    return undefined;
  }
  const format = value.format === 'csv' || value.format === 'json' ? value.format : undefined;
  return { path, format };
};

export const sanitizeDataSourceDefinition = (value: unknown, fallbackId: string): DataSourceDefinition | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim().length > 0 ? value.id.trim() : fallbackId.trim();
  if (!id) {
    return null;
  }

  const name = typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : id;
  const endpoint = typeof value.endpoint === 'string' ? value.endpoint.trim() : '';
  const primaryKey = typeof value.primaryKey === 'string' ? value.primaryKey.trim() : undefined;
  const fields = Array.isArray(value.fields)
    ? value.fields.filter((field): field is string => typeof field === 'string' && field.trim().length > 0).map((field) => field.trim())
    : [];

  const kind = value.kind;
  const normalizedKind = kind === 'collection' || kind === 'record' || kind === 'lov' || kind === 'custom'
    ? kind
    : undefined;

  const operations = sanitizeOperations(value.operations);
  const responseMapping = sanitizeResponseMapping(value.responseMapping);

  const pollingRaw = value.pollingIntervalMs;
  const pollingIntervalMs = typeof pollingRaw === 'number' && Number.isFinite(pollingRaw) && pollingRaw > 0
    ? Math.floor(pollingRaw)
    : undefined;

  const liveMode = sanitizeLiveMode(value.liveMode);

  const connectorType = sanitizeConnectorType(value.connectorType);
  const connectorRef = typeof value.connectorRef === 'string' && value.connectorRef.trim()
    ? value.connectorRef.trim()
    : undefined;
  const graphql = sanitizeGraphqlConfig(value.graphql);
  const staticFile = sanitizeStaticFileConfig(value.staticFile);

  return {
    id,
    name,
    endpoint,
    fields,
    primaryKey: primaryKey || undefined,
    kind: normalizedKind,
    operations,
    responseMapping,
    pollingIntervalMs,
    liveMode,
    connectorType,
    connectorRef,
    graphql,
    staticFile,
  };
};

export const sanitizeLovDefinition = (value: unknown, fallbackId: string): LovDefinition | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim().length > 0 ? value.id.trim() : fallbackId.trim();
  if (!id) {
    return null;
  }

  const name = typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : id;
  const endpoint = typeof value.endpoint === 'string' ? value.endpoint.trim() : '';
  const displayValue = typeof value.displayValue === 'string' ? value.displayValue.trim() : '';
  const returnValue = typeof value.returnValue === 'string' ? value.returnValue.trim() : '';

  return { id, name, endpoint, displayValue, returnValue };
};
