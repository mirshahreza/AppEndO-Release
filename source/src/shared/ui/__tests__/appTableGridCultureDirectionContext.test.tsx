/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { resolveAppTableGridCultureDirection, resolveFallbackGridCultureDirection } from '../AppTableGridCultureDirectionContext';

describe('resolveAppTableGridCultureDirection', () => {
  it('prefers document dir when culture context disagrees', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    expect(resolveFallbackGridCultureDirection()).toBe('rtl');
    expect(resolveAppTableGridCultureDirection({
      cultureId: 'us',
      locale: 'en-US',
      language: 'en',
      calendar: 'gregorian',
      direction: 'ltr',
      t: (key) => key,
      ready: true,
    })).toBe('rtl');
  });

  it('uses culture direction when it matches document', () => {
    document.documentElement.setAttribute('dir', 'ltr');
    expect(resolveAppTableGridCultureDirection({
      cultureId: 'us',
      locale: 'en-US',
      language: 'en',
      calendar: 'gregorian',
      direction: 'ltr',
      t: (key) => key,
      ready: true,
    })).toBe('ltr');
  });
});
