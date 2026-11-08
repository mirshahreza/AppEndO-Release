import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  acquireRuntimeLock,
  atomicWriteText,
  ensureRuntimeDirs,
  releaseRuntimeLock,
} from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs, SQL_CONSOLE_COLLECTIONS_INDEX_PATH } from '../../../core/runtime/runtimePaths';
import {
  isSqlConsoleGeneralCollection,
  SQL_CONSOLE_GENERAL_COLLECTION_ID,
  SQL_CONSOLE_GENERAL_COLLECTION_NAME,
} from '../../../shared/api/contracts/sql-console';

export type SqlConsoleCollection = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number;
};

export type SqlConsoleFolder = {
  id: string;
  collectionId: string;
  parentFolderId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SqlConsoleScript = {
  id: string;
  collectionId: string | null;
  folderId: string | null;
  name: string;
  sql: string;
  dataSourceId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type IndexFile = {
  schema: 'appendo-sql-console-collections-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  collections: SqlConsoleCollection[];
  folders: SqlConsoleFolder[];
  scripts: SqlConsoleScript[];
};

const LOCK_NAME = 'sql-console-collections';

const emptyIndex = (): IndexFile => ({
  schema: 'appendo-sql-console-collections-index',
  schemaVersion: '1.0.0',
  updatedAt: new Date().toISOString(),
  collections: [],
  folders: [],
  scripts: [],
});

function ensureStoreDirs(): void {
  ensureRuntimeDirs([runtimeDirs.sqlConsole, runtimeDirs.sqlConsoleLocks, runtimeDirs.workspaceTemp]);
}

function withStoreLock<T>(fn: () => T): T {
  ensureStoreDirs();
  if (!acquireRuntimeLock(runtimeDirs.sqlConsoleLocks, LOCK_NAME)) {
    throw new Error('SQL Console collections store is busy. Retry in a moment.');
  }
  try {
    return fn();
  } finally {
    releaseRuntimeLock(runtimeDirs.sqlConsoleLocks, LOCK_NAME);
  }
}

function readIndexUnlocked(): IndexFile {
  ensureStoreDirs();
  let index = emptyIndex();
  if (fs.existsSync(SQL_CONSOLE_COLLECTIONS_INDEX_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SQL_CONSOLE_COLLECTIONS_INDEX_PATH, 'utf8')) as Partial<IndexFile>;
      if (parsed && parsed.schema === 'appendo-sql-console-collections-index') {
        index = {
          schema: 'appendo-sql-console-collections-index',
          schemaVersion: '1.0.0',
          updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
          collections: Array.isArray(parsed.collections)
            ? parsed.collections.filter((item): item is SqlConsoleCollection => Boolean(item?.id && item.name))
            : [],
          folders: Array.isArray(parsed.folders)
            ? parsed.folders.filter((item): item is SqlConsoleFolder => Boolean(item?.id && item.collectionId))
            : [],
          scripts: Array.isArray(parsed.scripts)
            ? parsed.scripts
              .filter((item): item is SqlConsoleScript => Boolean(item?.id && item.name)
                && (item.collectionId == null || typeof item.collectionId === 'string'))
              .map((item) => ({ ...item, collectionId: item.collectionId ?? null }))
            : [],
        };
      }
    } catch {
      index = emptyIndex();
    }
  }
  if (ensureGeneralCollection(index)) {
    writeIndexUnlocked(index);
  }
  return index;
}

function writeIndexUnlocked(index: IndexFile): void {
  const next: IndexFile = { ...index, updatedAt: new Date().toISOString() };
  atomicWriteText(SQL_CONSOLE_COLLECTIONS_INDEX_PATH, `${JSON.stringify(next, null, 2)}\n`, runtimeDirs.workspaceTemp);
}

function ensureGeneralCollection(index: IndexFile): boolean {
  if (index.collections.some(isSqlConsoleGeneralCollection)) {
    return false;
  }
  const now = new Date().toISOString();
  index.collections = [
    {
      id: SQL_CONSOLE_GENERAL_COLLECTION_ID,
      name: SQL_CONSOLE_GENERAL_COLLECTION_NAME,
      createdAt: now,
      updatedAt: now,
      createdByUserId: 0,
    },
    ...index.collections,
  ];
  return true;
}

function collectDescendantFolderIds(folders: SqlConsoleFolder[], rootFolderIds: string[]): Set<string> {
  const result = new Set(rootFolderIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentFolderId && result.has(folder.parentFolderId) && !result.has(folder.id)) {
        result.add(folder.id);
        grew = true;
      }
    }
  }
  return result;
}

export function listSqlConsoleCollections(): SqlConsoleCollection[] {
  return withStoreLock(() => readIndexUnlocked().collections
    .slice()
    .sort((a, b) => {
      const aGeneral = isSqlConsoleGeneralCollection(a) ? 0 : 1;
      const bGeneral = isSqlConsoleGeneralCollection(b) ? 0 : 1;
      if (aGeneral !== bGeneral) {
        return aGeneral - bGeneral;
      }
      return a.name.localeCompare(b.name);
    }));
}

export function createSqlConsoleCollection(input: {
  name: string;
  description?: string;
  createdByUserId: number;
}): SqlConsoleCollection {
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const name = input.name.trim();
    if (name === SQL_CONSOLE_GENERAL_COLLECTION_NAME) {
      const existing = index.collections.find(isSqlConsoleGeneralCollection);
      if (existing) {
        return existing;
      }
    }
    const now = new Date().toISOString();
    const record: SqlConsoleCollection = {
      id: name === SQL_CONSOLE_GENERAL_COLLECTION_NAME ? SQL_CONSOLE_GENERAL_COLLECTION_ID : crypto.randomUUID(),
      name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.createdByUserId,
    };
    index.collections = [...index.collections, record];
    writeIndexUnlocked(index);
    return record;
  });
}

export function deleteSqlConsoleCollection(id: string): boolean {
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const existing = index.collections.find((entry) => entry.id === id);
    if (!existing || isSqlConsoleGeneralCollection(existing)) {
      return false;
    }
    index.collections = index.collections.filter((entry) => entry.id !== id);
    index.folders = index.folders.filter((entry) => entry.collectionId !== id);
    index.scripts = index.scripts.filter((entry) => entry.collectionId !== id);
    writeIndexUnlocked(index);
    return true;
  });
}

export function listSqlConsoleFolders(collectionId: string): SqlConsoleFolder[] {
  return withStoreLock(() => readIndexUnlocked().folders
    .filter((entry) => entry.collectionId === collectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder));
}

export function getSqlConsoleFolder(id: string): SqlConsoleFolder | null {
  return withStoreLock(() => readIndexUnlocked().folders.find((entry) => entry.id === id) ?? null);
}

export function createSqlConsoleFolder(input: {
  collectionId: string;
  parentFolderId?: string | null;
  name: string;
}): SqlConsoleFolder | null {
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    if (!index.collections.some((entry) => entry.id === input.collectionId)) {
      return null;
    }
    const now = new Date().toISOString();
    const parentFolderId = input.parentFolderId ?? null;
    const siblingCount = index.folders.filter((entry) => entry.collectionId === input.collectionId
      && entry.parentFolderId === parentFolderId).length;
    const record: SqlConsoleFolder = {
      id: crypto.randomUUID(),
      collectionId: input.collectionId,
      parentFolderId,
      name: input.name,
      sortOrder: siblingCount,
      createdAt: now,
      updatedAt: now,
    };
    index.folders = [...index.folders, record];
    writeIndexUnlocked(index);
    return record;
  });
}

export function deleteSqlConsoleFolder(id: string): boolean {
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const existing = index.folders.find((entry) => entry.id === id);
    if (!existing) {
      return false;
    }
    const doomedFolderIds = collectDescendantFolderIds(index.folders, [id]);
    index.folders = index.folders.filter((entry) => !doomedFolderIds.has(entry.id));
    index.scripts = index.scripts.filter((entry) => !(entry.folderId && doomedFolderIds.has(entry.folderId)));
    writeIndexUnlocked(index);
    return true;
  });
}

export function listSqlConsoleScripts(collectionId: string | null): SqlConsoleScript[] {
  return withStoreLock(() => readIndexUnlocked().scripts
    .filter((entry) => (entry.collectionId ?? null) === collectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder));
}

export function createSqlConsoleScript(input: {
  collectionId?: string | null;
  folderId?: string | null;
  name: string;
  sql: string;
  dataSourceId: string;
}): SqlConsoleScript | null {
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const collectionId = input.collectionId?.trim() || null;
    if (collectionId && !index.collections.some((entry) => entry.id === collectionId)) {
      return null;
    }
    const now = new Date().toISOString();
    const folderId = collectionId ? (input.folderId ?? null) : null;
    const siblingCount = index.scripts.filter((entry) => (entry.collectionId ?? null) === collectionId
      && entry.folderId === folderId).length;
    const record: SqlConsoleScript = {
      id: crypto.randomUUID(),
      collectionId,
      folderId,
      name: input.name,
      sql: input.sql,
      dataSourceId: input.dataSourceId,
      sortOrder: siblingCount,
      createdAt: now,
      updatedAt: now,
    };
    index.scripts = [...index.scripts, record];
    writeIndexUnlocked(index);
    return record;
  });
}

export function updateSqlConsoleScript(id: string, patch: Partial<{
  name: string;
  folderId: string | null;
  sql: string;
  dataSourceId: string;
}>): SqlConsoleScript | null {
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const existing = index.scripts.find((entry) => entry.id === id);
    if (!existing) {
      return null;
    }
    const next: SqlConsoleScript = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.sql !== undefined ? { sql: patch.sql } : {}),
      ...(patch.dataSourceId !== undefined ? { dataSourceId: patch.dataSourceId } : {}),
      updatedAt: new Date().toISOString(),
    };
    index.scripts = index.scripts.map((entry) => (entry.id === id ? next : entry));
    writeIndexUnlocked(index);
    return next;
  });
}

export function deleteSqlConsoleScript(id: string): boolean {
  return withStoreLock(() => {
    const index = readIndexUnlocked();
    const nextScripts = index.scripts.filter((entry) => entry.id !== id);
    if (nextScripts.length === index.scripts.length) {
      return false;
    }
    index.scripts = nextScripts;
    writeIndexUnlocked(index);
    return true;
  });
}
