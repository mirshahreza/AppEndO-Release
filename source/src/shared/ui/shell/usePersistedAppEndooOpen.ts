import { useCallback, useSyncExternalStore } from 'react';
import { persistAppEndooOpen, readStoredAppEndooOpen } from '../appendooPreferences';

type Listener = () => void;

let isOpen = readStoredAppEndooOpen();
const listeners = new Set<Listener>();

const getSnapshot = (): boolean => isOpen;

const getServerSnapshot = (): boolean => false;

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const setAppEndooOpen = (open: boolean): void => {
  if (isOpen === open) return;
  isOpen = open;
  persistAppEndooOpen(open);
  listeners.forEach((listener) => listener());
};

/** Close the app-wide chat surface on logout / session expiry. */
export const closePersistedAppEndooOpen = (): void => {
  setAppEndooOpen(false);
};

/** Test-only: re-read open state from storage and notify subscribers. */
export const resetPersistedAppEndooOpenForTests = (): void => {
  isOpen = readStoredAppEndooOpen();
  listeners.forEach((listener) => listener());
};

export function usePersistedAppEndooOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setIsOpen = useCallback((next: boolean) => {
    setAppEndooOpen(next);
  }, []);

  return [open, setIsOpen];
}
