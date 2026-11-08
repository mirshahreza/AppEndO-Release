import { useEffect, useMemo } from 'react';
import {
  resolvePortalBrand,
  type ResolvedPortalBrand,
} from '../../shared/api/contracts/platform/portalBrand';
import {
  cachePortalBrand,
  readCachedPortalBrandForPathname,
} from '../../shared/lib/portalBrandCache';
import { useOptionalPortal } from './PortalContext';
import { useOptionalPlatformConfig } from './PlatformConfigProvider';
import { getShellByKey, resolveRegistryShellForPortal } from './platformConfigHelpers';
import { resolvePortalShellFromPathname } from './PortalUrlResolver';
import { STUDIO_MOUNT_ID } from '../../shared/api/contracts/platform/mountConstants';
import { useOptionalPlatformMount } from './PlatformMountContext';

export function useResolvedPortalBrand(): ResolvedPortalBrand {
  const portal = useOptionalPortal();
  const configValue = useOptionalPlatformConfig();
  const mount = useOptionalPlatformMount();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  const resolved = useMemo((): ResolvedPortalBrand => {
    const config = configValue?.config;
    if (config) {
      const fromPortal = portal
        ? resolveRegistryShellForPortal(config, portal)
        : null;
      const fromPath = !fromPortal
        ? (() => {
          const resolvedPath = resolvePortalShellFromPathname(
            pathname,
            config,
            mount?.id ?? STUDIO_MOUNT_ID,
          );
          return getShellByKey(config, resolvedPath.shellKey);
        })()
        : fromPortal;
      if (fromPath) {
        return resolvePortalBrand(fromPath.brand, fromPath.name);
      }
    }

    const cached = readCachedPortalBrandForPathname(pathname);
    return {
      ...(cached?.logoUrl ? { logoUrl: cached.logoUrl } : {}),
      ...(cached?.title ? { title: cached.title } : {}),
    };
  }, [configValue?.config, mount?.id, pathname, portal]);

  useEffect(() => {
    const segment = portal?.portalSegment
      || (typeof window !== 'undefined'
        ? window.location.pathname.split('/').filter(Boolean)[1]
        : '');
    if (segment) {
      cachePortalBrand(segment, resolved);
    }
  }, [portal?.portalSegment, resolved]);

  return resolved;
}
