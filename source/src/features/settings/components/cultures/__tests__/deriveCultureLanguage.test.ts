import { describe, expect, it } from 'vitest';
import { deriveCultureLanguage } from '../constants';

describe('deriveCultureLanguage', () => {
  it('derives language from locale tag', () => {
    expect(deriveCultureLanguage('fa-IR', 'us')).toBe('fa');
    expect(deriveCultureLanguage('en-US', 'ir')).toBe('en');
  });

  it('falls back to translation bundle when locale is empty', () => {
    expect(deriveCultureLanguage('', 'ir')).toBe('fa');
    expect(deriveCultureLanguage('', 'iq')).toBe('ar');
    expect(deriveCultureLanguage('', 'us')).toBe('en');
  });
});
