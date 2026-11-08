import { describe, expect, it } from 'vitest';
import { objectsFromSheet, sheetFromObjects } from '../sheets';

describe('workbook sheets', () => {
  it('round-trips object rows', () => {
    const sheet = sheetFromObjects('Notes', ['id', 'title'], [
      { id: '1', title: 'alpha' },
      { id: '2', title: 'beta' },
    ]);
    expect(objectsFromSheet(sheet)).toEqual([
      { id: '1', title: 'alpha' },
      { id: '2', title: 'beta' },
    ]);
  });
});
