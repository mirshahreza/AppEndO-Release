import { describe, expect, it } from 'vitest';
import {
  accentThemeToAttributeValue,
  isLoginPath,
  LOGIN_ACCENT_THEME,
  parseAccentThemePreference,
} from '../accentThemePreference';
import { DEFAULT_ACCENT_HEX } from '../accentColorUtils';

describe('accentThemePreference', () => {
  it('parses a valid accent theme preference', () => {
    expect(parseAccentThemePreference({ hex: '#00A28A', source: 'fluent' })).toEqual({
      hex: '#00A28A',
      source: 'fluent',
    });
  });

  it('rejects invalid accent theme payloads', () => {
    expect(parseAccentThemePreference(null)).toBeNull();
    expect(parseAccentThemePreference({ hex: 'not-a-color', source: 'fluent' })).toBeNull();
    expect(parseAccentThemePreference({ hex: '#00A28A', source: 'invalid' })).toEqual({
      hex: '#00A28A',
      source: 'default',
    });
  });

  it('serializes accent theme state for attribute storage', () => {
    expect(accentThemeToAttributeValue({ hex: '#6366F1', source: 'material' })).toEqual({
      hex: '#6366F1',
      source: 'material',
    });
  });

  it('defines a fixed login accent theme', () => {
    expect(LOGIN_ACCENT_THEME).toEqual({ hex: DEFAULT_ACCENT_HEX, source: 'default' });
  });

  it('detects the login route path', () => {
    expect(isLoginPath('/login')).toBe(true);
    expect(isLoginPath('/')).toBe(false);
    expect(isLoginPath('/users')).toBe(false);
  });
});
