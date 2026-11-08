import type { SshHubConnectionPublic } from '../../shared/api/contracts/ssh-hub/types';

export type SshHubSessionTab = {
  id: string;
  connectionId: string;
};

let tabIdCounter = 0;

export function createSshHubSessionTab(connectionId: string): SshHubSessionTab {
  tabIdCounter += 1;
  return {
    id: `ssh-hub-tab-${tabIdCounter}-${Math.random().toString(36).slice(2, 7)}`,
    connectionId,
  };
}

export function closeSshHubSessionTab(
  tabs: SshHubSessionTab[],
  tabId: string,
  activeTabId: string | null,
): { tabs: SshHubSessionTab[]; activeTabId: string | null } {
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

export function formatSshHubSessionTitle(connection: SshHubConnectionPublic | null): string {
  if (!connection) {
    return 'SSH';
  }
  return connection.name.trim() || `${connection.username}@${connection.host}`;
}
