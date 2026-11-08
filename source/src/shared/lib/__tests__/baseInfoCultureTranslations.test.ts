import { describe, expect, it } from 'vitest';
import { resolveBaseInfoLocalizedText } from '../baseInfoCultureTranslations';

describe('resolveBaseInfoLocalizedText', () => {
  it('falls back to iq canonical English title map when bundle key is missing', () => {
    const label = resolveBaseInfoLocalizedText({
      cultureId: 'iq',
      baseInfoId: '220.015',
      field: 'title',
      canonical: 'Nakhebin Join Tasjil State',
      bundle: {},
    });

    expect(label).toBe('حالة انضمام الناخبين للتسجيل');
  });

  it('prefers iq Arabic map when bundle echoes English canonical', () => {
    const label = resolveBaseInfoLocalizedText({
      cultureId: 'iq',
      baseInfoId: '220.999.1',
      field: 'title',
      canonical: 'Local verification complete',
      bundle: { 'base_info.title.220.999.1': 'Local verification complete' },
    });

    expect(label).toBe('اكتمل التوثيق المحلي');
  });
});
