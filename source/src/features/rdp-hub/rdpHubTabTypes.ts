import type { RdpHubConnectionPublic } from '../../shared/api/contracts/rdp-hub/types';

export type RdpHubSessionTab = {
  id: string;
  connectionId: string;
};

let tabIdCounter = 0;

export function createRdpHubSessionTab(connectionId: string): RdpHubSessionTab {
  tabIdCounter += 1;
  return {
    id: `rdp-hub-tab-${tabIdCounter}-${Math.random().toString(36).slice(2, 7)}`,
    connectionId,
  };
}

export function closeRdpHubSessionTab(
  tabs: RdpHubSessionTab[],
  tabId: string,
  activeTabId: string | null,
): { tabs: RdpHubSessionTab[]; activeTabId: string | null } {
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

export function formatRdpHubSessionTitle(connection: RdpHubConnectionPublic | null): string {
  if (!connection) {
    return 'RDP';
  }
  return connection.name.trim() || `${connection.username}@${connection.host}`;
}
