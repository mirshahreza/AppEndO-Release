import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import {
  EDGE_MODELS_INDEX_PATH,
  runtimeDirs,
} from '../../../core/runtime/runtimePaths';
import {
  edgeModelDefinitionSchema,
  type EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';

type EdgeModelIndex = {
  schema: 'append-edge-models-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  models: Array<{
    id: string;
    fileName: string;
  }>;
};

const LOCK_NAME = 'edge-models';

const makeEmptyIndex = (): EdgeModelIndex => ({
  schema: 'append-edge-models-index',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  models: [],
});

const modelFilePath = (fileName: string): string => (
  path.join(runtimeDirs.edgeModels, fileName)
);

const readIndex = (): EdgeModelIndex => {
  if (!fs.existsSync(EDGE_MODELS_INDEX_PATH)) {
    return makeEmptyIndex();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(EDGE_MODELS_INDEX_PATH, 'utf8')) as EdgeModelIndex;
    return {
      ...makeEmptyIndex(),
      ...parsed,
      models: Array.isArray(parsed.models) ? parsed.models : [],
    };
  } catch {
    return makeEmptyIndex();
  }
};

const writeIndex = (index: EdgeModelIndex): void => {
  index.updatedAt = new Date().toISOString();
  atomicWriteText(EDGE_MODELS_INDEX_PATH, JSON.stringify(index, null, 2), runtimeDirs.workspaceTemp);
};

export const ensureEdgeModelStoreDirs = (): void => {
  ensureRuntimeDirs([
    runtimeDirs.edgeModels,
    runtimeDirs.edgeModelsLocks,
    runtimeDirs.workspaceTemp,
  ]);
};

const readModelFile = (fileName: string): EdgeModelDefinition | null => {
  const filePath = modelFilePath(fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    // Drop retired labels.description if present in older runtime files.
    if (parsed.labels && typeof parsed.labels === 'object') {
      const labels = { ...(parsed.labels as Record<string, unknown>) };
      delete labels.description;
      parsed.labels = labels;
    }
    return edgeModelDefinitionSchema.parse(parsed);
  } catch {
    return null;
  }
};

const writeModelFile = (fileName: string, model: EdgeModelDefinition): void => {
  atomicWriteText(
    modelFilePath(fileName),
    JSON.stringify(model, null, 2),
    runtimeDirs.workspaceTemp,
  );
};

export const listEdgeModels = (): EdgeModelDefinition[] => {
  ensureEdgeModelStoreDirs();
  const index = readIndex();
  return index.models
    .map((entry) => readModelFile(entry.fileName))
    .filter((model): model is EdgeModelDefinition => Boolean(model));
};

export const getEdgeModelById = (id: string): EdgeModelDefinition | null => {
  const index = readIndex();
  const entry = index.models.find((item) => item.id === id);
  if (!entry) {
    return null;
  }
  return readModelFile(entry.fileName);
};

export const saveEdgeModel = (model: EdgeModelDefinition): EdgeModelDefinition => {
  ensureEdgeModelStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.edgeModelsLocks, LOCK_NAME)) {
    throw new Error('Edge model store is locked by another process.');
  }

  try {
    const labels = { ...model.labels } as Record<string, unknown>;
    delete labels.description;
    const parsed = edgeModelDefinitionSchema.parse({
      ...model,
      labels,
    });
    const index = readIndex();
    const fileName = `${parsed.id}.json`;
    const existing = index.models.find((item) => item.id === parsed.id);
    const nextModels = existing
      ? index.models
      : [...index.models, { id: parsed.id, fileName }];

    writeModelFile(fileName, parsed);
    writeIndex({
      ...index,
      models: nextModels,
    });
    return parsed;
  } finally {
    releaseRuntimeLock(runtimeDirs.edgeModelsLocks, LOCK_NAME);
  }
};

export const deleteEdgeModel = (id: string): boolean => {
  ensureEdgeModelStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.edgeModelsLocks, LOCK_NAME)) {
    throw new Error('Edge model store is locked by another process.');
  }

  try {
    const index = readIndex();
    const entry = index.models.find((item) => item.id === id);
    if (!entry) {
      return false;
    }

    const filePath = modelFilePath(entry.fileName);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }

    writeIndex({
      ...index,
      models: index.models.filter((item) => item.id !== id),
    });
    return true;
  } finally {
    releaseRuntimeLock(runtimeDirs.edgeModelsLocks, LOCK_NAME);
  }
};

export const listEdgeModelIndexIds = (): string[] => {
  ensureEdgeModelStoreDirs();
  return readIndex().models.map((entry) => entry.id);
};

export const createEdgeModelId = (): string => (
  `em_${crypto.randomBytes(8).toString('hex')}`
);
