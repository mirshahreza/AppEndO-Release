import { describe, expect, it } from 'vitest';
import {
  crudSetAllowedCellKindsForColumn,
  crudSetAllowedTransformsForColumn,
  crudSetCoerceColumnDisplay,
  crudSetColumnAfterCellKindChange,
  inferCrudSetFieldProfile,
} from '../crudSetColumnDisplayPolicy';
import type { CrudSetGridColumn } from '../crudSetSpec';

describe('crudSetColumnDisplayPolicy', () => {
  it('infers url profile from field name and format', () => {
    expect(inferCrudSetFieldProfile('website')).toBe('url');
    expect(inferCrudSetFieldProfile('homepage_url', { type: 'string', format: 'uri' })).toBe('url');
    expect(inferCrudSetFieldProfile('email', { type: 'string', format: 'email' })).toBe('email');
  });

  it('limits display kinds for url fields to link and text', () => {
    const column: CrudSetGridColumn = { field: 'website', label: 'Website' };
    expect(crudSetAllowedCellKindsForColumn(column)).toEqual(['link', 'text']);
  });

  it('offers link transforms for link display', () => {
    const column: CrudSetGridColumn = { field: 'website', label: 'Website', cellKind: 'link' };
    const transforms = crudSetAllowedTransformsForColumn(column);
    expect(transforms).toContain('link-domain');
    expect(transforms).toContain('link-go-to');
    expect(transforms).toContain('link-custom-label');
    expect(transforms).not.toContain('uppercase');
  });

  it('coerces invalid display and transform when field profile changes', () => {
    const column: CrudSetGridColumn = {
      field: 'website',
      label: 'Website',
      cellKind: 'chips',
      transform: 'chips-count',
    };
    const next = crudSetCoerceColumnDisplay(column);
    expect(next.cellKind).toBe('link');
    expect(next.transform).toBe('link-domain');
  });

  it('defaults link transform when switching display to link', () => {
    const column: CrudSetGridColumn = { field: 'website', label: 'Website', cellKind: 'text' };
    const next = crudSetColumnAfterCellKindChange(column, 'link');
    expect(next.cellKind).toBe('link');
    expect(next.transform).toBe('link-domain');
  });
});
