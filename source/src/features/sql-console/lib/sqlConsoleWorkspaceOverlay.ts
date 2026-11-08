import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export function buildSqlConsoleTabOverlayToken(tabId: string): string {
  return `tab/${tabId.trim()}`;
}

export function parseSqlConsoleTabOverlayToken(token: string): string | null {
  if (!token.startsWith('tab/')) {
    return null;
  }
  const tabId = token.slice(4).trim();
  return tabId || null;
}

export function resolveSqlConsoleOverlayToken(input: {
  activeTabId: string | null;
  pendingModalKind: 'new-collection' | 'new-folder' | 'save-script' | null;
}): string | null {
  const modalToken = input.pendingModalKind === 'new-collection'
    ? 'dialog/new-collection'
    : input.pendingModalKind === 'new-folder'
      ? 'dialog/new-folder'
      : input.pendingModalKind === 'save-script'
        ? 'dialog/save-script'
        : null;

  return resolvePriorityOverlayToken([
    { token: modalToken ?? 'dialog/modal', isOpen: Boolean(modalToken), priority: 400 },
    {
      token: input.activeTabId ? buildSqlConsoleTabOverlayToken(input.activeTabId) : 'tab',
      isOpen: Boolean(input.activeTabId),
      priority: 200,
    },
  ]);
}
