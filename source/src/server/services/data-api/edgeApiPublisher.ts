import {
  buildManagedFunctionId,
  deleteManagedFunctionFromStore,
  DuplicateFunctionIdentityError,
  DuplicateFunctionPathError,
  insertManagedFunctionToStore,
  listManagedFunctionsFromStore,
  updateManagedFunctionInStore,
} from '../../../core/functions/FunctionFileStore';
import { managedFunctionRouteRegistry } from '../managedFunctionRouteRegistry';
import type {
  EdgeApiDefinition,
  EdgeApiOperation,
} from '../../../shared/api/contracts/data-api';
import {
  createEdgeApiId,
  deleteEdgeApiDefinition,
  getEdgeApiDefinitionById,
  saveEdgeApiDefinition,
} from './edgeApiStore';
import { getEdgeModelById } from './edgeModelStore';
import {
  defaultEdgeApiAccessControl,
  defaultEdgeApiRuntimeSettings,
} from '../../../shared/api/contracts/data-api';
import { enrichEdgeApiOperationsFromModel } from '../../../shared/lib/edgeApiOperations';
import {
  buildDataApiManagedFunctionFolder,
  buildDataApiManagedFunctionName,
} from '../../../shared/lib/dataApiManagedFunctions';
import {
  ensureHwyMemberDirectoryListRuntime,
  isHwyMemberDirectoryManagedFunctionId,
} from '../../domain/hwy/ensureHwyMemberDirectoryListRuntime';
import {
  buildDataApiManagedFunctionMetadata,
  buildDataApiManagedFunctionTestPayload,
} from '../../../shared/api/openapi/buildDataApiFunctionMetadata';
import { buildDataApiPublishedRouteCode } from './dataApiRouteCodegen';
import { refreshOpenApiDocumentationCaches } from '../openApiDocRefresh';
import { buildCodeFingerprint } from '../../../shared/api/server-functions/buildFunctionDerivedMetadata';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';

const DATA_API_FOLDER = 'data-api';

const parseManagedFunctionMetadata = (
  metadataJson: string | null | undefined,
): Record<string, unknown> | null => {
  if (!metadataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const deleteStaleManagedFunctionsForDefinition = (
  definitionId: string,
  keepFunctionIds: ReadonlySet<string>,
): void => {
  for (const managedFunction of listManagedFunctionsFromStore()) {
    if (keepFunctionIds.has(managedFunction.id)) {
      continue;
    }

    const metadata = parseManagedFunctionMetadata(managedFunction.metadata_json);
    if (metadata?.edgeApiDefinitionId !== definitionId) {
      continue;
    }

    deleteManagedFunctionFromStore(managedFunction.id);
  }
};

const buildOperationMetadata = (
  definition: EdgeApiDefinition,
  operation: EdgeApiOperation,
  model: NonNullable<ReturnType<typeof getEdgeModelById>>,
  code: string,
): string => buildDataApiManagedFunctionMetadata(definition, operation, model, code);

const readDerivedCodeFingerprint = (
  metadataJson: string | null | undefined,
): string | null => {
  const metadata = parseManagedFunctionMetadata(metadataJson);
  const derived = metadata?.derived;
  if (!derived || typeof derived !== 'object' || Array.isArray(derived)) {
    return null;
  }
  const fingerprint = (derived as { codeFingerprint?: unknown }).codeFingerprint;
  return typeof fingerprint === 'string' ? fingerprint : null;
};

/** True when published managed functions already match generated route code (boot-safe no-op). */
export const isEdgeApiPublishCurrent = (
  definition: EdgeApiDefinition,
  model: EdgeModelDefinition,
  operations: EdgeApiOperation[],
): boolean => {
  if (!definition.publishedAt || operations.length === 0) {
    return false;
  }

  const functionFolder = buildDataApiManagedFunctionFolder(model.objectName);
  for (const operation of operations) {
    const functionName = buildDataApiManagedFunctionName(definition, operation);
    const functionId = buildManagedFunctionId(functionFolder, functionName);
    const existing = listManagedFunctionsFromStore().find((fn) => fn.id === functionId);
    if (!existing) {
      return false;
    }

    const code = buildDataApiPublishedRouteCode({
      definition,
      operation,
      model,
    });
    const fingerprint = buildCodeFingerprint(code);
    if (readDerivedCodeFingerprint(existing.metadata_json) !== fingerprint) {
      return false;
    }
  }

  return true;
};

export const createEdgeApiDefinitionDraft = (input: {
  edgeModelId: string;
  key: string;
  label: string;
  basePath: string;
  operations: EdgeApiOperation[];
}): EdgeApiDefinition => {
  const model = getEdgeModelById(input.edgeModelId);
  if (!model) {
    throw new Error(`Edge model not found: ${input.edgeModelId}`);
  }

  return {
    id: createEdgeApiId(),
    edgeModelId: input.edgeModelId,
    key: input.key,
    label: input.label,
    basePath: input.basePath,
    operations: input.operations,
    accessControl: defaultEdgeApiAccessControl(),
    openapi: { tags: ['Data API'] },
    publishedAt: null,
    version: 1,
    runtime: defaultEdgeApiRuntimeSettings(),
  };
};

export const publishEdgeApiDefinition = (definitionId: string): EdgeApiDefinition => {
  const definition = getEdgeApiDefinitionById(definitionId);
  if (!definition) {
    throw new Error(`Edge API definition not found: ${definitionId}`);
  }

  const model = getEdgeModelById(definition.edgeModelId);
  if (!model) {
    throw new Error(`Edge model not found: ${definition.edgeModelId}`);
  }

  const enrichedDefinition = saveEdgeApiDefinition({
    ...definition,
    operations: enrichEdgeApiOperationsFromModel(definition.operations, model),
  });

  const enabledOperations = enrichedDefinition.operations.filter((operation) => operation.enabled);
  if (enabledOperations.length === 0) {
    throw new Error('At least one operation must be enabled before publish.');
  }

  if (isEdgeApiPublishCurrent(enrichedDefinition, model, enabledOperations)) {
    return enrichedDefinition;
  }

  const managedFunctionIds: string[] = [];
  const previousManagedFunctionId = enrichedDefinition.managedFunctionId;
  const functionFolder = buildDataApiManagedFunctionFolder(model.objectName);

  for (const operation of enabledOperations) {
    const functionName = buildDataApiManagedFunctionName(enrichedDefinition, operation);
    const functionId = buildManagedFunctionId(functionFolder, functionName);
    managedFunctionIds.push(functionId);

    const code = buildDataApiPublishedRouteCode({
      definition: enrichedDefinition,
      operation,
      model,
    });

    const payload = {
      id: functionId,
      name: functionName,
      folder: functionFolder,
      method: operation.method,
      path: operation.pathPattern,
      code,
      language: 'ts',
      testPayload: buildDataApiManagedFunctionTestPayload(operation, model),
      runtimeVersion: 'v1',
      memoryLimit: 128,
      timeoutMs: enrichedDefinition.runtime.timeoutMs ?? 30_000,
      // Data API list routes often exceed the 1.5s global server-function timeout; default off.
      useGlobalConfig: enrichedDefinition.runtime.useGlobalConfig ?? false,
      enableLogs: enrichedDefinition.runtime.enableLogs ?? true,
      cacheEnabled: enrichedDefinition.runtime.cacheEnabled ?? false,
      cacheTtlMs: enrichedDefinition.runtime.cacheTtlMs ?? 60_000,
      cacheByParam: enrichedDefinition.runtime.cacheByParam ?? false,
      cacheByUser: enrichedDefinition.runtime.cacheByUser ?? false,
      engineType: 'DATA_API' as const,
      metadataJson: buildOperationMetadata(enrichedDefinition, operation, model, code),
      accessControl: enrichedDefinition.accessControl,
      hooks: enrichedDefinition.runtime.hooks,
    };

    try {
      insertManagedFunctionToStore(payload);
    } catch (error) {
      if (error instanceof DuplicateFunctionIdentityError) {
        updateManagedFunctionInStore(functionId, payload);
      } else if (error instanceof DuplicateFunctionPathError) {
        const existing = listManagedFunctionsFromStore().find((fn) => (
          fn.method === operation.method && fn.path === operation.pathPattern
        ));
        const metadata = parseManagedFunctionMetadata(existing?.metadata_json);
        if (existing && metadata?.edgeApiDefinitionId === enrichedDefinition.id) {
          deleteManagedFunctionFromStore(existing.id);
          insertManagedFunctionToStore(payload);
        } else {
          throw new Error(`Route collision: ${operation.method} ${operation.pathPattern} is already registered.`);
        }
      } else {
        throw error;
      }
    }
  }

  if (managedFunctionIds.some(isHwyMemberDirectoryManagedFunctionId)) {
    ensureHwyMemberDirectoryListRuntime();
  }

  if (previousManagedFunctionId && !managedFunctionIds.includes(previousManagedFunctionId)) {
    deleteManagedFunctionFromStore(previousManagedFunctionId);
  }

  deleteStaleManagedFunctionsForDefinition(
    enrichedDefinition.id,
    new Set(managedFunctionIds),
  );

  const published: EdgeApiDefinition = {
    ...enrichedDefinition,
    publishedAt: new Date().toISOString(),
    version: enrichedDefinition.version + 1,
    managedFunctionId: managedFunctionIds[0],
  };

  const saved = saveEdgeApiDefinition(published);
  managedFunctionRouteRegistry.invalidate();
  for (const functionId of managedFunctionIds) {
    refreshOpenApiDocumentationCaches(functionId);
  }
  refreshOpenApiDocumentationCaches();
  return saved;
};

export const unpublishEdgeApiDefinition = (definitionId: string): EdgeApiDefinition => {
  const definition = getEdgeApiDefinitionById(definitionId);
  if (!definition) {
    throw new Error(`Edge API definition not found: ${definitionId}`);
  }

  const model = getEdgeModelById(definition.edgeModelId);
  const functionFolder = model
    ? buildDataApiManagedFunctionFolder(model.objectName)
    : DATA_API_FOLDER;

  for (const operation of definition.operations) {
    const functionName = buildDataApiManagedFunctionName(definition, operation);
    const functionId = buildManagedFunctionId(functionFolder, functionName);
    deleteManagedFunctionFromStore(functionId);
  }

  if (definition.managedFunctionId) {
    deleteManagedFunctionFromStore(definition.managedFunctionId);
  }

  deleteStaleManagedFunctionsForDefinition(definitionId, new Set());

  const unpublished: EdgeApiDefinition = {
    ...definition,
    publishedAt: null,
    managedFunctionId: undefined,
  };

  const saved = saveEdgeApiDefinition(unpublished);
  managedFunctionRouteRegistry.invalidate();
  refreshOpenApiDocumentationCaches(definition.managedFunctionId);
  refreshOpenApiDocumentationCaches();
  return saved;
};

export const deleteEdgeApiDefinitionById = (definitionId: string): void => {
  const definition = getEdgeApiDefinitionById(definitionId);
  if (!definition) {
    throw new Error(`Edge API definition not found: ${definitionId}`);
  }

  try {
    unpublishEdgeApiDefinition(definitionId);
  } catch {
    deleteStaleManagedFunctionsForDefinition(definitionId, new Set());
  }

  const deleted = deleteEdgeApiDefinition(definitionId);
  if (!deleted) {
    throw new Error(`Edge API definition not found: ${definitionId}`);
  }

  managedFunctionRouteRegistry.invalidate();
  refreshOpenApiDocumentationCaches();
};
