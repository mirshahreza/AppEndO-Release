import { describe, expect, it } from 'vitest';
import { getSqlConsoleResultRecords, sqlConsoleResultExportFilename } from '../sqlConsoleResultExport';

describe('sqlConsoleResultExport', () => {
  it('collects record rows from a query result', () => {
    expect(getSqlConsoleResultRecords(null)).toEqual([]);
    expect(getSqlConsoleResultRecords({
      data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      count: 2,
      truncated: false,
      source: { id: 'ds', name: 'db', type: 'PostgreSQL' },
    })).toEqual([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  });

  it('ignores non-record result payloads', () => {
    expect(getSqlConsoleResultRecords({
      data: [1, 'x'],
      count: 2,
      truncated: false,
      source: { id: 'ds', name: 'db', type: 'PostgreSQL' },
    })).toEqual([]);
  });

  it('sanitizes the download filename from the tab name', () => {
    expect(sqlConsoleResultExportFilename('Orders today')).toBe('Orders today');
    expect(sqlConsoleResultExportFilename('a/b:c')).toBe('a_b_c');
    expect(sqlConsoleResultExportFilename('   ')).toBe('query-results');
  });
});
