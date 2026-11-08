import { describe, expect, it } from 'vitest';
import {
  assertDatasheetLimit,
  clampDatasheetPage,
  clampDatasheetPageSize,
  datasheetWindowMeta,
  DATASHEET_WINDOW_MAX_PAGE_SIZE,
} from '../datasheetWindow';

describe('datasheet window', () => {
  it('clamps page size to 50, 100, or 200', () => {
    expect(clampDatasheetPageSize(1)).toBe(50);
    expect(clampDatasheetPageSize(50)).toBe(50);
    expect(clampDatasheetPageSize(80)).toBe(100);
    expect(clampDatasheetPageSize(100)).toBe(100);
    expect(clampDatasheetPageSize(999)).toBe(200);
  });

  it('rejects a limit above the hard max', () => {
    expect(() => assertDatasheetLimit(DATASHEET_WINDOW_MAX_PAGE_SIZE + 1)).toThrow(/more than 200/);
  });

  it('never reports a range larger than the page size', () => {
    const meta = datasheetWindowMeta(2, 200, 12_430);
    expect(meta.pageSize).toBe(200);
    expect(meta.from).toBe(201);
    expect(meta.to).toBe(400);
    expect(meta.to - meta.from + 1).toBeLessThanOrEqual(200);
  });

  it('clamps page into the available range', () => {
    expect(clampDatasheetPage(99, 3)).toBe(3);
    expect(clampDatasheetPage(0, 3)).toBe(1);
  });
});
