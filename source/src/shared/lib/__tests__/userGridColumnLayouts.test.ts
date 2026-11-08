import { describe, expect, it } from 'vitest';
import {
  mergeGridColumnLayout,
  normalizeGridColumnLayoutPayload,
  parseRawGridColumnLayout,
  parseUserGridColumnLayouts,
  resolveStoredGridColumnLayout,
} from '../userGridColumnLayouts';

describe('userGridColumnLayouts', () => {
  it('returns empty map for invalid stored values', () => {
    expect(parseUserGridColumnLayouts(null)).toEqual({});
    expect(parseUserGridColumnLayouts('bad')).toEqual({});
    expect(parseUserGridColumnLayouts([])).toEqual({});
  });

  it('parses valid per-grid layouts and ignores invalid entries', () => {
    expect(parseUserGridColumnLayouts({
      users: {
        order: ['id', 'name'],
        hidden: ['email'],
        widths: { id: 80, name: '200' },
      },
      '': { order: ['x'] },
      broken: 'nope',
    })).toEqual({
      users: {
        order: ['id', 'name'],
        hidden: ['email'],
        widths: { id: 80, name: 200 },
      },
    });
  });

  it('normalizes payload safely', () => {
    expect(normalizeGridColumnLayoutPayload('users', { order: ['id'], hidden: [], widths: {} })).toEqual({
      gridId: 'users',
      layout: { order: ['id'], hidden: [], widths: {} },
    });
    expect(normalizeGridColumnLayoutPayload('', { order: ['id'] })).toBeNull();
    expect(normalizeGridColumnLayoutPayload('users', null)).toBeNull();
  });

  it('merges and resolves stored layouts by grid id', () => {
    const merged = mergeGridColumnLayout({}, 'users', {
      order: ['name'],
      hidden: [],
      widths: {},
    });
    expect(resolveStoredGridColumnLayout(merged, 'users')).toEqual({
      order: ['name'],
      hidden: [],
      widths: {},
    });
    expect(resolveStoredGridColumnLayout(merged, 'missing')).toBeNull();
  });

  it('parses partial layout shapes without throwing', () => {
    expect(parseRawGridColumnLayout({ order: 'bad', hidden: [1, 'ok'], widths: { a: '10' } })).toEqual({
      order: [],
      hidden: ['ok'],
      widths: { a: 10 },
    });
  });
});
