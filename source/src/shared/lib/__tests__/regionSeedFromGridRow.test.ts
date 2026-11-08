import { describe, expect, it } from 'vitest';
import { mapGridRowToRegionSeedRecord } from '../regionSeedFromGridRow';

describe('mapGridRowToRegionSeedRecord', () => {
  it('passes Hawiety institute list rows through without base-info remapping', () => {
    const row = {
      id: 100,
      code: 'alforat',
      titleAr: 'معهد الفرات',
      isActive: true,
      allowsInvite: false,
    };

    expect(mapGridRowToRegionSeedRecord(row)).toEqual(row);
  });

  it('still normalizes base-info vocab list rows', () => {
    const mapped = mapGridRowToRegionSeedRecord({
      parent_id: 1,
      title: 'Category',
      short_name: 'Cat',
      is_active: false,
    });

    expect(mapped).toMatchObject({
      parentId: '1',
      title: 'Category',
      shortName: 'Cat',
      isActive: false,
    });
  });
});
