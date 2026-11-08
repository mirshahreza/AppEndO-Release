import { describe, expect, it } from 'vitest';
import {
  formatHwyElectoralPathUpToGeoLevel,
  formatHwyGeoElectoralPathForDisplay,
  formatHwyGeoResponsibilityNodeColumnDisplay,
  resolveHwyElectoralDivisionCellDisplay,
  resolveHwyElectoralProvinceTitle,
  splitHwyElectoralDivisionPath,
  splitHwyElectoralGeoPathFieldParts,
  splitHwyMemberAreaColumnDisplay,
  splitHwyNewlineCellLines,
  splitHwyGeoPathDisplaySegments,
  splitHwyResidenceSummaryLines,
} from '../hwyMemberDirectoryPathDisplay';

describe('splitHwyGeoPathDisplaySegments', () => {
  it('splits mixed pipe and slash electoral paths into separate segments', () => {
    expect(
      splitHwyGeoPathDisplaySegments(
        'بغداد | الرصافة | دائرة الزعفرانية / 2 / اليرموك / روضة النشئ الجديد',
      ),
    ).toEqual([
      'بغداد',
      'الرصافة',
      'دائرة الزعفرانية',
      '2',
      'اليرموك',
      'روضة النشئ الجديد',
    ]);
  });
});

describe('splitHwyElectoralDivisionPath', () => {
  it('collapses grid lines 2–3 for dossier two-line helper', () => {
    expect(
      splitHwyElectoralDivisionPath('Iraq | Baghdad | Karkh | Area 12'),
    ).toEqual({
      line1: 'Baghdad | Karkh',
      line2: 'Area 12',
    });
  });

  it('collapses five breadcrumb levels for dossier (line1 province|ghavateh, line2 rest)', () => {
    expect(
      splitHwyElectoralDivisionPath('Iraq | L1 | L2 | L3 | L4 | L5'),
    ).toEqual({
      line1: 'L1 | L2',
      line2: 'L3 | L4 | L5',
    });
  });
});

describe('resolveHwyElectoralProvinceTitle', () => {
  it('returns the first segment after Iraq', () => {
    expect(resolveHwyElectoralProvinceTitle('Iraq | Baghdad | Karkh | Area 12')).toBe('Baghdad');
  });

  it('returns empty when path is missing', () => {
    expect(resolveHwyElectoralProvinceTitle('')).toBe('');
  });
});

describe('resolveHwyElectoralDivisionCellDisplay', () => {
  it('uses electoral path when present', () => {
    expect(
      resolveHwyElectoralDivisionCellDisplay(
        { electoralDivisionPath: 'Iraq | Baghdad | Karkh | Area 12', addrProvinceTitle: 'Basra' },
      ),
    ).toEqual({ kind: 'electoral', value: 'Baghdad | Karkh | Area 12' });
  });

  it('falls back to province title when electoral path is empty', () => {
    expect(
      resolveHwyElectoralDivisionCellDisplay(
        { electoralDivisionPath: '', addrProvinceTitle: 'Basra' },
      ),
    ).toEqual({ kind: 'province', value: 'Basra' });
  });

  it('normalizes electoral center paths through region at render time', () => {
    const display = resolveHwyElectoralDivisionCellDisplay({
      electoralDivisionPath: 'بغداد | الرصافة | دائرة الشعب | عدن | مدرسة میثم التمار',
    });
    expect(display).toEqual({
      kind: 'electoral',
      value: 'بغداد | الرصافة | دائرة الشعب | عدن | مدرسة میثم التمار',
    });
  });
});

describe('splitHwyElectoralGeoPathFieldParts', () => {
  it('splits province through region and peels maktab from a five-level path', () => {
    expect(
      splitHwyElectoralGeoPathFieldParts(
        'بغداد | الرصافة | دائرة الشعب | عدن | مدرسة میثم التمار',
      ),
    ).toEqual({
      province: 'بغداد',
      district: 'الرصافة',
      circle: 'دائرة الشعب',
      region: 'عدن',
      maktabFromPath: 'مدرسة میثم التمار',
    });
  });

  it('maps four levels without a trailing maktab segment', () => {
    expect(splitHwyElectoralGeoPathFieldParts('A | B | C | D')).toEqual({
      province: 'A',
      district: 'B',
      circle: 'C',
      region: 'D',
      maktabFromPath: '',
    });
  });

  it('peels maktab from four segments when ghavateh is omitted', () => {
    expect(
      splitHwyElectoralGeoPathFieldParts(
        'صلاح الدين | دائرة بلد | طوز المركز2 | مدرسة حسان بن ثابت',
      ),
    ).toEqual({
      province: 'صلاح الدين',
      district: '',
      circle: 'دائرة بلد',
      region: 'طوز المركز2',
      maktabFromPath: 'مدرسة حسان بن ثابت',
    });
  });
});

describe('splitHwyMemberAreaColumnDisplay', () => {
  it('joins province through circle on line 1 and the rest on line 2', () => {
    expect(splitHwyMemberAreaColumnDisplay('Iraq | L1 | L2 | L3 | L4 | L5')).toEqual({
      line1: 'L1 | L2 | L3',
      line2: 'L4 | L5',
    });
  });

  it('puts up to three levels on line 1 when the path is shorter', () => {
    expect(splitHwyMemberAreaColumnDisplay('Iraq | Baghdad | Karkh | Quarter 5')).toEqual({
      line1: 'Baghdad | Karkh | Quarter 5',
      line2: '',
    });
  });
});

describe('splitHwyNewlineCellLines', () => {
  it('splits trimmed non-empty lines', () => {
    expect(splitHwyNewlineCellLines('Alpha\nBeta\n\n Gamma ')).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

describe('splitHwyResidenceSummaryLines', () => {
  it('drops Iraq and returns one segment per line', () => {
    expect(
      splitHwyResidenceSummaryLines('Iraq | Baghdad | Karkh | Quarter 5'),
    ).toEqual(['Baghdad', 'Karkh', 'Quarter 5']);
  });

  it('returns two lines when only two levels remain after Iraq', () => {
    expect(splitHwyResidenceSummaryLines('Iraq | Nineveh | Mosul')).toEqual([
      'Nineveh',
      'Mosul',
    ]);
  });

  it('returns a single line for one level after Iraq', () => {
    expect(splitHwyResidenceSummaryLines('Iraq | Basra')).toEqual(['Basra']);
  });

  it('returns one line per segment when Iraq is omitted', () => {
    expect(splitHwyResidenceSummaryLines('A | B | C | D')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('drops Base Info roots and Iraq before province levels', () => {
    expect(
      splitHwyResidenceSummaryLines('الأساس | التقسيمات الجغرافية | العراق | بغداد | الرصافة'),
    ).toEqual(['بغداد', 'الرصافة']);
  });

  it('drops Base Info roots when the country segment is missing', () => {
    expect(splitHwyResidenceSummaryLines('الأساس | التقسيمات الجغرافية | بغداد')).toEqual(['بغداد']);
  });
});

describe('formatHwyGeoElectoralPathForDisplay', () => {
  it('maps circle-first paths without a ghavateh rung (Musayyib parity)', () => {
    const raw = 'بـــابـــل | دائرة المسيب | المسيب | 1 | مدرسة الثوره الابتدائية';
    expect(formatHwyGeoElectoralPathForDisplay(raw)).toBe(
      'بـــابـــل | دائرة المسيب | المسيب / 1 | مدرسة الثوره الابتدائية',
    );
    expect(formatHwyGeoElectoralPathForDisplay(raw, 'maktab')).toBe(
      'بـــابـــل | دائرة المسيب | المسيب / 1',
    );
  });
});

describe('formatHwyElectoralPathUpToGeoLevel', () => {
  it('stops at maktab for office-level nominations', () => {
    expect(
      formatHwyElectoralPathUpToGeoLevel(
        'بغداد | الرصافة | دائرة المدائن | مكتب المدائن | مدرسة X',
        'maktab',
      ),
    ).toBe('بغداد | الرصافة | دائرة المدائن | مكتب المدائن');
  });

  it('keeps region depth for region-level nominations', () => {
    expect(
      formatHwyElectoralPathUpToGeoLevel(
        'بغداد | الرصافة | دائرة الشعب | عدن | مدرسة میثم التمار',
        'region',
      ),
    ).toBe('بغداد | الرصافة | دائرة الشعب | عدن | مدرسة میثم التمار');
  });
});

describe('formatHwyGeoResponsibilityNodeColumnDisplay', () => {
  it('bold line is the leaf at the active level; context is ancestors', () => {
    expect(
      formatHwyGeoResponsibilityNodeColumnDisplay(
        'الأساس | العراق | بغداد | الكاظمية | السلام',
        'السلام',
      ),
    ).toEqual({
      line1: 'السلام',
      line2: 'بغداد | الكاظمية',
    });
  });

  it('returns only the province line when listing provinces', () => {
    expect(formatHwyGeoResponsibilityNodeColumnDisplay('الأساس | العراق | بغداد', 'بغداد')).toEqual({
      line1: 'بغداد',
      line2: '',
    });
  });
});
