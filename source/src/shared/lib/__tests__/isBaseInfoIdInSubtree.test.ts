import { describe, expect, it } from 'vitest';
import { isBaseInfoIdInSubtree } from '../isBaseInfoIdInSubtree';

describe('isBaseInfoIdInSubtree', () => {
  it('includes the root itself', () => {
    expect(isBaseInfoIdInSubtree('100.4', '100.4')).toBe(true);
  });

  it('includes descendants via HID prefix', () => {
    expect(isBaseInfoIdInSubtree('100.4', '100.4.1')).toBe(true);
    expect(isBaseInfoIdInSubtree('100.4', '100.4.3.2')).toBe(true);
  });

  it('excludes siblings and unrelated trees', () => {
    expect(isBaseInfoIdInSubtree('100.4', '100.5')).toBe(false);
    expect(isBaseInfoIdInSubtree('100.4', '100.5.1')).toBe(false);
    expect(isBaseInfoIdInSubtree('100.4', '100')).toBe(false);
    expect(isBaseInfoIdInSubtree('100.4', '100.40')).toBe(false);
  });

  it('rejects empty ids', () => {
    expect(isBaseInfoIdInSubtree('', '100.4')).toBe(false);
    expect(isBaseInfoIdInSubtree('100.4', '')).toBe(false);
  });
});
