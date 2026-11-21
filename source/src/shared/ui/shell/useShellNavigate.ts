import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  navigationGuardRegistry,
  normalizeNavigationPath,
} from '../../lib/navigationGuardRegistry';
import { beginShellNavigationPending } from './shellNavigationPending';
import type { PlatformRuntimeConfig } from '../../api/contracts/platform/types';
import { platformQueryKeys } from '../../api/queries/platform';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { resolveStudioPageKeyForNavigation } from '../../../app/platform/resolveStudioPageKeyForNavigation';
import { preloadStudioPageChunk } from '../../../app/routes/studioPageChunkPreload';

/**
 * Shell menu/link navigation: raise the loading cover, then change route.
 * Guards still run first — pending starts only when navigation actually proceeds.
 */
export function useShellNavigate(): (path: string, afterNavigate?: () => void) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const mount = useOptionalPlatformMount();

  return useCallback((path: string, afterNavigate?: () => void) => {
    const fromPath = normalizeNavigationPath(pathname);
    const toPath = normalizeNavigationPath(path);
    const proceed = () => {
      const config = queryClient.getQueryData<PlatformRuntimeConfig>(platformQueryKeys.runtimeConfig());
      if (config && mount) {
        const pageKey = resolveStudioPageKeyForNavigation(config, mount.id, toPath);
        preloadStudioPageChunk(config, config.version, pageKey);
      }
      flushSync(() => {
        beginShellNavigationPending(fromPath, toPath);
      });
      navigate(path);
      afterNavigate?.();
    };

    if (navigationGuardRegistry.runGuards(fromPath, toPath, proceed)) {
      return;
    }

    proceed();
  }, [mount, navigate, pathname, queryClient]);
}
