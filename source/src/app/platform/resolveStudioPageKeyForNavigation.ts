import type { PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import { ROOT_PORTAL_SEGMENT } from '../../shared/api/contracts/platform/mountConstants';
import { resolvePortalFromPathname } from './PortalUrlResolver';
import { resolveRouteBindingForPortalRemainder } from './platformConfigHelpers';

/** Resolve `pageKey` for a mount-local pathname — used for route chunk prefetch. */
export function resolveStudioPageKeyForNavigation(
  config: PlatformRuntimeConfig,
  mountId: string,
  pathname: string,
): string | undefined {
  const applicationResolved = resolvePortalFromPathname(pathname, config);
  const binding = resolveRouteBindingForPortalRemainder(
    config,
    mountId,
    applicationResolved.pageRemainderPath,
    applicationResolved.portalSegment,
  );

  if (binding?.pageKey?.trim()) {
    return binding.pageKey.trim();
  }

  const remainder = applicationResolved.pageRemainderPath.trim();
  if (applicationResolved.portalSegment === ROOT_PORTAL_SEGMENT) {
    return !remainder || remainder === '/' ? 'cms-site-home' : 'cms-site-article';
  }

  return undefined;
}