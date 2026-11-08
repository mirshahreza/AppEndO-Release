import { describe, expect, it } from 'vitest';
import {
  buildNestedEditorEditRelativePath,
  NESTED_EDITOR_EDIT_SEGMENT,
  resolveNestedEditorItemSlug,
} from '../nestedEditorDeepLink';

describe('nestedEditorDeepLink', () => {
  it('requires the edit segment before item slugs', () => {
    expect(NESTED_EDITOR_EDIT_SEGMENT).toBe('edit');
    expect(resolveNestedEditorItemSlug([])).toBeUndefined();
    expect(resolveNestedEditorItemSlug(['edit'])).toBeUndefined();
    expect(resolveNestedEditorItemSlug(['order-approval'])).toBeUndefined();
    expect(resolveNestedEditorItemSlug(['edit', 'order-approval'])).toBe('order-approval');
    expect(resolveNestedEditorItemSlug(['edit', 'auth', 'login'])).toBe('auth/login');
  });

  it('builds list/edit/item relative paths', () => {
    expect(buildNestedEditorEditRelativePath('workflows', 'order-approval')).toBe('workflows/edit/order-approval');
    expect(buildNestedEditorEditRelativePath('server-functions', 'auth/login')).toBe('server-functions/edit/auth/login');
    expect(buildNestedEditorEditRelativePath('workbooks', 'wb-1')).toBe('workbooks/edit/wb-1');
  });
});
