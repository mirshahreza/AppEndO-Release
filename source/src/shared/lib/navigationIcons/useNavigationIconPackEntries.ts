import { useEffect, useState } from 'react';
import { getNavigationIconPackNames } from './lazyNavigationIconMap';
import { loadNavigationIconPack } from './navigationIconPacks';
import type { NavigationIconPackId } from './types';

export function useNavigationIconPackEntries(
  packId: NavigationIconPackId,
  enabled = true,
) {
  const [iconNames, setIconNames] = useState<readonly string[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIconNames([]);
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setIconNames([]);

    void loadNavigationIconPack(packId)
      .then((pack) => {
        if (!cancelled) {
          setIconNames(getNavigationIconPackNames(pack));
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setIconNames([]);
          setIsLoading(false);
          setLoadError(error instanceof Error ? error.message : 'Failed to load icon pack.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, packId]);

  return { iconNames, isLoading, loadError };
};
