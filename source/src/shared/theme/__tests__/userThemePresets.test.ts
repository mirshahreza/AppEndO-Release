import { describe, expect, it } from 'vitest';
import {
  getUserThemePresetTokens,
  parseUserThemePresets,
  upsertUserThemePresetTokens,
} from '../userThemePresets';

describe('userThemePresets', () => {
  it('parses a sparse per-swatch token map and ignores unknown ids', () => {
    const parsed = parseUserThemePresets({
      'teal-core': { '--app-accent-500': '#038387' },
      'not-a-swatch': { '--app-accent-500': '#111111' },
      'gray-deep': 'invalid',
    });
    expect(parsed).toEqual({
      'teal-core': { '--app-accent-500': '#038387' },
    });
  });

  it('upserts and clears a swatch without losing other personalizations', () => {
    const first = upsertUserThemePresetTokens({}, 'teal-core', { '--app-shell-bg': '#EBF2F2' });
    const second = upsertUserThemePresetTokens(first, 'gray-deep', { '--app-shell-bg': '#F8FAFC' });
    expect(getUserThemePresetTokens(second, 'teal-core')).toEqual({ '--app-shell-bg': '#EBF2F2' });

    const cleared = upsertUserThemePresetTokens(second, 'teal-core', null);
    expect(getUserThemePresetTokens(cleared, 'teal-core')).toBeNull();
    expect(getUserThemePresetTokens(cleared, 'gray-deep')).toEqual({ '--app-shell-bg': '#F8FAFC' });
  });
});
