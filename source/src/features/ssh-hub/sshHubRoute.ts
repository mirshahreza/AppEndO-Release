import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import {
  buildNestedEditorEditRelativePath,
  resolveNestedEditorItemSlug,
} from '../../shared/routing/nestedEditorDeepLink';
import type { SshHubConnectionPublic } from '../../shared/api/contracts/ssh-hub/types';

export const SSH_HUB_LIST_SEGMENT = 'ssh';
const SSH_HUB_LIST_SEGMENTS = [SSH_HUB_LIST_SEGMENT, 'ssh-hub'] as const;
export const SSH_HUB_NEW_SLUG = 'new';

export function resolveSshHubRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const routeIndex = Math.max(
    ...SSH_HUB_LIST_SEGMENTS.map((segment) => segments.lastIndexOf(segment)),
  );
  if (routeIndex >= 0) {
    return resolveNestedEditorItemSlug(segments.slice(routeIndex + 1));
  }

  return resolveNestedEditorItemSlug(segments);
}

export function parseSshHubEditSlug(rawSuffix: string | undefined): string | null {
  const slug = resolveSshHubRouteSuffix(rawSuffix)?.trim() ?? '';
  return slug || null;
}

export function findSshHubConnectionByEditSlug(
  connections: readonly SshHubConnectionPublic[],
  slug: string,
): SshHubConnectionPublic | null {
  if (!slug || slug === SSH_HUB_NEW_SLUG) {
    return null;
  }
  return connections.find((item) => item.key === slug || item.id === slug) ?? null;
}

export function shouldLeaveSshHubEditor(options: {
  editSlug: string | null;
  isCatalogPending: boolean;
  connections: readonly SshHubConnectionPublic[];
}): boolean {
  if (!options.editSlug || options.isCatalogPending) {
    return false;
  }
  return !findSshHubConnectionByEditSlug(options.connections, options.editSlug);
}

export function buildSshHubListRelativePath(mountId: string = STUDIO_MOUNT_ID): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return SSH_HUB_LIST_SEGMENT;
  }
  return toPortalRoutePattern(SSH_HUB_LIST_SEGMENT);
}

export function buildSshHubEditRelativePath(
  connection: Pick<SshHubConnectionPublic, 'key'>,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const editPath = buildNestedEditorEditRelativePath(SSH_HUB_LIST_SEGMENT, connection.key);
  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }
  return toPortalRoutePattern(editPath);
}

export function resolveSshHubItemLabelFromEditSlug(editSlug: string): string {
  if (editSlug === SSH_HUB_NEW_SLUG) {
    return 'New connection';
  }
  try {
    return decodeURIComponent(editSlug.split('/').filter(Boolean).pop() ?? editSlug);
  } catch {
    return editSlug;
  }
}

export function buildSshHubSessionUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/ssh-hub/session`;
}
