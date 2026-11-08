import { describe, expect, it } from 'vitest';
import {
  TYPE_BODY_CLASS,
  TYPE_CAPTION_CLASS,
  TYPE_EYEBROW_CLASS,
  TYPE_FIELD_LABEL_CLASS,
  TYPE_FIELD_VALUE_CLASS,
  TYPE_IDENTIFIER_CLASS,
  TYPE_MICRO_CLASS,
  TYPE_PAGE_TITLE_CLASS,
  TYPE_SECTION_TITLE_CLASS,
} from '../typographyRoles';

describe('typographyRoles', () => {
  it('keeps the productive studio ramp on named roles', () => {
    expect(TYPE_PAGE_TITLE_CLASS).toBe('text-sm font-bold tracking-tight');
    expect(TYPE_SECTION_TITLE_CLASS).toBe('text-xs font-semibold');
    expect(TYPE_IDENTIFIER_CLASS).toBe('font-mono text-xs font-normal');
    expect(TYPE_BODY_CLASS).toBe('text-sm font-normal');
    expect(TYPE_FIELD_LABEL_CLASS).toBe('text-sm font-normal');
    expect(TYPE_FIELD_VALUE_CLASS).toBe('font-semibold text-slate-900');
    expect(TYPE_EYEBROW_CLASS).toBe('text-xs font-semibold uppercase tracking-wider');
    expect(TYPE_CAPTION_CLASS).toBe('text-[11px] font-normal');
    expect(TYPE_MICRO_CLASS).toBe('text-[10px]');
  });

  it('does not use font-medium', () => {
    const roles = [
      TYPE_PAGE_TITLE_CLASS,
      TYPE_SECTION_TITLE_CLASS,
      TYPE_IDENTIFIER_CLASS,
      TYPE_BODY_CLASS,
      TYPE_FIELD_LABEL_CLASS,
      TYPE_EYEBROW_CLASS,
      TYPE_CAPTION_CLASS,
      TYPE_MICRO_CLASS,
    ];
    for (const role of roles) {
      expect(role).not.toContain('font-medium');
    }
  });
});
