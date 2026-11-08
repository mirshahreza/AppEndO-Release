import {
  deleteManagedFunctionFromStore,
  listManagedFunctionsFromStore,
} from '../../../core/functions/FunctionFileStore';
import fs from 'fs';
import path from 'path';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';
import type { EdgeApiDefinition, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import { managedFunctionRouteRegistry } from '../managedFunctionRouteRegistry';
import { refreshOpenApiDocumentationCaches } from '../openApiDocRefresh';
import {
  deleteOwnedEdgeApisAndPolicies,
  findEdgeModelsForSchemaObject,
  prunePeerAssociationsForModelIds,
  retargetPeerAssociationsForModelIds,
} from './edgeModelDeleteCleanup';
import { deleteRecordPolicy, listRecordPoliciesForModel } from '../record-policy/recordPolicyStore';
import { deleteRecordPolicyBinding } from '../record-policy/recordPolicyBindingStore';
import { deleteEdgeApiDefinitionById } from './edgeApiPublisher';
import {
  deleteEdgeApiDefinition,
  getEdgeApiDefinitionById,
  listEdgeApiDefinitions,
  listEdgeApiIndexIds,
  saveEdgeApiDefinition,
} from './edgeApiStore';
import { deleteEdgeModel, getEdgeModelById, listEdgeModelIndexIds, listEdgeModels } from './edgeModelStore';
import { deleteEdgeModelStudioMeta, parkEdgeModelStudioMeta, retargetEdgeModelStudioMeta } from './edgeModelStudioMetaStore';

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

const edgeApiDefinitionIdFromFunction = (metadataJson: string | null | undefined): string => {
  const metadata = parseManagedFunctionMetadata(metadataJson);
  const definitionId = metadata?.edgeApiDefinitionId;
  return typeof definitionId === 'string' ? definitionId.trim() : '';
};

const preferEdgeModel = (
  existing: EdgeModelDefinition | undefined,
  candidate: EdgeModelDefinition,
): EdgeModelDefinition => {
  if (!existing) {
    return candidate;
  }

  const apiCount = (modelId: string) => (
    listEdgeApiDefinitions().filter((definition) => definition.edgeModelId === modelId).length
  );
  const byApis = apiCount(candidate.id) - apiCount(existing.id);
  if (byApis !== 0) {
    return byApis > 0 ? candidate : existing;
  }

  const byColumns = candidate.columns.length - existing.columns.length;
  if (byColumns !== 0) {
    return byColumns > 0 ? candidate : existing;
  }

  return candidate.updated_at >= existing.updated_at ? candidate : existing;
};

const preferEdgeApi = (
  existing: EdgeApiDefinition | undefined,
  candidate: EdgeApiDefinition,
): EdgeApiDefinition => {
  if (!existing) {
    return candidate;
  }
  if (Boolean(candidate.publishedAt) !== Boolean(existing.publishedAt)) {
    return candidate.publishedAt ? candidate : existing;
  }
  if (candidate.version !== existing.version) {
    return candidate.version > existing.version ? candidate : existing;
  }
  return (candidate.publishedAt ?? '') >= (existing.publishedAt ?? '') ? candidate : existing;
};

const retargetEdgeApisToModel = (fromModelIds: ReadonlySet<string>, keptModelId: string): void => {
  if (fromModelIds.size === 0) {
    return;
  }
  for (const api of listEdgeApiDefinitions()) {
    if (!fromModelIds.has(api.edgeModelId) || api.edgeModelId === keptModelId) {
      continue;
    }
    saveEdgeApiDefinition({
      ...api,
      edgeModelId: keptModelId,
    });
  }
};

export const deleteEdgeApiAndOwnedFunctions = (definitionId: string): boolean => {
  const definition = getEdgeApiDefinitionById(definitionId);
  if (!definition) {
    return false;
  }
  try {
    deleteEdgeApiDefinitionById(definitionId);
  } catch {
    return false;
  }
  return true;
};

/** Delete one Edge model and every API, policy, and peer association that pointed at it. */
export const deleteEdgeModelCascade = (modelId: string): boolean => {
  const model = getEdgeModelById(modelId);
  if (!model) {
    return false;
  }

  const focusIds = new Set([model.id]);
  deleteOwnedEdgeApisAndPolicies(focusIds);
  prunePeerAssociationsForModelIds(focusIds, model.dataSourceId);
  parkEdgeModelStudioMeta(model);
  deleteEdgeModel(model.id);
  return true;
};

export const deleteEdgeModelsForDataSource = (dataSourceId: string): number => {
  const models = listEdgeModels().filter((model) => model.dataSourceId === dataSourceId);
  for (const model of models) {
    deleteEdgeModelCascade(model.id);
  }
  return models.length;
};

export const collapseDuplicateEdgeModels = (): number => {
  const groups = new Map<string, EdgeModelDefinition[]>();
  for (const model of listEdgeModels()) {
    const key = `${model.dataSourceId}::${model.objectType}::${model.objectName}`;
    const group = groups.get(key);
    if (group) {
      group.push(model);
    } else {
      groups.set(key, [model]);
    }
  }

  let removed = 0;
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    const kept = group.reduce<EdgeModelDefinition | undefined>(
      (winner, candidate) => preferEdgeModel(winner, candidate),
      undefined,
    );
    if (!kept) {
      continue;
    }
    const duplicateIds = new Set(
      group.filter((model) => model.id !== kept.id).map((model) => model.id),
    );
    retargetEdgeApisToModel(duplicateIds, kept.id);
    retargetPeerAssociationsForModelIds(duplicateIds, kept.id, kept.dataSourceId);
    for (const duplicateId of duplicateIds) {
      for (const policy of listRecordPoliciesForModel(duplicateId)) {
        deleteRecordPolicy(policy.id);
      }
      deleteRecordPolicyBinding(duplicateId);
      retargetEdgeModelStudioMeta(duplicateId, kept.id);
      if (deleteEdgeModel(duplicateId)) {
        removed += 1;
      }
    }
  }
  return removed;
};

export const pruneOrphanEdgeApis = (): number => {
  const modelIds = new Set(listEdgeModels().map((model) => model.id));
  let removed = 0;
  for (const api of listEdgeApiDefinitions()) {
    if (modelIds.has(api.edgeModelId)) {
      continue;
    }
    if (deleteEdgeApiAndOwnedFunctions(api.id)) {
      removed += 1;
    }
  }
  return removed;
};

export const pruneDuplicateEdgeApis = (): number => {
  const byModelKey = new Map<string, EdgeApiDefinition>();
  const byBasePath = new Map<string, EdgeApiDefinition>();
  const dropIds = new Set<string>();

  for (const api of listEdgeApiDefinitions()) {
    const modelKey = `${api.edgeModelId}::${api.key}`;
    const previousKey = byModelKey.get(modelKey);
    const winnerKey = preferEdgeApi(previousKey, api);
    byModelKey.set(modelKey, winnerKey);
    if (previousKey && previousKey.id !== winnerKey.id) {
      dropIds.add(previousKey.id);
    } else if (previousKey && previousKey.id === winnerKey.id && api.id !== winnerKey.id) {
      dropIds.add(api.id);
    }

    const pathKey = api.basePath.trim().toLowerCase();
    if (!pathKey) {
      continue;
    }
    const previousPath = byBasePath.get(pathKey);
    const winnerPath = preferEdgeApi(previousPath, api);
    byBasePath.set(pathKey, winnerPath);
    if (previousPath && previousPath.id !== winnerPath.id) {
      dropIds.add(previousPath.id);
    } else if (previousPath && previousPath.id === winnerPath.id && api.id !== winnerPath.id) {
      dropIds.add(api.id);
    }
  }

  let removed = 0;
  for (const id of dropIds) {
    if (deleteEdgeApiAndOwnedFunctions(id)) {
      removed += 1;
    }
  }
  return removed;
};

export const pruneOrphanDataApiManagedFunctions = (): number => {
  const definitionIds = new Set(listEdgeApiDefinitions().map((definition) => definition.id));
  let removed = 0;
  for (const managed of listManagedFunctionsFromStore()) {
    if (managed.engine_type !== 'DATA_API') {
      continue;
    }
    const definitionId = edgeApiDefinitionIdFromFunction(managed.metadata_json);
    if (!definitionId || definitionIds.has(definitionId)) {
      continue;
    }
    deleteManagedFunctionFromStore(managed.id);
    removed += 1;
  }
  if (removed > 0) {
    managedFunctionRouteRegistry.invalidate();
    refreshOpenApiDocumentationCaches();
  }
  return removed;
};

export const pruneEdgeApisWithMissingManagedFunctions = (): number => {
  const functions = listManagedFunctionsFromStore();
  const liveIds = new Set(functions.map((item) => item.id));
  const liveDefinitionIds = new Set(
    functions.flatMap((item) => {
      const definitionId = edgeApiDefinitionIdFromFunction(item.metadata_json);
      return definitionId ? [definitionId] : [];
    }),
  );

  let removed = 0;
  for (const api of listEdgeApiDefinitions()) {
    const wasPublished = Boolean(api.publishedAt) || Boolean(api.managedFunctionId);
    if (!wasPublished) {
      continue;
    }
    const functionStillLive = Boolean(api.managedFunctionId && liveIds.has(api.managedFunctionId))
      || liveDefinitionIds.has(api.id);
    if (functionStillLive) {
      continue;
    }
    if (deleteEdgeApiAndOwnedFunctions(api.id)) {
      removed += 1;
    }
  }
  return removed;
};

export const pruneUnreadableEdgeStoreRecords = (): number => {
  let removed = 0;
  for (const id of listEdgeModelIndexIds()) {
    if (getEdgeModelById(id)) {
      continue;
    }
    deleteEdgeModelStudioMeta(id);
    if (deleteEdgeModel(id)) {
      removed += 1;
    }
  }
  for (const id of listEdgeApiIndexIds()) {
    if (getEdgeApiDefinitionById(id)) {
      continue;
    }
    if (deleteEdgeApiDefinition(id)) {
      removed += 1;
    }
  }
  return removed;
};

export const pruneUnindexedEdgeStoreFiles = (): number => {
  const pruneDir = (dirPath: string, indexFileName: string, entriesKey: 'models' | 'apis'): number => {
    const indexPath = path.join(dirPath, indexFileName);
    if (!fs.existsSync(dirPath)) {
      return 0;
    }
    let indexed = new Set<string>();
    if (fs.existsSync(indexPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Record<string, unknown>;
        const entries = parsed[entriesKey];
        if (Array.isArray(entries)) {
          indexed = new Set(
            entries
              .map((item) => (item && typeof item === 'object' && 'fileName' in item
                ? String((item as { fileName?: unknown }).fileName ?? '')
                : ''))
              .filter(Boolean),
          );
        }
      } catch {
        return 0;
      }
    }

    let removed = 0;
    for (const fileName of fs.readdirSync(dirPath)) {
      if (fileName === indexFileName || fileName === 'locks' || !fileName.endsWith('.json')) {
        continue;
      }
      if (indexed.has(fileName)) {
        continue;
      }
      fs.rmSync(path.join(dirPath, fileName), { force: true });
      removed += 1;
    }
    return removed;
  };

  return pruneDir(runtimeDirs.edgeModels, 'index.json', 'models')
    + pruneDir(runtimeDirs.edgeApis, 'index.json', 'apis');
};

export const pruneEdgeModelsWithoutApis = (): number => {
  const apiModelIds = new Set(listEdgeApiDefinitions().map((definition) => definition.edgeModelId));
  let removed = 0;
  for (const model of listEdgeModels()) {
    if (apiModelIds.has(model.id)) {
      continue;
    }
    if (deleteEdgeModelCascade(model.id)) {
      removed += 1;
    }
  }
  return removed;
};

export const reconcileDeletedEdgeCapabilities = (): void => {
  pruneUnreadableEdgeStoreRecords();
  pruneUnindexedEdgeStoreFiles();
  pruneOrphanEdgeApis();
  collapseDuplicateEdgeModels();
  pruneDuplicateEdgeApis();
  pruneEdgeApisWithMissingManagedFunctions();
  pruneOrphanDataApiManagedFunctions();
};

export const deleteOwnedEdgeApiForManagedFunction = (input: {
  engineType?: string | null;
  metadataJson?: string | null;
}): boolean => {
  if (input.engineType !== 'DATA_API') {
    return false;
  }
  const definitionId = edgeApiDefinitionIdFromFunction(input.metadataJson);
  if (!definitionId) {
    return false;
  }
  return deleteEdgeApiAndOwnedFunctions(definitionId);
};

export const findPrimaryEdgeModelForSchemaObject = (args: {
  dataSourceId: string;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
}): EdgeModelDefinition | null => {
  const existing = findEdgeModelsForSchemaObject(args);
  if (existing.length === 0) {
    return null;
  }
  return existing.reduce<EdgeModelDefinition | undefined>(
    (winner, candidate) => preferEdgeModel(winner, candidate),
    undefined,
  ) ?? null;
};

export const collapseEdgeModelsForSchemaObject = (args: {
  dataSourceId: string;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
  keepId: string;
}): void => {
  const duplicates = findEdgeModelsForSchemaObject(args).filter((model) => model.id !== args.keepId);
  if (duplicates.length === 0) {
    return;
  }
  const duplicateIds = new Set(duplicates.map((model) => model.id));
  retargetEdgeApisToModel(duplicateIds, args.keepId);
  const dataSourceId = duplicates[0]?.dataSourceId ?? args.dataSourceId;
  retargetPeerAssociationsForModelIds(duplicateIds, args.keepId, dataSourceId);
  for (const duplicate of duplicates) {
    for (const policy of listRecordPoliciesForModel(duplicate.id)) {
      deleteRecordPolicy(policy.id);
    }
    deleteRecordPolicyBinding(duplicate.id);
    retargetEdgeModelStudioMeta(duplicate.id, args.keepId);
    deleteEdgeModel(duplicate.id);
  }
};
