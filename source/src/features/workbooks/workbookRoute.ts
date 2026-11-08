import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import {
  buildNestedEditorEditRelativePath,
  resolveNestedEditorItemSlug,
} from '../../shared/routing/nestedEditorDeepLink';

export const WORKBOOKS_LIST_SEGMENT = 'workbooks';
export const MY_WORKBOOKS_LIST_SEGMENT = 'my-workbooks';
export const SHARED_WORKBOOK_PATH_PREFIX = 'shared/workbooks';

export function resolveWorkbooksRouteSuffix(
  rawSuffix: string | undefined,
  listSegment: string = WORKBOOKS_LIST_SEGMENT,
): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const listIndex = segments.lastIndexOf(listSegment);
  const segmentsAfterList = listIndex >= 0
    ? segments.slice(listIndex + 1)
    : segments;

  return resolveNestedEditorItemSlug(segmentsAfterList);
}

export function parseWorkbookEditSlug(
  rawSuffix: string | undefined,
  listSegment: string = WORKBOOKS_LIST_SEGMENT,
): string | null {
  const routeSuffix = resolveWorkbooksRouteSuffix(rawSuffix, listSegment);
  const slug = routeSuffix?.trim() ?? '';
  return slug || null;
}

export function parseWorkbookEditSlugFromPathname(
  pathname: string,
  listSegment: string = WORKBOOKS_LIST_SEGMENT,
): string | null {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const listIndex = segments.lastIndexOf(listSegment);
  if (listIndex < 0) {
    return null;
  }

  const slug = resolveNestedEditorItemSlug(segments.slice(listIndex + 1));
  return slug?.trim() || null;
}

function decodeWorkbookEditSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function resolveWorkbookIdFromEditSlug(editSlug: string): string {
  return decodeWorkbookEditSlug(editSlug).split('/').filter(Boolean)[0] ?? '';
}

export function buildWorkbooksListRelativePath(
  mountId: string = STUDIO_MOUNT_ID,
  listSegment: string = WORKBOOKS_LIST_SEGMENT,
): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return listSegment;
  }

  return toPortalRoutePattern(listSegment);
}

export function buildWorkbookEditRelativePath(
  workbookId: string,
  mountId: string = STUDIO_MOUNT_ID,
  listSegment: string = WORKBOOKS_LIST_SEGMENT,
): string {
  const editPath = buildNestedEditorEditRelativePath(
    listSegment,
    encodeURIComponent(workbookId),
  );
  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }

  return toPortalRoutePattern(editPath);
}

export function buildSharedWorkbookPath(workbookId: string): string {
  return `/${SHARED_WORKBOOK_PATH_PREFIX}/${encodeURIComponent(workbookId)}`;
}
