import type { ExecuteDataSourceQueryResult } from '../../shared/api/contracts/data-sources/executeQuery';

export const SQL_CONSOLE_DEFAULT_SQL = 'SELECT 1;';

export type SqlConsoleTab = {
  id: string;
  savedScriptId?: string;
  collectionId?: string | null;
  folderId?: string | null;
  name: string;
  dirty: boolean;
  dataSourceId: string;
  sql: string;
  result: ExecuteDataSourceQueryResult | null;
  error: string | null;
  isRunning: boolean;
};

let tabIdCounter = 0;
let tabNumberCounter = 0;

const nextTabId = (): string => {
  tabIdCounter += 1;
  return `tab-${tabIdCounter}-${Math.random().toString(36).slice(2, 7)}`;
};

export function createBlankSqlConsoleTab(input?: {
  name?: string;
  dataSourceId?: string;
  sql?: string;
  collectionId?: string | null;
  folderId?: string | null;
}): SqlConsoleTab {
  tabNumberCounter += 1;
  return {
    id: nextTabId(),
    collectionId: input?.collectionId,
    folderId: input?.folderId,
    name: input?.name?.trim() || `Query ${tabNumberCounter}`,
    dirty: false,
    dataSourceId: input?.dataSourceId?.trim() ?? '',
    sql: input?.sql ?? SQL_CONSOLE_DEFAULT_SQL,
    result: null,
    error: null,
    isRunning: false,
  };
}

export function tabFromSavedScript(script: {
  id: string;
  collectionId: string | null;
  folderId: string | null;
  name: string;
  sql: string;
  dataSourceId: string;
}): SqlConsoleTab {
  return {
    id: nextTabId(),
    savedScriptId: script.id,
    collectionId: script.collectionId,
    folderId: script.folderId,
    name: script.name,
    dirty: false,
    dataSourceId: script.dataSourceId,
    sql: script.sql,
    result: null,
    error: null,
    isRunning: false,
  };
}

export function closeSqlConsoleTab(
  tabs: SqlConsoleTab[],
  tabId: string,
  activeTabId: string,
): { tabs: SqlConsoleTab[]; activeTabId: string } {
  const closed = tabs.find((tab) => tab.id === tabId);
  const next = tabs.filter((tab) => tab.id !== tabId);
  if (next.length === 0) {
    const fresh = createBlankSqlConsoleTab({ dataSourceId: closed?.dataSourceId });
    return { tabs: [fresh], activeTabId: fresh.id };
  }
  if (activeTabId === tabId) {
    return { tabs: next, activeTabId: next[next.length - 1]?.id ?? next[0].id };
  }
  return { tabs: next, activeTabId };
}

export function resolveSqlConsoleDataSourceId(
  preferredId: string,
  dataSources: Array<{ id: string; isDefault?: boolean }>,
): string {
  if (preferredId && dataSources.some((item) => item.id === preferredId)) {
    return preferredId;
  }
  return dataSources.find((item) => item.isDefault)?.id
    || dataSources[0]?.id
    || '';
}

export function formatSqlConsoleConnectionTitle(source: {
  name: string;
  type?: string;
  isDefault?: boolean;
} | null): string {
  const name = source?.name.trim() ?? '';
  if (!name) {
    return '—';
  }
  const type = source?.type?.trim() ?? '';
  const nameAlreadyHasType = Boolean(type) && name.toLowerCase().includes(type.toLowerCase());
  const title = type && !nameAlreadyHasType ? `${name} (${type})` : name;
  return source?.isDefault ? `${title} (default)` : title;
}
