import { describe, expect, it } from 'vitest';
import { loadNavigationIconPack } from '../navigationIconPacks';

describe('navigationIconPacks', () => {
  it('loads iconify-backed Marketeq pack', async () => {
    const pack = await loadNavigationIconPack('marketeq');
    expect(pack.iconNames?.length).toBeGreaterThan(100);
    expect(pack.map.acorn).toBeDefined();
  });

  it('loads Solar pack', async () => {
    const pack = await loadNavigationIconPack('solar');
    expect(pack.iconNames?.length).toBeGreaterThan(100);
    expect(pack.map.Home).toBeDefined();
  });

  it('resolves Lucide Home alias even when icons map only has House', async () => {
    const pack = await loadNavigationIconPack('lucide');
    expect(pack.map.House).toBeDefined();
    expect(pack.map.Home).toBeDefined();
  });
});
