import { describe, expect, it } from 'vitest';
import {
  formatDesignerDatePickerValue,
  parseDesignerDatePickerValue,
  resolveDatePickerI18nLocale,
  DESIGNER_DATE_PICKER_LOCALE_OPTIONS,
  DESIGNER_DATE_PICKER_TIMEZONE_OPTIONS,
  DESIGNER_DATE_PICKER_VALUE_OPTIONS,
} from '../designerDatePickerConfig';

describe('designerDatePickerConfig', () => {
  it('resolves unicode calendar locales for gregorian jalali and hijri', () => {
    expect(resolveDatePickerI18nLocale('gregorian')).toBe('en-US-u-ca-gregory');
    expect(resolveDatePickerI18nLocale('jalali')).toBe('fa-IR-u-ca-persian');
    expect(resolveDatePickerI18nLocale('hijri')).toBe('ar-SA-u-ca-islamic');
    expect(resolveDatePickerI18nLocale('hebrew')).toBe('he-IL-u-ca-hebrew');
    expect(resolveDatePickerI18nLocale('jalali', 'fa-AF')).toBe('fa-AF-u-ca-persian');
  });

  it('parses day and minute values based on granularity', () => {
    expect(parseDesignerDatePickerValue('2024-03-07', 'day')?.toString()).toBe('2024-03-07');
    expect(parseDesignerDatePickerValue('2024-03-07T14:30', 'minute')?.toString()).toBe('2024-03-07T14:30:00');
  });

  it('formats serialized values for inspector bindings', () => {
    expect(formatDesignerDatePickerValue('2024-03-07T14:30:00', 'minute')).toBe('2024-03-07T14:30');
    expect(formatDesignerDatePickerValue('2024-03-07T14:30:00', 'day')).toBe('2024-03-07');
  });

  it('exposes inspector dropdown presets for locale and timezone', () => {
    expect(DESIGNER_DATE_PICKER_LOCALE_OPTIONS[0]?.value).toBe('');
    expect(DESIGNER_DATE_PICKER_LOCALE_OPTIONS.some((option) => option.value === 'fa-IR')).toBe(true);
    expect(DESIGNER_DATE_PICKER_TIMEZONE_OPTIONS.some((option) => option.value === 'Asia/Tehran')).toBe(true);
    expect(DESIGNER_DATE_PICKER_VALUE_OPTIONS.some((option) => option.value === '1403-01-01')).toBe(true);
  });
});
