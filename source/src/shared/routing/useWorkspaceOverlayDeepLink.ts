import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  normalizeWorkspaceOverlayToken,
  parseWorkspaceOverlayFromSearchParams,
  setWorkspaceOverlayOnSearchParams,
} from './workspaceOverlayDeepLink';

export type UseWorkspaceOverlayDeepLinkOptions = {
  /** When false, URL is not read or written (e.g. wrong route segment). */
  enabled?: boolean;
  /** Current overlay token derived from UI state; null when no overlay should be reflected. */
  activeToken: string | null;
  /** Open the overlay described by `token` when it appears in the address bar. */
  openFromUrl: (token: string) => void | Promise<void>;
};

/**
 * Keeps `?overlay=` in sync with workspace floating panels / modal shells.
 * Path segments still own primary record identity (`…/edit/{item}`).
 */
export function useWorkspaceOverlayDeepLink(options: UseWorkspaceOverlayDeepLinkOptions): void {
  const { enabled = true, activeToken, openFromUrl } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const skipUrlToStateRef = useRef(false);
  const lastOpenedFromUrlRef = useRef<string | null>(null);
  const openFromUrlRef = useRef(openFromUrl);

  openFromUrlRef.current = openFromUrl;

  const urlToken = parseWorkspaceOverlayFromSearchParams(searchParams);
  const normalizedActive = normalizeWorkspaceOverlayToken(activeToken);

  useEffect(() => {
    if (urlToken && urlToken === normalizedActive) {
      lastOpenedFromUrlRef.current = urlToken;
    }
  }, [normalizedActive, urlToken]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (skipUrlToStateRef.current) {
      skipUrlToStateRef.current = false;
      return;
    }
    if (!urlToken) {
      lastOpenedFromUrlRef.current = null;
      return;
    }
    if (urlToken === lastOpenedFromUrlRef.current) {
      return;
    }
    lastOpenedFromUrlRef.current = urlToken;
    void Promise.resolve(openFromUrlRef.current(urlToken));
  }, [enabled, urlToken]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (urlToken === normalizedActive) {
      return;
    }
    if (!normalizedActive && urlToken && lastOpenedFromUrlRef.current !== urlToken) {
      return;
    }
    skipUrlToStateRef.current = true;
    setSearchParams(
      (current) => setWorkspaceOverlayOnSearchParams(current, normalizedActive),
      { replace: true },
    );
  }, [enabled, normalizedActive, setSearchParams, urlToken]);

  useEffect(() => {
    if (!enabled && urlToken) {
      skipUrlToStateRef.current = true;
      setSearchParams(
        (current) => setWorkspaceOverlayOnSearchParams(current, null),
        { replace: true },
      );
    }
  }, [enabled, setSearchParams, urlToken]);
}

export function useClearWorkspaceOverlayParam(): () => void {
  const [, setSearchParams] = useSearchParams();
  return useCallback(() => {
    setSearchParams(
      (current) => setWorkspaceOverlayOnSearchParams(current, null),
      { replace: true },
    );
  }, [setSearchParams]);
}
