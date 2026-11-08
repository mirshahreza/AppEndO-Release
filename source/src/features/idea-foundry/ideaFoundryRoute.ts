import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import {
  buildNestedEditorEditRelativePath,
  resolveNestedEditorItemSlug,
} from '../../shared/routing/nestedEditorDeepLink';

export const IDEA_FOUNDRY_LIST_SEGMENT = 'idea-foundry';

export function resolveIdeaFoundryRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const listIndex = segments.lastIndexOf(IDEA_FOUNDRY_LIST_SEGMENT);
  const segmentsAfterList = listIndex >= 0
    ? segments.slice(listIndex + 1)
    : segments;

  return resolveNestedEditorItemSlug(segmentsAfterList);
}

export function parseIdeaFoundryEditSlug(rawSuffix: string | undefined): string | null {
  const routeSuffix = resolveIdeaFoundryRouteSuffix(rawSuffix);
  const slug = routeSuffix?.trim() ?? '';
  return slug || null;
}

export function parseIdeaFoundryEditSlugFromPathname(pathname: string): string | null {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const listIndex = segments.lastIndexOf(IDEA_FOUNDRY_LIST_SEGMENT);
  if (listIndex < 0) {
    return null;
  }

  const slug = resolveNestedEditorItemSlug(segments.slice(listIndex + 1));
  return slug?.trim() || null;
}

function decodeIdeaFoundryEditSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function resolveIdeaIdFromEditSlug(editSlug: string): string {
  return decodeIdeaFoundryEditSlug(editSlug).split('/').filter(Boolean)[0] ?? '';
}

export function buildIdeaFoundryListRelativePath(
  mountId: string = STUDIO_MOUNT_ID,
): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return IDEA_FOUNDRY_LIST_SEGMENT;
  }

  return toPortalRoutePattern(IDEA_FOUNDRY_LIST_SEGMENT);
}

export function buildIdeaFoundryEditRelativePath(
  ideaId: string,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const editPath = buildNestedEditorEditRelativePath(
    IDEA_FOUNDRY_LIST_SEGMENT,
    encodeURIComponent(ideaId),
  );
  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }

  return toPortalRoutePattern(editPath);
}
