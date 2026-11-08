/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import {
  isUserDashboardLayoutDirty,
  recallUserDashboardLayout,
  rememberUserDashboardLayout,
} from '../userDashboardLayoutPersistence';

describe('userDashboardLayoutPersistence cache', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('recalls a dirty layout after a remount-style read', () => {
    rememberUserDashboardLayout(7, {
      layoutMode: 'masonry',
      widgetOrder: ['health', 'feedback'],
      hiddenWidgets: [],
      widgetSizes: { health: { span: 6, start: 6 } },
      widgetChrome: {},
      homeShortcuts: [],
    }, true);

    expect(isUserDashboardLayoutDirty(7)).toBe(true);
    expect(recallUserDashboardLayout(7)).toEqual({
      layoutMode: 'masonry',
      widgetOrder: ['health', 'feedback'],
      hiddenWidgets: [],
      widgetSizes: { health: { span: 6, start: 6 } },
      widgetChrome: {},
      homeShortcuts: [],
    });
  });

  it('clears the dirty flag after a confirmed save', () => {
    rememberUserDashboardLayout(7, {
      layoutMode: 'masonry',
      widgetOrder: ['kpi'],
      hiddenWidgets: [],
      widgetSizes: {},
      widgetChrome: {},
      homeShortcuts: [],
    }, true);
    rememberUserDashboardLayout(7, {
      layoutMode: 'masonry',
      widgetOrder: ['kpi'],
      hiddenWidgets: [],
      widgetSizes: {},
      widgetChrome: {},
      homeShortcuts: [],
    }, false);

    expect(isUserDashboardLayoutDirty(7)).toBe(false);
    expect(recallUserDashboardLayout(7)?.widgetOrder).toEqual(['kpi']);
  });
});
