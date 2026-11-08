import { useSyncExternalStore } from 'react';
import { getPageLoadProfileSnapshot, subscribePageLoadProfile } from './store';
import type { PageLoadProfileSnapshot } from './types';

export const usePageLoadProfileSnapshot = (): PageLoadProfileSnapshot | null => (
  useSyncExternalStore(subscribePageLoadProfile, getPageLoadProfileSnapshot, getPageLoadProfileSnapshot)
);
