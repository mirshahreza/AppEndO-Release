import React, { useLayoutEffect, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { normalizeProfilePath } from '../../../shared/lib/pageLoadProfile/normalizeProfilePath';
import {
  beginPageLoadProfileNavigation,
  finalizePageLoadProfileIfStale,
  markPageLoadProfileShellReady,
  refreshPageLoadProfileSession,
  setPageLoadProfilingEnabled,
} from '../../../shared/lib/pageLoadProfile/store';
import { useStudioToolsGate } from '../hooks/useStudioToolsGate';
import { installPageLoadProfileDevTools } from '../../../shared/lib/pageLoadProfile/pageLoadProfileDevTools';

/**
 * Enables automatic page-load timing for Studio tools users (ADMIN / DEVELOPER).
 */
export const PageLoadProfileTracker: React.FC = () => {
  const gate = useStudioToolsGate();
  const { pathname } = useLocation();
  const normalizedPath = normalizeProfilePath(pathname);
  const previousPathRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    setPageLoadProfilingEnabled(gate);
  }, [gate]);

  useEffect(() => {
    installPageLoadProfileDevTools();
  }, []);

  useLayoutEffect(() => {
    if (!gate) {
      return;
    }
    const pathChanged = previousPathRef.current !== normalizedPath;
    previousPathRef.current = normalizedPath;
    beginPageLoadProfileNavigation(normalizedPath, pathChanged);
    refreshPageLoadProfileSession();
  }, [gate, normalizedPath]);

  useEffect(() => {
    if (!gate) {
      return;
    }
    const timer = window.setInterval(() => {
      const reveal = document.querySelector('[data-testid="shell-formatted-reveal"]');
      if (reveal?.getAttribute('data-ready') === 'true') {
        markPageLoadProfileShellReady(normalizedPath);
      }
      refreshPageLoadProfileSession();
      finalizePageLoadProfileIfStale(normalizedPath);
    }, 250);
    return () => window.clearInterval(timer);
  }, [gate, normalizedPath]);

  return null;
};
