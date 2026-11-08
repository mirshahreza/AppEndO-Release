import { getDefaultCulturePackId, getEnabledCulturePackIds } from '../../core/culture/CultureRegistry';
import { resolveCultureFromPathname } from '../../core/culture/CultureUrlResolver';
import { buildMountAbsolutePath } from '../../app/platform/platformConfigHelpers';
import { STUDIO_PORTAL_SEGMENT } from '../../shared/api/contracts/platform/mountConstants';

const normalizeNavigateTarget = (target: string): string => target.trim();

/**
 * Published Designer pages emit mount-relative paths such as `/studio/cms/contents`.
 * When the active URL is culture-prefixed (`/us/studio/...`), prepend the culture so
 * client-side navigation stays on the same mount instead of falling through to a bare
 * `/studio/*` host or an invalid segment like `/ux/studio/*`.
 */
export function resolvePublishedDesignerNavigateTarget(
  target: string,
  pathname: string,
  mountPathPrefix?: string | null,
): string {
  const normalized = normalizeNavigateTarget(target);
  if (!normalized.startsWith('/')) {
    return normalized;
  }

  const enabledCultureIds = new Set(getEnabledCulturePackIds());
  const targetSegments = normalized.replace(/^\/+/, '').split('/').filter(Boolean);
  if (targetSegments.length > 0 && enabledCultureIds.has(targetSegments[0])) {
    return normalized;
  }

  const pathnameSegments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const pathnameCultureId = pathnameSegments.length > 0 && enabledCultureIds.has(pathnameSegments[0])
    ? pathnameSegments[0]
    : null;

  if (pathnameCultureId) {
    return buildMountAbsolutePath(`/${pathnameCultureId}`, normalized.replace(/^\/+/, ''));
  }

  if (
    pathnameSegments.length >= 2
    && pathnameSegments[1] === STUDIO_PORTAL_SEGMENT
    && pathnameSegments[0].length === 2
    && !enabledCultureIds.has(pathnameSegments[0])
  ) {
    return buildMountAbsolutePath(`/${getDefaultCulturePackId()}`, normalized.replace(/^\/+/, ''));
  }

  const studioRoot = `/${STUDIO_PORTAL_SEGMENT}`;
  if (normalized === studioRoot || normalized.startsWith(`${studioRoot}/`)) {
    return normalized;
  }

  if (mountPathPrefix?.trim()) {
    return buildMountAbsolutePath(mountPathPrefix.trim(), normalized.replace(/^\/+/, ''));
  }

  const { cultureId } = resolveCultureFromPathname(pathname);
  return buildMountAbsolutePath(`/${cultureId}`, normalized.replace(/^\/+/, ''));
}
