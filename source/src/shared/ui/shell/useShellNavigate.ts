import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  navigationGuardRegistry,
  normalizeNavigationPath,
} from '../../lib/navigationGuardRegistry';
import { beginShellNavigationPending } from './shellNavigationPending';

/**
 * Shell menu/link navigation: raise the loading cover, then change route.
 * Guards still run first — pending starts only when navigation actually proceeds.
 */
export function useShellNavigate(): (path: string, afterNavigate?: () => void) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback((path: string, afterNavigate?: () => void) => {
    const fromPath = normalizeNavigationPath(pathname);
    const toPath = normalizeNavigationPath(path);
    const proceed = () => {
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
  }, [navigate, pathname]);
}
