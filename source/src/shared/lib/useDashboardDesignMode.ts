import { useSyncExternalStore } from 'react';
import {
  getDashboardDesignMode,
  subscribeDashboardDesignMode,
} from './dashboardHomeShortcuts';

export const useDashboardDesignMode = (): boolean =>
  useSyncExternalStore(subscribeDashboardDesignMode, getDashboardDesignMode, getDashboardDesignMode);
