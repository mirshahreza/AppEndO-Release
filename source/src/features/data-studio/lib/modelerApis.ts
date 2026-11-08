import type { EdgeApiDefinition, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { ServerFunctionItem } from '../../../shared/api/contracts/server-functions/types';
import {
  listPlatformApisForObject,
  normalizePlatformApiPath,
  platformPathBelongsToObject,
  type PlatformObjectApiMethod,
} from '../../../shared/lib/baseObjectPlatformApis';

export type ModelerApiRowSource = 'data-api' | 'platform' | 'function';

export type ModelerApiOperationRow = {
  id: string;
  source: ModelerApiRowSource;
  method: PlatformObjectApiMethod;
  path: string;
  label: string;
  definition?: EdgeApiDefinition;
  function?: ServerFunctionItem;
};

export type ListModelerApisInput = {
  objectName: string;
  modelId: string;
  definitions: EdgeApiDefinition[];
  models?: EdgeModelDefinition[];
  functions?: ServerFunctionItem[];
};

const SOURCE_RANK: Record<ModelerApiRowSource, number> = {
  'data-api': 0,
  function: 1,
  platform: 2,
};

const normalizeObjectName = (value: string): string => value.trim().toLowerCase();

const parseMetadataRecord = (metadataJson: unknown): Record<string, unknown> | null => {
  if (!metadataJson) {
    return null;
  }
  if (typeof metadataJson === 'string') {
    try {
      const parsed = JSON.parse(metadataJson) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  if (typeof metadataJson === 'object' && !Array.isArray(metadataJson)) {
    return metadataJson as Record<string, unknown>;
  }
  return null;
};

const readMetadataObjectName = (metadataJson: unknown): string | null => {
  const record = parseMetadataRecord(metadataJson);
  const model = record?.model;
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return null;
  }
  const objectName = (model as { objectName?: unknown }).objectName;
  return typeof objectName === 'string' && objectName.trim() ? objectName.trim() : null;
};

const readMetadataEdgeApiDefinitionId = (metadataJson: unknown): string | null => {
  const record = parseMetadataRecord(metadataJson);
  const id = record?.edgeApiDefinitionId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
};

const operationKey = (method: string, path: string): string => (
  `${method.toUpperCase()} ${normalizePlatformApiPath(path)}`
);

const collectMatchingDefinitionIds = (input: ListModelerApisInput): Set<string> => {
  const objectName = normalizeObjectName(input.objectName);
  const modelIds = new Set<string>([input.modelId]);
  for (const model of input.models ?? []) {
    if (normalizeObjectName(model.objectName) === objectName) {
      modelIds.add(model.id);
    }
  }

  const definitionIds = new Set<string>();
  for (const definition of input.definitions) {
    if (modelIds.has(definition.edgeModelId)) {
      definitionIds.add(definition.id);
    }
  }

  for (const fn of input.functions ?? []) {
    if (normalizeObjectName(readMetadataObjectName(fn.metadataJson) ?? '') !== objectName) {
      continue;
    }
    const definitionId = readMetadataEdgeApiDefinitionId(fn.metadataJson);
    if (definitionId) {
      definitionIds.add(definitionId);
    }
  }

  return definitionIds;
};

const functionBelongsToObject = (fn: ServerFunctionItem, objectName: string): boolean => {
  const metaObjectName = readMetadataObjectName(fn.metadataJson);
  if (metaObjectName && normalizeObjectName(metaObjectName) === normalizeObjectName(objectName)) {
    return true;
  }
  return platformPathBelongsToObject(fn.path, objectName);
};

export const listModelerApisForObject = (
  objectName: string,
  modelId: string,
  definitions: EdgeApiDefinition[],
  models: EdgeModelDefinition[] = [],
  functions: ServerFunctionItem[] = [],
): ModelerApiOperationRow[] => {
  const input: ListModelerApisInput = { objectName, modelId, definitions, models, functions };
  const matchingDefinitionIds = collectMatchingDefinitionIds(input);
  const rows = new Map<string, ModelerApiOperationRow>();

  const take = (row: ModelerApiOperationRow): void => {
    const key = operationKey(row.method, row.path);
    const existing = rows.get(key);
    if (!existing || SOURCE_RANK[row.source] < SOURCE_RANK[existing.source]) {
      rows.set(key, row);
    }
  };

  for (const definition of definitions) {
    if (!matchingDefinitionIds.has(definition.id)) {
      continue;
    }
    for (const operation of definition.operations) {
      if (!operation.enabled) {
        continue;
      }
      take({
        id: `${definition.id}:${operation.id}`,
        source: 'data-api',
        method: operation.method,
        path: operation.pathPattern,
        label: `${definition.label} · ${operation.kind}`,
        definition,
      });
    }
  }

  for (const fn of functions) {
    if (!functionBelongsToObject(fn, objectName)) {
      continue;
    }
    take({
      id: `fn:${fn.id}`,
      source: 'function',
      method: fn.method,
      path: fn.path,
      label: fn.name,
      function: fn,
    });
  }

  for (const api of listPlatformApisForObject(objectName)) {
    for (const operation of api.operations) {
      take({
        id: `platform:${api.key}:${operation.method}:${operation.pathPattern}`,
        source: 'platform',
        method: operation.method,
        path: operation.pathPattern,
        label: api.label,
      });
    }
  }

  return [...rows.values()].sort((left, right) => {
    const byPath = left.path.localeCompare(right.path);
    if (byPath !== 0) {
      return byPath;
    }
    return left.method.localeCompare(right.method);
  });
};
