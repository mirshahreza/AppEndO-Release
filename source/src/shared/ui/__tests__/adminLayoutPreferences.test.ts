// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  persistExpandedNavGroups,
  readStoredExpandedNavGroups,
} from '../adminLayoutPreferences';

const NAV_EXPANDED_GROUPS_STORAGE_KEY = 'appendo.admin.nav-expanded-groups';

describe('adminLayoutPreferences expanded nav groups', () => {
  afterEach(() => {
    window.localStorage.removeItem(NAV_EXPANDED_GROUPS_STORAGE_KEY);
  });

  it('returns null when no stored value exists', () => {
    expect(readStoredExpandedNavGroups()).toBeNull();
  });

  it('round-trips expanded group headings', () => {
    persistExpandedNavGroups(new Set(['Platform', 'Studio']));

    expect(readStoredExpandedNavGroups()).toEqual(new Set(['Platform', 'Studio']));
  });

  it('persists an empty set', () => {
    persistExpandedNavGroups(new Set());

    expect(readStoredExpandedNavGroups()).toEqual(new Set());
  });
});
