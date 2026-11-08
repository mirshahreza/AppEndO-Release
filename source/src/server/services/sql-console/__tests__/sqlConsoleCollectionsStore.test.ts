import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testDir, testIndexPath } = vi.hoisted(() => {
  const nodePath = require('node:path') as typeof import('node:path');
  const nodeOs = require('node:os') as typeof import('node:os');
  const dir = nodePath.join(nodeOs.tmpdir(), `appendo-sql-console-collections-test-${process.pid}`);
  return {
    testDir: dir,
    testIndexPath: nodePath.join(dir, 'collections.json'),
  };
});

vi.mock('../../../../core/runtime/runtimePaths', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../core/runtime/runtimePaths')>();
  return {
    ...actual,
    runtimeDirs: {
      ...actual.runtimeDirs,
      sqlConsole: testDir,
      sqlConsoleLocks: path.join(testDir, 'locks'),
      workspaceTemp: path.join(testDir, 'temp'),
    },
    SQL_CONSOLE_COLLECTIONS_INDEX_PATH: testIndexPath,
  };
});

import {
  createSqlConsoleCollection,
  createSqlConsoleFolder,
  createSqlConsoleScript,
  deleteSqlConsoleCollection,
  deleteSqlConsoleFolder,
  listSqlConsoleCollections,
  listSqlConsoleFolders,
  listSqlConsoleScripts,
  updateSqlConsoleScript,
} from '../sqlConsoleCollectionsStore';

describe('sqlConsoleCollectionsStore', () => {
  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('cascades delete from collection to folders and scripts', () => {
    const collection = createSqlConsoleCollection({ name: 'Reporting', createdByUserId: 1 });
    const folder = createSqlConsoleFolder({ collectionId: collection.id, name: 'Daily' });
    expect(folder).not.toBeNull();
    createSqlConsoleScript({
      collectionId: collection.id,
      folderId: folder?.id,
      name: 'Orders today',
      sql: 'SELECT 1;',
      dataSourceId: 'ds_a',
    });
    createSqlConsoleScript({
      collectionId: collection.id,
      folderId: null,
      name: 'Health',
      sql: 'SELECT 2;',
      dataSourceId: 'ds_a',
    });

    expect(listSqlConsoleFolders(collection.id)).toHaveLength(1);
    expect(listSqlConsoleScripts(collection.id)).toHaveLength(2);
    expect(deleteSqlConsoleCollection(collection.id)).toBe(true);
    expect(listSqlConsoleFolders(collection.id)).toHaveLength(0);
    expect(listSqlConsoleScripts(collection.id)).toHaveLength(0);
  });

  it('updates a saved script in place', () => {
    const collection = createSqlConsoleCollection({ name: 'Ops', createdByUserId: 1 });
    const created = createSqlConsoleScript({
      collectionId: collection.id,
      name: 'Ping',
      sql: 'SELECT 1;',
      dataSourceId: 'ds_a',
    });
    expect(created).not.toBeNull();
    const updated = updateSqlConsoleScript(created!.id, { sql: 'SELECT 2;', name: 'Ping v2' });
    expect(updated?.sql).toBe('SELECT 2;');
    expect(updated?.name).toBe('Ping v2');
  });

  it('deletes a folder and the scripts inside it', () => {
    const collection = createSqlConsoleCollection({ name: 'Ops', createdByUserId: 1 });
    const folder = createSqlConsoleFolder({ collectionId: collection.id, name: 'Inner' });
    createSqlConsoleScript({
      collectionId: collection.id,
      folderId: folder?.id,
      name: 'Nested',
      sql: 'SELECT 1;',
      dataSourceId: 'ds_a',
    });
    expect(deleteSqlConsoleFolder(folder!.id)).toBe(true);
    expect(listSqlConsoleScripts(collection.id)).toHaveLength(0);
  });

  it('seeds General and keeps it when saving without a collection', () => {
    const collections = listSqlConsoleCollections();
    expect(collections[0]?.name).toBe('General');
    expect(deleteSqlConsoleCollection(collections[0]!.id)).toBe(false);

    const created = createSqlConsoleScript({
      collectionId: collections[0]!.id,
      name: 'Ad hoc',
      sql: 'SELECT 1;',
      dataSourceId: 'ds_a',
    });
    expect(created?.collectionId).toBe(collections[0]!.id);
    expect(listSqlConsoleScripts(collections[0]!.id).map((script) => script.name)).toEqual(['Ad hoc']);
  });
});
