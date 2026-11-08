import { useSyncExternalStore } from 'react';
import type { PageGuidePoint } from './pageGuide.types';

type PageGuideListener = () => void;

let active = false;
let origin: PageGuidePoint | null = null;
const listeners = new Set<PageGuideListener>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

export const isPageGuideActive = (): boolean => active;

export const startPageGuide = (from?: PageGuidePoint): void => {
  origin = from ?? origin;
  if (active) return;
  active = true;
  emit();
};

export const stopPageGuide = (): void => {
  if (!active) return;
  active = false;
  origin = null;
  emit();
};

export const togglePageGuide = (from?: PageGuidePoint): void => {
  if (active) {
    stopPageGuide();
    return;
  }
  startPageGuide(from);
};

export const takePageGuideOrigin = (): PageGuidePoint | null => {
  const value = origin;
  origin = null;
  return value;
};

export const subscribePageGuide = (listener: PageGuideListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resetPageGuideStoreForTests = (): void => {
  active = false;
  origin = null;
  listeners.clear();
};

export const usePageGuideActive = (): boolean => (
  useSyncExternalStore(subscribePageGuide, isPageGuideActive, () => false)
);
