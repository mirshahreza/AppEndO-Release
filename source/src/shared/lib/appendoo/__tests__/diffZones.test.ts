import { describe, expect, it } from 'vitest';
import { computeLineDiffZones, formatDiffZoneLabel, revertDiffZone } from '../diffZones';

describe('computeLineDiffZones', () => {
  it('returns empty zones when content is identical', () => {
    expect(computeLineDiffZones('a\nb', 'a\nb')).toEqual([]);
  });

  it('merges adjacent changed lines into one zone', () => {
    expect(computeLineDiffZones('a\nb\nc', 'a\nx\ny')).toEqual([
      { startLine: 2, endLine: 3 },
    ]);
  });

  it('splits disjoint changed regions', () => {
    expect(computeLineDiffZones('a\nb\nc\nd', 'x\nb\nc\ny')).toEqual([
      { startLine: 1, endLine: 1 },
      { startLine: 4, endLine: 4 },
    ]);
  });

  it('formats single-line and multi-line zone labels', () => {
    expect(formatDiffZoneLabel({ startLine: 4, endLine: 4 })).toBe('L4');
    expect(formatDiffZoneLabel({ startLine: 10, endLine: 18 })).toBe('L10–18');
  });
});

describe('revertDiffZone', () => {
  it('restores one zone from baseline', () => {
    const before = 'line1\nline2\nline3';
    const after = 'line1\nCHANGED\nline3';
    expect(revertDiffZone(before, after, { startLine: 2, endLine: 2 })).toBe(before);
  });
});
