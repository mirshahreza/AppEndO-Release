import { describe, expect, it } from 'vitest';
import { resolveCultureFontFamily } from '../cultureFontLoader';
import { IR_CULTURE_TYPOGRAPHY } from '../cultureTypography';

describe('cultureFontLoader', () => {
  it('resolves the default culture font stack', () => {
    expect(resolveCultureFontFamily(IR_CULTURE_TYPOGRAPHY)).toBe(
      '"Vazirmatn", ui-sans-serif, system-ui, sans-serif',
    );
  });
});
