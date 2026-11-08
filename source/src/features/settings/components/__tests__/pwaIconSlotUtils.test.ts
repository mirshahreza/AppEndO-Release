import { describe, expect, it } from 'vitest';
import { buildPwaIconPatch, slotsForScope } from '../pwaIconSlotUtils';

describe('pwaIconSlotUtils', () => {
  it('returns all slots when scope is all', () => {
    expect(slotsForScope('192', 'all')).toEqual(['32', '192', '512', 'maskable']);
  });

  it('returns only the selected slot for single scope', () => {
    expect(slotsForScope('512', 'single')).toEqual(['512']);
  });

  it('patches only one icon field for single library scope', () => {
    const patch = buildPwaIconPatch({
      faviconUrl: '/assets/platform/pwa/icon-32.png',
      icon192Url: '/assets/platform/pwa/icon-192.png',
      icon512Url: '/assets/platform/pwa/icon-512.png',
      maskableIcon512Url: '/assets/platform/pwa/icon-maskable-512.png',
      iconSourceRef: 'lucide:box',
    }, '192', 'single');

    expect(patch).toEqual({
      icon192Url: '/assets/platform/pwa/icon-192.png',
    });
  });
});
