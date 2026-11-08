import { describe, expect, it } from 'vitest';
import {
  formatWorkbookCatalogActor,
  formatWorkbookCatalogDate,
} from '../workbookCatalogAudit';

describe('workbook catalog audit fields', () => {
  it('formats dates as YYYY-MM-DD and actors as username only', () => {
    expect(formatWorkbookCatalogDate('2026-08-01T00:00:00.000Z')).toBe('2026-08-01');
    expect(formatWorkbookCatalogDate('')).toBe('—');
    expect(formatWorkbookCatalogActor('admin')).toBe('admin');
    expect(formatWorkbookCatalogActor(null)).toBe('—');
    expect(formatWorkbookCatalogActor('')).toBe('—');
  });
});
