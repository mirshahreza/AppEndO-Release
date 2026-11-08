import { afterEach, describe, expect, it } from 'vitest';
import {
  createDashboardHomeShortcut,
  getDashboardDesignMode,
  mergeDashboardHomeShortcut,
  normalizeDashboardHomeShortcutPath,
  parseDashboardHomeShortcuts,
  setDashboardDesignMode,
} from '../dashboardHomeShortcuts';

describe('dashboardHomeShortcuts', () => {
  it('accepts studio paths and rejects javascript URLs', () => {
    expect(normalizeDashboardHomeShortcutPath('/us/studio/data-studio')).toBe('/us/studio/data-studio');
    expect(normalizeDashboardHomeShortcutPath('iq/hawiety/registration-portal-dev')).toBe(
      '/iq/hawiety/registration-portal-dev',
    );
    expect(normalizeDashboardHomeShortcutPath('javascript:alert(1)')).toBeNull();
    expect(normalizeDashboardHomeShortcutPath('//evil.example')).toBeNull();
  });

  it('refuses to pin Home onto Home', () => {
    expect(createDashboardHomeShortcut({
      kind: 'nav',
      pageKey: 'dashboard',
      path: '/us/studio',
      label: 'Home',
    })).toBeNull();
  });

  it('parses valid shortcuts and drops duplicates', () => {
    expect(parseDashboardHomeShortcuts([
      { kind: 'nav', pageKey: 'data-studio', path: '/us/studio/data-studio', label: 'Data Studio', icon: 'lucide:database' },
      { kind: 'nav', pageKey: 'data-studio', path: '/us/studio/data-studio', label: 'Dup' },
      { kind: 'custom', path: 'https://example.com', label: 'Example' },
      { kind: 'nav', path: '/oops', label: '' },
    ])).toEqual([
      {
        id: 'nav:data-studio',
        kind: 'nav',
        pageKey: 'data-studio',
        path: '/us/studio/data-studio',
        label: 'Data Studio',
        icon: 'lucide:database',
      },
      {
        id: 'custom:https://example.com/',
        kind: 'custom',
        path: 'https://example.com/',
        label: 'Example',
      },
    ]);
  });

  it('does not add a shortcut that is already pinned', () => {
    const current = parseDashboardHomeShortcuts([
      { kind: 'nav', pageKey: 'cms', path: '/us/studio/cms', label: 'CMS' },
    ]);
    expect(mergeDashboardHomeShortcut(current, {
      id: 'nav:cms',
      kind: 'nav',
      pageKey: 'cms',
      path: '/us/studio/cms',
      label: 'CMS',
    })).toBe(current);
  });

  it('publishes Home design mode for the sidebar', () => {
    setDashboardDesignMode(false);
    expect(getDashboardDesignMode()).toBe(false);
    setDashboardDesignMode(true);
    expect(getDashboardDesignMode()).toBe(true);
    setDashboardDesignMode(false);
    expect(getDashboardDesignMode()).toBe(false);
  });
});
