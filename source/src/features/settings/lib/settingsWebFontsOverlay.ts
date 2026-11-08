import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export function buildWebFontDeleteOverlayToken(fontId: string): string {
  return `dialog/delete/${fontId.trim()}`;
}

export function parseWebFontDeleteOverlayToken(token: string): string | null {
  const prefix = 'dialog/delete/';
  if (!token.startsWith(prefix)) {
    return null;
  }
  const id = token.slice(prefix.length).trim();
  return id || null;
}

export function resolveSettingsWebFontsOverlayToken(input: {
  deleteTargetId: string | null;
}): string | null {
  if (!input.deleteTargetId) {
    return null;
  }
  return resolvePriorityOverlayToken([
    {
      token: buildWebFontDeleteOverlayToken(input.deleteTargetId),
      isOpen: true,
      priority: 200,
    },
  ]);
}
