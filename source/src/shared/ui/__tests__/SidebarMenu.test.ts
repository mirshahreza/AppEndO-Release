import { describe, expect, it } from 'vitest';
import type { AdminShellNavGroup } from '../../../layouts/adminShell/types';
import { filterSidebarMenuGroups, clampSidebarMenuGroupGap } from '../SidebarMenu';

const grouped: AdminShellNavGroup = {
  heading: 'Platform',
  items: [{ label: 'Dashboard', path: '/dashboard' }],
};

const ungroupedStart: AdminShellNavGroup = {
  heading: null,
  items: [{ label: 'Home', path: '/home' }],
};

const ungroupedEnd: AdminShellNavGroup = {
  heading: null,
  items: [{ label: 'Help', path: '/help' }],
};

const fullMenu: AdminShellNavGroup[] = [ungroupedStart, grouped, ungroupedEnd];

describe('filterSidebarMenuGroups', () => {
  it('keeps ungrouped start and end sections by default', () => {
    expect(filterSidebarMenuGroups(fullMenu)).toEqual(fullMenu);
  });

  it('removes leading ungrouped sections when ungroupedAtStart is false', () => {
    expect(filterSidebarMenuGroups(fullMenu, { ungroupedAtStart: false })).toEqual([grouped, ungroupedEnd]);
  });

  it('removes trailing ungrouped sections when ungroupedAtEnd is false', () => {
    expect(filterSidebarMenuGroups(fullMenu, { ungroupedAtEnd: false })).toEqual([ungroupedStart, grouped]);
  });

  it('removes both ungrouped edges when both flags are false', () => {
    expect(filterSidebarMenuGroups(fullMenu, { ungroupedAtStart: false, ungroupedAtEnd: false })).toEqual([grouped]);
  });
});

describe('clampSidebarMenuGroupGap', () => {
  it('clamps group gap to 0–30 pixels', () => {
    expect(clampSidebarMenuGroupGap(-4)).toBe(0);
    expect(clampSidebarMenuGroupGap(0)).toBe(0);
    expect(clampSidebarMenuGroupGap(17)).toBe(17);
    expect(clampSidebarMenuGroupGap(30)).toBe(30);
    expect(clampSidebarMenuGroupGap(48)).toBe(30);
    expect(clampSidebarMenuGroupGap(Number.NaN)).toBe(0);
  });
});
