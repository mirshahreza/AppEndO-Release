/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { readDocumentReadingDirection, resolveCultureShellIsRtl } from '../cultureShellDirection';

describe('cultureShellDirection', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  it('prefers culture direction when present', () => {
    expect(resolveCultureShellIsRtl({ direction: 'rtl' })).toBe(true);
    expect(resolveCultureShellIsRtl({ direction: 'ltr' })).toBe(false);
  });

  it('falls back to document dir when culture is missing', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    expect(resolveCultureShellIsRtl(null)).toBe(true);
    expect(readDocumentReadingDirection()).toBe('rtl');
  });
});
