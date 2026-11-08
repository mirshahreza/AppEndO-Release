import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import {
  buildNestedEditorEditRelativePath,
  resolveNestedEditorItemSlug,
} from '../../shared/routing/nestedEditorDeepLink';
import type { RdpHubConnectionPublic } from '../../shared/api/contracts/rdp-hub/types';

export const RDP_HUB_LIST_SEGMENT = 'rdp';
const RDP_HUB_LIST_SEGMENTS = [RDP_HUB_LIST_SEGMENT, 'rdp-hub'] as const;
export const RDP_HUB_NEW_SLUG = 'new';

export function resolveRdpHubRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const routeIndex = Math.max(
    ...RDP_HUB_LIST_SEGMENTS.map((segment) => segments.lastIndexOf(segment)),
  );
  if (routeIndex >= 0) {
    return resolveNestedEditorItemSlug(segments.slice(routeIndex + 1));
  }

  return resolveNestedEditorItemSlug(segments);
}

export function parseRdpHubEditSlug(rawSuffix: string | undefined): string | null {
  const slug = resolveRdpHubRouteSuffix(rawSuffix)?.trim() ?? '';
  return slug || null;
}

export function findRdpHubConnectionByEditSlug(
  connections: RdpHubConnectionPublic[],
  slug: string,
): RdpHubConnectionPublic | null {
  if (!slug || slug === RDP_HUB_NEW_SLUG) {
    return null;
  }
  return connections.find((item) => item.key === slug || item.id === slug) ?? null;
}

export function buildRdpHubListRelativePath(mountId: string = STUDIO_MOUNT_ID): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return RDP_HUB_LIST_SEGMENT;
  }
  return toPortalRoutePattern(RDP_HUB_LIST_SEGMENT);
}

export function buildRdpHubEditRelativePath(
  connection: Pick<RdpHubConnectionPublic, 'key'>,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const editPath = buildNestedEditorEditRelativePath(RDP_HUB_LIST_SEGMENT, connection.key);
  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }
  return toPortalRoutePattern(editPath);
}

export function resolveRdpHubItemLabelFromEditSlug(editSlug: string): string {
  if (editSlug === RDP_HUB_NEW_SLUG) {
    return 'New connection';
  }
  try {
    return decodeURIComponent(editSlug.split('/').filter(Boolean).pop() ?? editSlug);
  } catch {
    return editSlug;
  }
}

export function buildRdpHubSessionUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/rdp-hub/session`;
}
