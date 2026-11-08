import { describe, expect, it } from 'vitest';
import {
  closeSqlConsoleTab,
  createBlankSqlConsoleTab,
  formatSqlConsoleConnectionTitle,
  resolveSqlConsoleDataSourceId,
  tabFromSavedScript,
} from '../sqlConsoleTabTypes';

describe('sqlConsoleTabTypes', () => {
  it('names blank tabs Query 1, Query 2, …', () => {
    const first = createBlankSqlConsoleTab();
    const second = createBlankSqlConsoleTab({ dataSourceId: 'ds_a' });
    expect(first.name).toMatch(/^Query \d+$/);
    expect(second.name).toMatch(/^Query \d+$/);
    expect(second.name).not.toBe(first.name);
    expect(second.dataSourceId).toBe('ds_a');
    expect(first.id).not.toBe(second.id);
  });

  it('replaces the last closed tab with a fresh document', () => {
    const only = createBlankSqlConsoleTab({ dataSourceId: 'ds_a', sql: 'SELECT 2;' });
    const closed = closeSqlConsoleTab([only], only.id, only.id);
    expect(closed.tabs).toHaveLength(1);
    expect(closed.tabs[0]?.id).not.toBe(only.id);
    expect(closed.tabs[0]?.dataSourceId).toBe('ds_a');
    expect(closed.tabs[0]?.sql).toBe('SELECT 1;');
    expect(closed.activeTabId).toBe(closed.tabs[0]?.id);
  });

  it('activates the last remaining tab when the active tab closes', () => {
    const a = createBlankSqlConsoleTab({ name: 'A' });
    const b = createBlankSqlConsoleTab({ name: 'B' });
    const closed = closeSqlConsoleTab([a, b], b.id, b.id);
    expect(closed.tabs.map((tab) => tab.id)).toEqual([a.id]);
    expect(closed.activeTabId).toBe(a.id);
  });

  it('opens a saved script as a named tab', () => {
    const tab = tabFromSavedScript({
      id: 's1',
      collectionId: 'c1',
      folderId: null,
      name: 'Orders today',
      sql: 'SELECT 3;',
      dataSourceId: 'ds_a',
    });
    expect(tab.savedScriptId).toBe('s1');
    expect(tab.collectionId).toBe('c1');
    expect(tab.name).toBe('Orders today');
    expect(tab.sql).toBe('SELECT 3;');
    expect(tab.dirty).toBe(false);
  });

  it('opens an uncategorized saved script', () => {
    const tab = tabFromSavedScript({
      id: 's2',
      collectionId: null,
      folderId: null,
      name: 'Ad hoc',
      sql: 'SELECT 4;',
      dataSourceId: 'ds_a',
    });
    expect(tab.savedScriptId).toBe('s2');
    expect(tab.collectionId).toBeNull();
    expect(tab.name).toBe('Ad hoc');
  });

  it('resolves a missing preference to the default data source', () => {
    expect(resolveSqlConsoleDataSourceId('gone', [
      { id: 'ds_a' },
      { id: 'ds_b', isDefault: true },
    ])).toBe('ds_b');
    expect(resolveSqlConsoleDataSourceId('ds_a', [
      { id: 'ds_a' },
      { id: 'ds_b', isDefault: true },
    ])).toBe('ds_a');
  });

  it('formats a connection title from name and type, not the id', () => {
    expect(formatSqlConsoleConnectionTitle({
      name: 'PostgreSQL 18 (Local)',
      type: 'PostgreSQL',
      isDefault: true,
    })).toBe('PostgreSQL 18 (Local) (default)');
    expect(formatSqlConsoleConnectionTitle({
      name: 'default-db',
      type: 'SQL Server',
    })).toBe('default-db (SQL Server)');
    expect(formatSqlConsoleConnectionTitle(null)).toBe('—');
  });
});
