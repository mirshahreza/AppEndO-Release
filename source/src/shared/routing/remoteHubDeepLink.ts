import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../api/contracts/platform/mountConstants';
import { buildNestedEditorEditRelativePath } from './nestedEditorDeepLink';

export const REMOTE_HUB_PAGE_KEYS = ['ssh-hub', 'file-hub', 'rdp-hub'] as const;
export type RemoteHubPageKey = (typeof REMOTE_HUB_PAGE_KEYS)[number];

const REMOTE_HUB_LIST_SEGMENT: Record<RemoteHubPageKey, string> = {
  'ssh-hub': 'ssh',
  'file-hub': 'sftp',
  'rdp-hub': 'rdp',
};

export function buildRemoteHubEditRelativePath(
  pageKey: RemoteHubPageKey,
  connectionKey: string,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const listSegment = REMOTE_HUB_LIST_SEGMENT[pageKey];
  const editPath = buildNestedEditorEditRelativePath(listSegment, connectionKey);
  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }
  return toPortalRoutePattern(editPath);
}
