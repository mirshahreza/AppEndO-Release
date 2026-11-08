import type { FileHubConnectionPublic } from '../../shared/api/contracts/file-hub/types';

export type FileHubSessionTab = {
  id: string;
  connectionId: string;
};

let tabIdCounter = 0;

export function createFileHubSessionTab(connectionId: string): FileHubSessionTab {
  tabIdCounter += 1;
  return {
    id: `file-hub-tab-${tabIdCounter}-${Math.random().toString(36).slice(2, 7)}`,
    connectionId,
  };
}

export function closeFileHubSessionTab(
  tabs: FileHubSessionTab[],
  tabId: string,
  activeTabId: string | null,
): { tabs: FileHubSessionTab[]; activeTabId: string | null } {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  const next = tabs.filter((tab) => tab.id !== tabId);
  if (next.length === 0) {
    return { tabs: next, activeTabId: null };
  }
  if (activeTabId !== tabId) {
    return { tabs: next, activeTabId };
  }
  const fallback = next[index] ?? next[index - 1] ?? next[0];
  return { tabs: next, activeTabId: fallback?.id ?? null };
}

export function formatFileHubSessionTitle(connection: FileHubConnectionPublic | null): string {
  if (!connection) {
    return 'Sftp';
  }
  return connection.name.trim() || `${connection.username}@${connection.host}`;
}
