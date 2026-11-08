import { describe, expect, it } from 'vitest';

import {
  buildHwyElectoralPathSegmentLevels,
  resolveHwyElectoralPathSegmentGeoLevelFromSegments,
} from '../hwyElectoralPathSegmentLevels';

describe('buildHwyElectoralPathSegmentLevels', () => {
  it('maps four segments with trailing school to responsibility maktab + region', () => {
    const segments = ['صلاح الدين', 'دائرة بلد', 'طوز المركز2', 'مدرسة حسان بن ثابت'];
    expect(buildHwyElectoralPathSegmentLevels(segments)).toEqual([
      'province',
      'circle',
      'maktab',
      'region',
    ]);
  });

  it('maps five display segments with legacy swapped last two API levels', () => {
    const segments = ['بغداد', 'الرصافة', 'دائرة الشعب', 'عدن', 'مدرسة میثم التمار'];
    expect(buildHwyElectoralPathSegmentLevels(segments)).toEqual([
      'province',
      'ghavateh',
      'circle',
      'maktab',
      'region',
    ]);
  });

  it('maps الربيع on a Zaafaraniya path to maktab responsibility level', () => {
    const segments = ['بغداد', 'الرصافة', 'دائرة الزعفرانية', 'الربيع', 'مدرسة شرحبيل بن حسنة'];
    expect(buildHwyElectoralPathSegmentLevels(segments)).toEqual([
      'province',
      'ghavateh',
      'circle',
      'maktab',
      'region',
    ]);
  });
});

describe('resolveHwyElectoralPathSegmentGeoLevelFromSegments', () => {
  it('returns circle for a دائرة segment in a shortened path', () => {
    const segments = ['صلاح الدين', 'دائرة بلد', 'طوز المركز2', 'مدرسة حسان بن ثابت'];
    expect(resolveHwyElectoralPathSegmentGeoLevelFromSegments(segments, 1)).toBe('circle');
  });

  it('returns maktab API level for an electoral region label such as الربيع', () => {
    const segments = ['بغداد', 'الرصافة', 'دائرة الزعفرانية', 'الربيع', 'مدرسة شرحبيل بن حسنة'];
    expect(resolveHwyElectoralPathSegmentGeoLevelFromSegments(segments, 3)).toBe('maktab');
  });
});
