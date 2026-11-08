import fs from 'fs';
import path from 'path';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import {
  EDGE_MODEL_STUDIO_META_INDEX_PATH,
  runtimeDirs,
} from '../../../core/runtime/runtimePaths';
import {
  createEmptyEdgeModelStudioMeta,
  edgeModelStudioMetaSchema,
  type EdgeModelDefinition,
  type EdgeModelStudioMeta,
  type UpsertEdgeModelStudioMetaInput,
} from '../../../shared/api/contracts/data-api';
import {
  MODEL_STORY_EXTENSION_KEY,
  isModelStoryEmpty,
  readModelStoryFromExtensions,
} from '../../../shared/lib/edgeModelStory';
import { getEdgeModelById } from './edgeModelStore';

export type StudioMetaSchemaIdentity = {
  dataSourceId: string;
  objectType: 'TABLE' | 'VIEW';
  objectName: string;
};

type StudioMetaIndexItem = {
  schemaKey: string;
  edgeModelId: string | null;
  fileName: string;
};

type StudioMetaIndex = {
  schema: 'append-edge-model-studio-meta-index';
  schemaVersion: '1.1.0';
  updatedAt: string;
  items: StudioMetaIndexItem[];
};

const LOCK_NAME = 'edge-model-studio-meta';

export const studioMetaSchemaKey = (identity: StudioMetaSchemaIdentity): string => (
  `${identity.dataSourceId}::${identity.objectType}::${identity.objectName}`
);

export const studioMetaIdentityFromModel = (
  model: Pick<EdgeModelDefinition, 'dataSourceId' | 'objectType' | 'objectName'>,
): StudioMetaSchemaIdentity => ({
  dataSourceId: model.dataSourceId,
  objectType: model.objectType,
  objectName: model.objectName,
});

const makeEmptyIndex = (): StudioMetaIndex => ({
  schema: 'append-edge-model-studio-meta-index',
  schemaVersion: '1.1.0',
  updatedAt: new Date().toISOString(),
  items: [],
});

const metaFilePath = (fileName: string): string => (
  path.join(runtimeDirs.edgeModelStudioMeta, fileName)
);

const readIndex = (): StudioMetaIndex => {
  if (!fs.existsSync(EDGE_MODEL_STUDIO_META_INDEX_PATH)) {
    return makeEmptyIndex();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(EDGE_MODEL_STUDIO_META_INDEX_PATH, 'utf8')) as {
      items?: Array<{ schemaKey?: unknown; edgeModelId?: unknown; fileName?: unknown }>;
    };
    const items = Array.isArray(parsed.items)
      ? parsed.items.flatMap((item): StudioMetaIndexItem[] => {
        const fileName = typeof item.fileName === 'string' ? item.fileName.trim() : '';
        if (!fileName) {
          return [];
        }
        const edgeModelId = typeof item.edgeModelId === 'string' && item.edgeModelId.trim()
          ? item.edgeModelId.trim()
          : null;
        const schemaKey = typeof item.schemaKey === 'string' ? item.schemaKey.trim() : '';
        return [{ schemaKey, edgeModelId, fileName }];
      })
      : [];
    return {
      ...makeEmptyIndex(),
      items,
    };
  } catch {
    return makeEmptyIndex();
  }
};

const writeIndex = (index: StudioMetaIndex): void => {
  index.updatedAt = new Date().toISOString();
  index.schemaVersion = '1.1.0';
  atomicWriteText(
    EDGE_MODEL_STUDIO_META_INDEX_PATH,
    JSON.stringify(index, null, 2),
    runtimeDirs.workspaceTemp,
  );
};

export const ensureEdgeModelStudioMetaStoreDirs = (): void => {
  ensureRuntimeDirs([
    runtimeDirs.edgeModelStudioMeta,
    runtimeDirs.edgeModelStudioMetaLocks,
    runtimeDirs.workspaceTemp,
  ]);
};

const readMetaFile = (fileName: string): EdgeModelStudioMeta | null => {
  const filePath = metaFilePath(fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    const { notes: _retiredNotes, ...rest } = parsed;
    return edgeModelStudioMetaSchema.parse(rest);
  } catch {
    return null;
  }
};

const writeMetaFile = (fileName: string, meta: EdgeModelStudioMeta): void => {
  atomicWriteText(
    metaFilePath(fileName),
    JSON.stringify(meta, null, 2),
    runtimeDirs.workspaceTemp,
  );
};

const removeMetaFile = (fileName: string): void => {
  const filePath = metaFilePath(fileName);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
};

const resolveIdentityForEdgeModelId = (edgeModelId: string): StudioMetaSchemaIdentity | null => {
  const model = getEdgeModelById(edgeModelId);
  if (!model) {
    return null;
  }
  return studioMetaIdentityFromModel(model);
};

const findItemByEdgeModelId = (
  index: StudioMetaIndex,
  edgeModelId: string,
): StudioMetaIndexItem | undefined => (
  index.items.find((item) => item.edgeModelId === edgeModelId)
);

const findItemBySchemaKey = (
  index: StudioMetaIndex,
  schemaKey: string,
): StudioMetaIndexItem | undefined => (
  schemaKey ? index.items.find((item) => item.schemaKey === schemaKey) : undefined
);

const isEmptyStudioMeta = (meta: EdgeModelStudioMeta): boolean => (
  meta.tags.length === 0
  && meta.columnMeta.length === 0
  && meta.associationMeta.length === 0
  && Object.keys(meta.extensions).length === 0
);

const mergeStudioMetaInput = (
  primary: EdgeModelStudioMeta,
  fallback: EdgeModelStudioMeta,
): UpsertEdgeModelStudioMetaInput => {
  const primaryStory = readModelStoryFromExtensions(primary.extensions);
  const fallbackStory = readModelStoryFromExtensions(fallback.extensions);
  const story = !isModelStoryEmpty(primaryStory) ? primaryStory : fallbackStory;
  return {
    tags: primary.tags.length > 0 ? primary.tags : fallback.tags,
    columnMeta: primary.columnMeta.length > 0 ? primary.columnMeta : fallback.columnMeta,
    associationMeta: primary.associationMeta.length > 0
      ? primary.associationMeta
      : fallback.associationMeta,
    extensions: {
      ...fallback.extensions,
      ...primary.extensions,
      ...(story ? { [MODEL_STORY_EXTENSION_KEY]: story } : {}),
    },
  };
};

const withLock = <T>(fn: () => T): T => {
  ensureEdgeModelStudioMetaStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.edgeModelStudioMetaLocks, LOCK_NAME)) {
    throw new Error('Edge model studio metadata store is locked by another process.');
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.edgeModelStudioMetaLocks, LOCK_NAME);
  }
};

const persistMeta = (
  index: StudioMetaIndex,
  args: {
    edgeModelId: string | null;
    schemaKey: string;
    fileName: string;
    meta: EdgeModelStudioMeta;
  },
): void => {
  writeMetaFile(args.fileName, args.meta);
  const withoutSame = index.items.filter((item) => {
    if (item.fileName === args.fileName) {
      return false;
    }
    if (args.edgeModelId && item.edgeModelId === args.edgeModelId) {
      return false;
    }
    if (args.schemaKey && item.schemaKey === args.schemaKey) {
      return false;
    }
    return true;
  });
  writeIndex({
    ...index,
    items: [
      ...withoutSame,
      {
        schemaKey: args.schemaKey,
        edgeModelId: args.edgeModelId,
        fileName: args.fileName,
      },
    ],
  });
};

export const getEdgeModelStudioMeta = (edgeModelId: string): EdgeModelStudioMeta => {
  ensureEdgeModelStudioMetaStoreDirs();
  const index = readIndex();
  const identity = resolveIdentityForEdgeModelId(edgeModelId);
  const schemaKey = identity ? studioMetaSchemaKey(identity) : '';
  const entry = findItemByEdgeModelId(index, edgeModelId)
    ?? (schemaKey ? findItemBySchemaKey(index, schemaKey) : undefined);
  if (!entry) {
    return createEmptyEdgeModelStudioMeta(edgeModelId);
  }

  const stored = readMetaFile(entry.fileName);
  if (!stored) {
    return createEmptyEdgeModelStudioMeta(edgeModelId);
  }
  return stored.edgeModelId === edgeModelId
    ? stored
    : { ...stored, edgeModelId };
};

/**
 * Read-only lookup by raw schema identity, with no edgeModelId required - for callers (like the
 * DB Enricher) that need any human-authored notes for a table/column regardless of whether an
 * Edge Model has ever been created over it. Returns null when nothing has been saved.
 */
export const getEdgeModelStudioMetaBySchemaKey = (identity: StudioMetaSchemaIdentity): EdgeModelStudioMeta | null => {
  ensureEdgeModelStudioMetaStoreDirs();
  const index = readIndex();
  const entry = findItemBySchemaKey(index, studioMetaSchemaKey(identity));
  if (!entry) {
    return null;
  }
  return readMetaFile(entry.fileName);
};

export const hasEdgeModelStudioMeta = (edgeModelId: string): boolean => {
  ensureEdgeModelStudioMetaStoreDirs();
  const index = readIndex();
  if (findItemByEdgeModelId(index, edgeModelId)) {
    return true;
  }
  const identity = resolveIdentityForEdgeModelId(edgeModelId);
  if (!identity) {
    return false;
  }
  return Boolean(findItemBySchemaKey(index, studioMetaSchemaKey(identity)));
};

export const upsertEdgeModelStudioMeta = (
  edgeModelId: string,
  input: UpsertEdgeModelStudioMetaInput,
): EdgeModelStudioMeta => withLock(() => {
  const identity = resolveIdentityForEdgeModelId(edgeModelId);
  const schemaKey = identity ? studioMetaSchemaKey(identity) : '';
  const index = readIndex();
  const existingEntry = findItemByEdgeModelId(index, edgeModelId)
    ?? (schemaKey ? findItemBySchemaKey(index, schemaKey) : undefined);
  const existing = existingEntry
    ? (readMetaFile(existingEntry.fileName) ?? createEmptyEdgeModelStudioMeta(edgeModelId))
    : createEmptyEdgeModelStudioMeta(edgeModelId);
  const now = new Date().toISOString();
  const next = edgeModelStudioMetaSchema.parse({
    ...existing,
    edgeModelId,
    tags: input.tags !== undefined
      ? input.tags.map((tag) => tag.trim()).filter(Boolean)
      : existing.tags,
    columnMeta: input.columnMeta !== undefined ? input.columnMeta : existing.columnMeta,
    associationMeta: input.associationMeta !== undefined
      ? input.associationMeta
      : existing.associationMeta,
    history: input.history !== undefined ? input.history : existing.history,
    extensions: input.extensions !== undefined
      ? { ...existing.extensions, ...input.extensions }
      : existing.extensions,
    created_at: existing.created_at || now,
    updated_at: now,
  });

  const fileName = existingEntry?.fileName ?? `${edgeModelId}.json`;
  persistMeta(index, {
    edgeModelId,
    schemaKey: schemaKey || existingEntry?.schemaKey || '',
    fileName,
    meta: next,
  });
  return next;
});

/** Keep studio-meta for this table after the Edge model row is deleted. */
export const parkEdgeModelStudioMeta = (
  model: Pick<EdgeModelDefinition, 'id' | 'dataSourceId' | 'objectType' | 'objectName'>,
): void => {
  withLock(() => {
    const schemaKey = studioMetaSchemaKey(studioMetaIdentityFromModel(model));
    const index = readIndex();
    const byId = findItemByEdgeModelId(index, model.id);
    const byKey = findItemBySchemaKey(index, schemaKey);
    const dropNames = new Set<string>();
    let keepFileName: string | null = null;
    let keepMeta: EdgeModelStudioMeta | null = null;

    const consider = (entry: StudioMetaIndexItem | undefined): void => {
      if (!entry) {
        return;
      }
      const meta = readMetaFile(entry.fileName);
      if (!meta || isEmptyStudioMeta(meta)) {
        dropNames.add(entry.fileName);
        return;
      }
      if (!keepMeta) {
        keepFileName = entry.fileName;
        keepMeta = meta;
        return;
      }
      keepMeta = edgeModelStudioMetaSchema.parse({
        ...keepMeta,
        ...mergeStudioMetaInput(keepMeta, meta),
        edgeModelId: keepMeta.edgeModelId,
        updated_at: new Date().toISOString(),
      });
      if (entry.fileName !== keepFileName) {
        dropNames.add(entry.fileName);
      }
    };

    consider(byKey);
    if (byId && byId.fileName !== byKey?.fileName) {
      consider(byId);
    }

    for (const fileName of dropNames) {
      removeMetaFile(fileName);
    }

    if (!keepFileName || !keepMeta) {
      writeIndex({
        ...index,
        items: index.items.filter((item) => !dropNames.has(item.fileName)),
      });
      return;
    }

    writeMetaFile(keepFileName, keepMeta);
    writeIndex({
      ...index,
      items: [
        ...index.items.filter((item) => (
          !dropNames.has(item.fileName) && item.fileName !== keepFileName
        )),
        { schemaKey, edgeModelId: null, fileName: keepFileName },
      ],
    });
  });
};

/** Point parked or duplicate studio-meta at the live Edge model for this table. */
export const bindEdgeModelStudioMeta = (
  model: Pick<EdgeModelDefinition, 'id' | 'dataSourceId' | 'objectType' | 'objectName'>,
): void => {
  withLock(() => {
    const schemaKey = studioMetaSchemaKey(studioMetaIdentityFromModel(model));
    const index = readIndex();
    const byKey = findItemBySchemaKey(index, schemaKey);
    const byId = findItemByEdgeModelId(index, model.id);
    if (!byKey && !byId) {
      return;
    }
    if (
      byId
      && byId.schemaKey === schemaKey
      && (!byKey || byKey.fileName === byId.fileName)
    ) {
      return;
    }

    if (byKey && byId && byKey.fileName !== byId.fileName) {
      const live = readMetaFile(byId.fileName) ?? createEmptyEdgeModelStudioMeta(model.id);
      const parked = readMetaFile(byKey.fileName) ?? createEmptyEdgeModelStudioMeta(model.id);
      const mergedInput = mergeStudioMetaInput(live, parked);
      const now = new Date().toISOString();
      const merged = edgeModelStudioMetaSchema.parse({
        ...live,
        ...mergedInput,
        edgeModelId: model.id,
        created_at: live.created_at || parked.created_at || now,
        updated_at: now,
      });
      writeMetaFile(byId.fileName, merged);
      removeMetaFile(byKey.fileName);
      writeIndex({
        ...index,
        items: [
          ...index.items.filter((item) => (
            item.fileName !== byKey.fileName && item.fileName !== byId.fileName
          )),
          { schemaKey, edgeModelId: model.id, fileName: byId.fileName },
        ],
      });
      return;
    }

    const entry = byId ?? byKey;
    if (!entry) {
      return;
    }
    const meta = readMetaFile(entry.fileName);
    if (!meta) {
      return;
    }
    writeMetaFile(entry.fileName, { ...meta, edgeModelId: model.id });
    writeIndex({
      ...index,
      items: index.items.map((item) => (
        item.fileName === entry.fileName
          ? { schemaKey, edgeModelId: model.id, fileName: entry.fileName }
          : item
      )),
    });
  });
};

/** Merge duplicate studio-meta into the kept model, then drop the duplicate file. */
export const retargetEdgeModelStudioMeta = (fromId: string, toId: string): void => {
  if (fromId === toId) {
    return;
  }
  withLock(() => {
    const index = readIndex();
    const toIdentity = resolveIdentityForEdgeModelId(toId);
    const schemaKey = toIdentity ? studioMetaSchemaKey(toIdentity) : '';
    const fromEntry = findItemByEdgeModelId(index, fromId)
      ?? (schemaKey ? findItemBySchemaKey(index, schemaKey) : undefined);
    const toEntry = findItemByEdgeModelId(index, toId);
    if (!fromEntry && !toEntry) {
      return;
    }
    if (fromEntry && toEntry && fromEntry.fileName === toEntry.fileName) {
      writeIndex({
        ...index,
        items: index.items.map((item) => (
          item.fileName === toEntry.fileName
            ? { ...item, schemaKey: schemaKey || item.schemaKey, edgeModelId: toId }
            : item
        )),
      });
      return;
    }

    const fromMeta = fromEntry
      ? (readMetaFile(fromEntry.fileName) ?? createEmptyEdgeModelStudioMeta(fromId))
      : createEmptyEdgeModelStudioMeta(fromId);
    const toMeta = toEntry
      ? (readMetaFile(toEntry.fileName) ?? createEmptyEdgeModelStudioMeta(toId))
      : createEmptyEdgeModelStudioMeta(toId);
    const mergedInput = mergeStudioMetaInput(toMeta, fromMeta);
    const now = new Date().toISOString();
    const merged = edgeModelStudioMetaSchema.parse({
      ...toMeta,
      ...mergedInput,
      edgeModelId: toId,
      created_at: toMeta.created_at || fromMeta.created_at || now,
      updated_at: now,
    });
    const fileName = toEntry?.fileName ?? fromEntry?.fileName ?? `${toId}.json`;
    writeMetaFile(fileName, merged);
    if (fromEntry && fromEntry.fileName !== fileName) {
      removeMetaFile(fromEntry.fileName);
    }
    writeIndex({
      ...index,
      items: [
        ...index.items.filter((item) => (
          item.fileName !== fromEntry?.fileName && item.fileName !== toEntry?.fileName
        )),
        { schemaKey: schemaKey || fromEntry?.schemaKey || '', edgeModelId: toId, fileName },
      ],
    });
  });
};

export const deleteEdgeModelStudioMeta = (edgeModelId: string): boolean => withLock(() => {
  const index = readIndex();
  const identity = resolveIdentityForEdgeModelId(edgeModelId);
  const schemaKey = identity ? studioMetaSchemaKey(identity) : '';
  const entry = findItemByEdgeModelId(index, edgeModelId)
    ?? (schemaKey ? findItemBySchemaKey(index, schemaKey) : undefined);
  if (!entry) {
    return false;
  }

  removeMetaFile(entry.fileName);
  writeIndex({
    ...index,
    items: index.items.filter((item) => item.fileName !== entry.fileName),
  });
  return true;
});
