import { describe, expect, it } from 'vitest';
import { getTreeDropPositionCandidates, resolveTreeDropPosition } from '../treeDropPosition';

describe('getTreeDropPositionCandidates', () => {
  it('prefers before in the top band', () => {
    expect(getTreeDropPositionCandidates(0.1)).toEqual(['before', 'after', 'inside']);
  });

  it('prefers inside in the middle band', () => {
    expect(getTreeDropPositionCandidates(0.5)).toEqual(['inside', 'before', 'after']);
  });

  it('prefers after in the bottom band', () => {
    expect(getTreeDropPositionCandidates(0.9)).toEqual(['after', 'before', 'inside']);
  });
});

describe('resolveTreeDropPosition', () => {
  it('falls back when the preferred position is blocked', () => {
    const resolved = resolveTreeDropPosition(0.5, (position) => position !== 'inside');
    expect(resolved).toBe('before');
  });

  it('returns null when every candidate is blocked', () => {
    const resolved = resolveTreeDropPosition(0.5, () => false);
    expect(resolved).toBeNull();
  });
});
