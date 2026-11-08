import { describe, expect, it } from 'vitest';
import {
  resolveNavGroupCollapsedFullLabel,
  resolveNavGroupCollapsedLabel,
  resolveNavGroupDisplayLabel,
  resolveNavGroupIcon,
} from '../navGroupIcons';
import type { AdminShellNavGroup } from '../types';

describe('navGroupIcons', () => {
  it('shortens known group headings for display', () => {
    expect(resolveNavGroupDisplayLabel('Development')).toBe('Dev');
    expect(resolveNavGroupDisplayLabel('Workshops')).toBe('Workshops');
    expect(resolveNavGroupDisplayLabel('Extensions')).toBe('Ext');
    expect(resolveNavGroupDisplayLabel('Operations')).toBe('Ops');
    expect(resolveNavGroupDisplayLabel('Records')).toBe('Records');
    expect(resolveNavGroupDisplayLabel('Remote Hubs')).toBe('Remote Hubs');
  });

  it('resolves known group icons by heading', () => {
    const group: AdminShellNavGroup = {
      heading: 'Development',
      items: [{ label: 'Functions', path: '/studio/functions', icon: 'Code2' }],
    };

    expect(resolveNavGroupIcon(group)).toBe('tabler:IconBraces');
  });

  it('resolves the Extensions group icon', () => {
    const group: AdminShellNavGroup = {
      heading: 'Extensions',
      items: [{ label: 'Package Manager', path: '/studio/package-manager', icon: 'Package' }],
    };

    expect(resolveNavGroupIcon(group)).toBe('tabler:IconPuzzle');
  });

  it('resolves the Workshops group icon', () => {
    const group: AdminShellNavGroup = {
      heading: 'Workshops',
      items: [{ label: 'SQL Console', path: '/studio/sql-console', icon: 'tabler:IconSql' }],
    };

    expect(resolveNavGroupIcon(group)).toBe('tabler:IconTools');
  });

  it('resolves the Remote Hubs group icon', () => {
    const group: AdminShellNavGroup = {
      heading: 'Remote Hubs',
      items: [{ label: 'SSH', path: '/studio/ssh', icon: 'tabler:IconTerminal2' }],
    };

    expect(resolveNavGroupIcon(group)).toBe('tabler:IconNetwork');
  });

  it('falls back to the first item icon for ungrouped items', () => {
    const group: AdminShellNavGroup = {
      heading: null,
      items: [{ label: 'Home', path: '/studio', icon: 'LayoutDashboard' }],
    };

    expect(resolveNavGroupIcon(group)).toBe('LayoutDashboard');
    expect(resolveNavGroupCollapsedFullLabel(group)).toBe('Home');
    expect(resolveNavGroupCollapsedLabel(group)).toBe('Home');
  });

  it('keeps collapsed section labels to 6 graphemes from the end when no override is set', () => {
    expect(resolveNavGroupCollapsedLabel({ heading: 'Workshops', items: [] })).toBe('kshops');
    expect(resolveNavGroupCollapsedLabel({ heading: 'Records', items: [] })).toBe('ecords');
    expect(resolveNavGroupCollapsedLabel({ heading: 'Remote Hubs', items: [] })).toBe('e Hubs');
    expect(resolveNavGroupCollapsedFullLabel({ heading: 'Workshops', items: [] })).toBe('Workshops');
    expect(resolveNavGroupCollapsedLabel({ heading: 'Development', items: [] })).toBe('Dev');
    expect(resolveNavGroupCollapsedLabel({ heading: 'Platform', items: [] })).toBe('atform');
  });

  it('uses collapsedLabel override on groups when provided', () => {
    expect(
      resolveNavGroupCollapsedLabel({
        heading: 'Persons management',
        collapsedLabel: 'People',
        items: [],
      }),
    ).toBe('People');
  });
});
