import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'hwy.legacyFieldFilterBar.';

const readStoredLegacyMode = (storageKey: string): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`) === '1';
  } catch {
    return false;
  }
};

const writeStoredLegacyMode = (storageKey: string, legacyMode: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (legacyMode) {
      window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, '1');
    } else {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
    }
  } catch {
    // ignore quota / private mode
  }
};

/** Default simple search bar; legacy app field filters when toggled on. */
export function useHwyLegacyFieldFilterBarMode(
  storageKey: string,
  onLegacyFieldFiltersHidden?: () => void,
): {
  legacyFieldFiltersVisible: boolean;
  setLegacyFieldFiltersVisible: (next: boolean) => void;
  toggleLegacyFieldFilters: () => void;
} {
  const [legacyFieldFiltersVisible, setLegacyFieldFiltersVisibleState] = useState(
    () => readStoredLegacyMode(storageKey),
  );

  useEffect(() => {
    setLegacyFieldFiltersVisibleState(readStoredLegacyMode(storageKey));
  }, [storageKey]);

  const setLegacyFieldFiltersVisible = useCallback((next: boolean) => {
    setLegacyFieldFiltersVisibleState(next);
    writeStoredLegacyMode(storageKey, next);
    if (!next) {
      onLegacyFieldFiltersHidden?.();
    }
  }, [onLegacyFieldFiltersHidden, storageKey]);

  const toggleLegacyFieldFilters = useCallback(() => {
    setLegacyFieldFiltersVisibleState((previous) => {
      const next = !previous;
      writeStoredLegacyMode(storageKey, next);
      if (!next) {
        onLegacyFieldFiltersHidden?.();
      }
      return next;
    });
  }, [onLegacyFieldFiltersHidden, storageKey]);

  return {
    legacyFieldFiltersVisible,
    setLegacyFieldFiltersVisible,
    toggleLegacyFieldFilters,
  };
}
