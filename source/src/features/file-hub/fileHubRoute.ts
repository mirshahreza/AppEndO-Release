import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import {
  buildNestedEditorEditRelativePath,
  resolveNestedEditorItemSlug,
} from '../../shared/routing/nestedEditorDeepLink';
import type { FileHubConnectionPublic } from '../../shared/api/contracts/file-hub/types';

export const FILE_HUB_LIST_SEGMENT = 'sftp';
const FILE_HUB_LIST_SEGMENTS = [FILE_HUB_LIST_SEGMENT, 'file-hub'] as const;
export const FILE_HUB_NEW_SLUG = 'new';

export function resolveFileHubRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const routeIndex = Math.max(
    ...FILE_HUB_LIST_SEGMENTS.map((segment) => segments.lastIndexOf(segment)),
  );
  if (routeIndex >= 0) {
    return resolveNestedEditorItemSlug(segments.slice(routeIndex + 1));
  }

  return resolveNestedEditorItemSlug(segments);
}

export function parseFileHubEditSlug(rawSuffix: string | undefined): string | null {
  const slug = resolveFileHubRouteSuffix(rawSuffix)?.trim() ?? '';
  return slug || null;
}

export function findFileHubConnectionByEditSlug(
  connections: FileHubConnectionPublic[],
  slug: string,
): FileHubConnectionPublic | null {
  if (!slug || slug === FILE_HUB_NEW_SLUG) {
    return null;
  }
  return connections.find((item) => item.key === slug || item.id === slug) ?? null;
}

export function buildFileHubListRelativePath(mountId: string = STUDIO_MOUNT_ID): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return FILE_HUB_LIST_SEGMENT;
  }
  return toPortalRoutePattern(FILE_HUB_LIST_SEGMENT);
}

export function buildFileHubEditRelativePath(
  connection: Pick<FileHubConnectionPublic, 'key'>,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const editPath = buildNestedEditorEditRelativePath(FILE_HUB_LIST_SEGMENT, connection.key);
  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }
  return toPortalRoutePattern(editPath);
}

export function resolveFileHubItemLabelFromEditSlug(editSlug: string): string {
  if (editSlug === FILE_HUB_NEW_SLUG) {
    return 'New connection';
  }
  try {
    return decodeURIComponent(editSlug.split('/').filter(Boolean).pop() ?? editSlug);
  } catch {
    return editSlug;
  }
}
