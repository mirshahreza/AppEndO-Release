import { describe, expect, it } from 'vitest';
import {
  FIELD_NUMERIC_DATE_DISPLAY_GLYPH_CLASS,
  FIELD_NUMERIC_DATE_DISPLAY_GRID_CENTER_CLASS,
  PHONE_NUMBER_DISPLAY_DIGIT_GLYPH_CLASS,
} from '../fieldNumericDateAlign';

describe('fieldNumericDateAlign', () => {
  it('reserves ten character widths for grid date glyphs', () => {
    expect(FIELD_NUMERIC_DATE_DISPLAY_GLYPH_CLASS).toContain('w-[10ch]');
    expect(FIELD_NUMERIC_DATE_DISPLAY_GLYPH_CLASS).toContain('font-mono');
    expect(FIELD_NUMERIC_DATE_DISPLAY_GRID_CENTER_CLASS).toContain(
      FIELD_NUMERIC_DATE_DISPLAY_GLYPH_CLASS,
    );
  });

  it('reserves eleven character widths for phone digit glyphs', () => {
    expect(PHONE_NUMBER_DISPLAY_DIGIT_GLYPH_CLASS).toContain('min-w-[11ch]');
    expect(PHONE_NUMBER_DISPLAY_DIGIT_GLYPH_CLASS).toContain('w-max');
    expect(PHONE_NUMBER_DISPLAY_DIGIT_GLYPH_CLASS).toContain('font-mono');
  });
});
