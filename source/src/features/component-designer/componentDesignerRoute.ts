import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import type { DesignerVersionSummary } from '../../shared/api/queries/component-designer';
import {
  buildNestedEditorEditRelativePath,
  NESTED_EDITOR_EDIT_SEGMENT,
  resolveNestedEditorItemSlug,
} from '../../shared/routing/nestedEditorDeepLink';
import {
  canonicalizeDesignerItemSlug,
  resolveDesignerDraftIdFromComponentPath,
} from '../../shared/lib/designerComponentPath';

export const CLIENT_COMPONENT_LIST_SEGMENT = 'client-components';
export const CLIENT_COMPONENT_NEW_SLUG = 'new';
/** @deprecated Legacy URL segment — redirects to `edit/{name}`. */
export const CLIENT_COMPONENT_LIVE_DESIGNER_SEGMENT = 'live-designer';

export function buildComponentDesignerEditSlug(
  draft: Pick<DesignerVersionSummary, 'folder' | 'name'>,
): string {
  return canonicalizeDesignerItemSlug(draft.name);
}

/** Strip mount/application prefixes and the `client-components` route segment from a raw splat suffix. */
export function resolveComponentDesignerRouteSuffix(rawSuffix: string | undefined): string | undefined {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return undefined;
  }

  const routeIndex = segments.lastIndexOf(CLIENT_COMPONENT_LIST_SEGMENT);
  if (routeIndex >= 0) {
    const afterRoute = segments.slice(routeIndex + 1);
    return afterRoute.length > 0 ? afterRoute.join('/') : undefined;
  }

  return segments.join('/');
}

/**
 * Live designer deep link: canonical `client-components/edit/{name}`.
 * Also accepts legacy `edit/{folder}/{name}` and `live-designer/{folder}/{name}` for redirects.
 */
export function parseLiveDesignerComponentPath(rawSuffix: string | undefined): string | null {
  const routeSuffix = resolveComponentDesignerRouteSuffix(rawSuffix);
  if (!routeSuffix) {
    return null;
  }

  const segments = routeSuffix.split('/').filter(Boolean);
  const nestedSlug = resolveNestedEditorItemSlug(segments);
  if (nestedSlug && nestedSlug !== CLIENT_COMPONENT_NEW_SLUG) {
    return nestedSlug;
  }

  if (segments[0] === CLIENT_COMPONENT_LIVE_DESIGNER_SEGMENT) {
    const componentPath = segments.slice(1).join('/');
    return componentPath || null;
  }

  return null;
}

/**
 * Legacy classic slug without `edit` / `live-designer` — used only to redirect to canonical edit URLs.
 * Returns `new` for draft-create bookmarks.
 */
export function parseComponentDesignerEditSlug(rawSuffix: string | undefined): string | null {
  const routeSuffix = resolveComponentDesignerRouteSuffix(rawSuffix);
  const slug = routeSuffix?.trim() ?? '';
  if (!slug) {
    return null;
  }

  if (
    slug === NESTED_EDITOR_EDIT_SEGMENT
    || slug.startsWith(`${NESTED_EDITOR_EDIT_SEGMENT}/`)
    || slug === CLIENT_COMPONENT_LIVE_DESIGNER_SEGMENT
    || slug.startsWith(`${CLIENT_COMPONENT_LIVE_DESIGNER_SEGMENT}/`)
  ) {
    if (slug === `${NESTED_EDITOR_EDIT_SEGMENT}/${CLIENT_COMPONENT_NEW_SLUG}`) {
      return CLIENT_COMPONENT_NEW_SLUG;
    }
    return null;
  }

  return slug;
}

export function resolveDesignerDraftIdFromEditSlug(
  drafts: readonly DesignerVersionSummary[],
  slug: string,
): string | null {
  if (!slug || slug === CLIENT_COMPONENT_NEW_SLUG) {
    return null;
  }

  return resolveDesignerDraftIdFromComponentPath(drafts, slug);
}

export function buildComponentDesignerListRelativePath(
  mountId: string = STUDIO_MOUNT_ID,
): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return CLIENT_COMPONENT_LIST_SEGMENT;
  }

  return toPortalRoutePattern(CLIENT_COMPONENT_LIST_SEGMENT);
}

function withMount(editPath: string, mountId: string): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return editPath;
  }
  return toPortalRoutePattern(editPath);
}

/** Canonical Live Designer / editor path: `client-components/edit/{name}`. */
export function buildComponentDesignerEditRelativePath(
  draft: Pick<DesignerVersionSummary, 'folder' | 'name'>,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  return withMount(
    buildNestedEditorEditRelativePath(
      CLIENT_COMPONENT_LIST_SEGMENT,
      buildComponentDesignerEditSlug(draft),
    ),
    mountId,
  );
}

export function buildComponentDesignerEditRelativePathFromSlug(
  editSlug: string,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const trimmed = editSlug.replace(/^\/+/, '');
  const canonical = trimmed === CLIENT_COMPONENT_NEW_SLUG
    ? trimmed
    : (canonicalizeDesignerItemSlug(trimmed) || trimmed);
  return withMount(
    buildNestedEditorEditRelativePath(
      CLIENT_COMPONENT_LIST_SEGMENT,
      canonical,
    ),
    mountId,
  );
}

export function buildComponentDesignerNewRelativePath(
  mountId: string = STUDIO_MOUNT_ID,
): string {
  return withMount(
    buildNestedEditorEditRelativePath(CLIENT_COMPONENT_LIST_SEGMENT, CLIENT_COMPONENT_NEW_SLUG),
    mountId,
  );
}

/** @deprecated Prefer `buildComponentDesignerEditRelativePath` — same canonical URL. */
export function buildLiveDesignerRelativePath(
  draft: Pick<DesignerVersionSummary, 'folder' | 'name'>,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  return buildComponentDesignerEditRelativePath(draft, mountId);
}

/** @deprecated Prefer `buildComponentDesignerEditRelativePathFromSlug`. */
export function buildLiveDesignerRelativePathFromSlug(
  componentPath: string,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  return buildComponentDesignerEditRelativePathFromSlug(componentPath, mountId);
}
