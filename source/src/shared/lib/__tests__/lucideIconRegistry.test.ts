import { describe, expect, it } from 'vitest';
import { Settings } from 'lucide-react';
import { loadNavigationIconPack } from '../navigationIcons/navigationIconPacks';
import {
  DEFAULT_LUCIDE_ICON,
  getLucideIconMap,
  resolveLucideIcon,
  toLucidePascalCase,
} from '../lucideIconRegistry';

describe('lucideIconRegistry', () => {
  it('exposes the full Lucide icon set', async () => {
    const pack = await loadNavigationIconPack('lucide');
    expect(pack.entries.length).toBeGreaterThan(1000);
    expect(pack.map.LayoutDashboard).toBeDefined();
    expect(pack.map.Zap).toBeDefined();
  });

  it('resolves PascalCase and kebab-case icon names', async () => {
    const map = await getLucideIconMap();
    expect(await resolveLucideIcon('LayoutDashboard')).toBe(map.LayoutDashboard);
    expect(await resolveLucideIcon('layout-dashboard')).toBe(map.LayoutDashboard);
    expect(await resolveLucideIcon()).toBe(Settings);
    expect(await resolveLucideIcon('NotARealIconName')).toBe(DEFAULT_LUCIDE_ICON);
  });

  it('converts kebab-case names to PascalCase', () => {
    expect(toLucidePascalCase('layout-dashboard')).toBe('LayoutDashboard');
  });
});
