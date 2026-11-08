import { describe, expect, it } from 'vitest';

import {
  getContentTextDirection,
  getDirectionalTextProps,
  isRtlDominantText,
} from '../textDirection';

describe('textDirection', () => {
  it('detects RTL when the first meaningful character is Arabic or Persian', () => {
    expect(isRtlDominantText('مرحبا')).toBe(true);
    expect(isRtlDominantText('  سلام دنیا')).toBe(true);
    expect(getContentTextDirection('سلام')).toBe('rtl');
  });

  it('detects LTR when the first meaningful character is Latin', () => {
    expect(isRtlDominantText('Hello world')).toBe(false);
    expect(isRtlDominantText('  Hello')).toBe(false);
    expect(getContentTextDirection('Hello')).toBe('ltr');
  });

  it('skips neutral leading punctuation and digits', () => {
    expect(isRtlDominantText('123 — سلام')).toBe(true);
    expect(isRtlDominantText('123 Hello')).toBe(false);
  });

  it('returns alignment props for directional blocks', () => {
    expect(getDirectionalTextProps('سلام')).toEqual({
      dir: 'rtl',
      className: 'block w-full text-right',
    });
    expect(getDirectionalTextProps('ببب')).toEqual({
      dir: 'rtl',
      className: 'block w-full text-right',
    });
    expect(getDirectionalTextProps('Hello')).toEqual({
      dir: 'ltr',
      className: 'block w-full text-left',
    });
  });
});
