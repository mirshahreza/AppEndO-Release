import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  acquireRuntimeLock,
  atomicWriteText,
  atomicWriteTextIfChanged,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import {
  EDGE_APIS_INDEX_PATH,
  runtimeDirs,
} from '../../../core/runtime/runtimePaths';
import {
  edgeApiDefinitionSchema,
  type EdgeApiDefinition,
} from '../../../shared/api/contracts/data-api';

type EdgeApiIndex = {
  schema: 'append-edge-apis-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  apis: Array<{
    id: string;
    fileName: string;
  }>;
};

const LOCK_NAME = 'edge-apis';

const makeEmptyIndex = (): EdgeApiIndex => ({
  schema: 'append-edge-apis-index',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  apis: [],
});

const apiFilePath = (fileName: string): string => (
  path.join(runtimeDirs.edgeApis, fileName)
);

const readIndex = (): EdgeApiIndex => {
  if (!fs.existsSync(EDGE_APIS_INDEX_PATH)) {
    return makeEmptyIndex();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(EDGE_APIS_INDEX_PATH, 'utf8')) as EdgeApiIndex;
    return {
      ...makeEmptyIndex(),
      ...parsed,
      apis: Array.isArray(parsed.apis) ? parsed.apis : [],
    };
  } catch {
    return makeEmptyIndex();
  }
};

const writeIndex = (index: EdgeApiIndex, options?: { bumpTimestamp?: boolean }): void => {
  const existing = fs.existsSync(EDGE_APIS_INDEX_PATH)
    ? readIndex()
    : null;
  const nextApis = index.apis;
  if (
    existing
    && !options?.bumpTimestamp
    && existing.schema === index.schema
    && existing.schemaVersion === index.schemaVersion
    && JSON.stringify(existing.apis) === JSON.stringify(nextApis)
  ) {
    return;
  }

  index.updatedAt = new Date().toISOString();
  atomicWriteText(EDGE_APIS_INDEX_PATH, JSON.stringify(index, null, 2), runtimeDirs.workspaceTemp);
};

export const ensureEdgeApiStoreDirs = (): void => {
  ensureRuntimeDirs([
    runtimeDirs.edgeApis,
    runtimeDirs.edgeApisLocks,
    runtimeDirs.workspaceTemp,
  ]);
};

const readApiFile = (fileName: string): EdgeApiDefinition | null => {
  const filePath = apiFilePath(fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return edgeApiDefinitionSchema.parse(parsed);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[edgeApiStore] Failed to parse ${fileName}: ${message}`);
    }
    return null;
  }
};

const writeApiFile = (fileName: string, definition: EdgeApiDefinition): boolean => {
  return atomicWriteTextIfChanged(
    apiFilePath(fileName),
    `${JSON.stringify(definition, null, 2)}\n`,
    runtimeDirs.workspaceTemp,
  );
};

export const listEdgeApiDefinitions = (): EdgeApiDefinition[] => {
  ensureEdgeApiStoreDirs();
  const index = readIndex();
  return index.apis
    .map((entry) => readApiFile(entry.fileName))
    .filter((definition): definition is EdgeApiDefinition => Boolean(definition));
};

export const getEdgeApiDefinitionById = (id: string): EdgeApiDefinition | null => {
  const index = readIndex();
  const entry = index.apis.find((item) => item.id === id);
  if (!entry) {
    return null;
  }
  return readApiFile(entry.fileName);
};

export const getEdgeApiDefinitionByKey = (key: string): EdgeApiDefinition | null => (
  listEdgeApiDefinitions().find((definition) => definition.key === key) ?? null
);

export const saveEdgeApiDefinition = (definition: EdgeApiDefinition): EdgeApiDefinition => {
  ensureEdgeApiStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.edgeApisLocks, LOCK_NAME)) {
    throw new Error('Edge API store is locked by another process.');
  }

  try {
    const parsed = edgeApiDefinitionSchema.parse(definition);
    const index = readIndex();
    const fileName = `${parsed.id}.json`;
    const existing = index.apis.find((item) => item.id === parsed.id);
    const nextApis = existing
      ? index.apis
      : [...index.apis, { id: parsed.id, fileName }];

    const apiFileChanged = writeApiFile(fileName, parsed);
    const indexApisChanged = !existing;
    if (apiFileChanged || indexApisChanged) {
      writeIndex({
        ...index,
        apis: nextApis,
      });
    }
    return parsed;
  } finally {
    releaseRuntimeLock(runtimeDirs.edgeApisLocks, LOCK_NAME);
  }
};

export const deleteEdgeApiDefinition = (id: string): boolean => {
  ensureEdgeApiStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.edgeApisLocks, LOCK_NAME)) {
    throw new Error('Edge API store is locked by another process.');
  }

  try {
    const index = readIndex();
    const entry = index.apis.find((item) => item.id === id);
    if (!entry) {
      return false;
    }

    const filePath = apiFilePath(entry.fileName);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }

    writeIndex({
      ...index,
      apis: index.apis.filter((item) => item.id !== id),
    });
    return true;
  } finally {
    releaseRuntimeLock(runtimeDirs.edgeApisLocks, LOCK_NAME);
  }
};

export const listEdgeApiIndexIds = (): string[] => {
  ensureEdgeApiStoreDirs();
  return readIndex().apis.map((entry) => entry.id);
};

export const createEdgeApiId = (): string => (
  `ea_${crypto.randomBytes(8).toString('hex')}`
);
