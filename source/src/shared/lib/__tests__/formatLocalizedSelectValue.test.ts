import { describe, expect, it } from 'vitest';
import { createTranslationRuntime } from '../../../core/culture/TranslationRuntime';
import { TRANSLATION_BASE_EN } from '../../../core/culture/translations/baseEn';
import { formatLocalizedSelectValue, resolveNativeOptionLabel } from '../formatLocalizedSelectValue';

describe('formatLocalizedSelectValue', () => {
  const { t } = createTranslationRuntime(
    { ...TRANSLATION_BASE_EN },
    { ...TRANSLATION_BASE_EN },
  );

  it('joins two labels with a localized conjunction', () => {
    const arabic = createTranslationRuntime(
      {
        'ui.controls.select.listPair': '{first} و {second}',
        'ui.controls.select.listConjunction': 'و',
        'ui.controls.select.multipleCount': '{count} محدد',
      },
      { ...TRANSLATION_BASE_EN },
    ).t;

    expect(formatLocalizedSelectValue(['Alpha', 'Beta'], t)).toBe('Alpha and Beta');
    expect(formatLocalizedSelectValue(['مرفوضات الكول سنتر', 'رفض المحلي'], arabic)).toBe(
      'مرفوضات الكول سنتر و رفض المحلي',
    );
  });

  it('uses a count label when more than two values are selected', () => {
    expect(formatLocalizedSelectValue(['A', 'B', 'C'], t)).toBe('3 selected');
  });
});

describe('resolveNativeOptionLabel', () => {
  it('flattens composite React option labels instead of falling back to the value id', () => {
    expect(resolveNativeOptionLabel(['default-db', ' (default)'], 'ds_default_local')).toBe(
      'default-db (default)',
    );
  });
});
