import { describe, expect, it } from 'vitest';
import {
  HWY_ELECTORAL_BREADCRUMB_GEO_LEVELS,
  splitHwyElectoralBreadcrumbGridColumnLines,
  splitHwyElectoralBreadcrumbParts,
} from '../hwyElectoralBreadcrumbStandard';

describe('splitHwyElectoralBreadcrumbParts', () => {
  it('maps province → ghavateh → circle → maktab → region', () => {
    expect(
      splitHwyElectoralBreadcrumbParts(
        'بغداد | الرصافة | دائرة الشعب | عدن | مدرسة میثم التمار',
      ),
    ).toEqual({
      province: 'بغداد',
      ghavateh: 'الرصافة',
      circle: 'دائرة الشعب',
      maktab: 'عدن',
      region: 'مدرسة میثم التمار',
    });
  });

  it('omits ghavateh when the member path skips the sector rung', () => {
    expect(
      splitHwyElectoralBreadcrumbParts(
        'صلاح الدين | دائرة بلد | طوز المركز2 | مدرسة حسان بن ثابت',
      ),
    ).toEqual({
      province: 'صلاح الدين',
      ghavateh: '',
      circle: 'دائرة بلد',
      maktab: 'طوز المركز2',
      region: 'مدرسة حسان بن ثابت',
    });
  });
});

describe('splitHwyElectoralBreadcrumbGridColumnLines', () => {
  it('splits grid column into province row, circle row, and region row', () => {
    expect(
      splitHwyElectoralBreadcrumbGridColumnLines(
        'بغداد | الرصافة | دائرة الشعب | عدن | مدرسة میثم التمار',
      ),
    ).toEqual({
      line1: 'بغداد | الرصافة',
      line2: 'دائرة الشعب | عدن',
      line3: 'مدرسة میثم التمار',
    });
  });
});

describe('HWY_ELECTORAL_BREADCRUMB_GEO_LEVELS', () => {
  it('lists geo levels in breadcrumb order', () => {
    expect(HWY_ELECTORAL_BREADCRUMB_GEO_LEVELS.map((row) => row.field)).toEqual([
      'province',
      'ghavateh',
      'circle',
      'maktab',
      'region',
    ]);
  });
});
