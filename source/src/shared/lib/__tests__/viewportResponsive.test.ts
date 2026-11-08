import { describe, expect, it } from 'vitest';
import { filterAdminShellNavByViewport } from '../filterAdminShellNavByViewport';
import { isCompactChromeTier, isOverlayNavTier, resolveViewportTier, tierMeetsMinViewport } from '../viewportTokens';

describe('viewportTokens', () => {
  it('resolves viewport tiers from width', () => {
    expect(resolveViewportTier(375)).toBe('phone');
    expect(resolveViewportTier(399)).toBe('phone');
    expect(resolveViewportTier(400)).toBe('tablet');
    expect(resolveViewportTier(767)).toBe('tablet');
    expect(resolveViewportTier(768)).toBe('tablet');
    expect(resolveViewportTier(1023)).toBe('tablet');
    expect(resolveViewportTier(1024)).toBe('desktop');
    expect(resolveViewportTier(1200)).toBe('desktop');
    expect(resolveViewportTier(1600)).toBe('wide');
  });

  it('uses overlay hamburger nav below desktop and compact chrome on phone and tablet', () => {
    expect(isCompactChromeTier('phone')).toBe(true);
    expect(isCompactChromeTier('tablet')).toBe(true);
    expect(isCompactChromeTier('desktop')).toBe(false);
    expect(isCompactChromeTier('wide')).toBe(false);
    expect(isOverlayNavTier('phone')).toBe(true);
    expect(isOverlayNavTier('tablet')).toBe(true);
    expect(isOverlayNavTier('desktop')).toBe(false);
    expect(isOverlayNavTier('wide')).toBe(false);
  });

  it('enforces minViewport thresholds', () => {
    expect(tierMeetsMinViewport('phone', 'tablet')).toBe(false);
    expect(tierMeetsMinViewport('tablet', 'tablet')).toBe(true);
    expect(tierMeetsMinViewport('tablet', 'desktop')).toBe(false);
    expect(tierMeetsMinViewport('desktop', 'desktop')).toBe(true);
  });
});

describe('filterAdminShellNavByViewport', () => {
  it('keeps studio nav items on phone', () => {
    const groups = filterAdminShellNavByViewport([
      {
        heading: 'Development',
        items: [
          { label: 'Users', path: '/users', pageKey: 'users' },
          { label: 'Git', path: '/git', pageKey: 'git' },
          { label: 'Sandbox', path: '/sandbox', pageKey: 'sandbox' },
        ],
      },
    ], 'phone');

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((item) => item.label)).toEqual(['Users', 'Git', 'Sandbox']);
  });

  it('drops empty nav groups after viewport filtering', () => {
    const groups = filterAdminShellNavByViewport([
      {
        heading: 'Development',
        items: [
          { label: 'Custom', path: '/custom', pageKey: 'custom', minViewport: 'desktop' },
        ],
      },
    ], 'phone');

    expect(groups).toHaveLength(0);
  });

  it('removes nav items that opt into minViewport desktop on tablet', () => {
    const groups = filterAdminShellNavByViewport([
      {
        heading: 'Development',
        items: [
          { label: 'Users', path: '/users', pageKey: 'users' },
          { label: 'Custom', path: '/custom', pageKey: 'custom', minViewport: 'desktop' },
        ],
      },
    ], 'tablet');

    expect(groups[0]?.items.map((item) => item.label)).toEqual(['Users']);
  });

  it('keeps a parent when nested children are filtered out', () => {
    const groups = filterAdminShellNavByViewport([
      {
        heading: 'Development',
        items: [
          {
            label: 'Data Studio',
            path: '/data-studio',
            pageKey: 'data-studio',
            children: [
              { label: 'SQL Console', path: '/sql-console', pageKey: 'sql-console', minViewport: 'desktop' },
            ],
          },
        ],
      },
    ], 'phone');

    expect(groups[0]?.items).toEqual([
      { label: 'Data Studio', path: '/data-studio', pageKey: 'data-studio' },
    ]);
  });
});
