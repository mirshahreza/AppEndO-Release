import { describe, expect, it } from 'vitest';
import {
  buildSharedWorkbookPath,
  buildWorkbookEditRelativePath,
  buildWorkbooksListRelativePath,
  parseWorkbookEditSlug,
  parseWorkbookEditSlugFromPathname,
  resolveWorkbookIdFromEditSlug,
  resolveWorkbooksRouteSuffix,
} from '../workbookRoute';

describe('workbookRoute', () => {
  it('parses editor suffixes only from workbooks/edit', () => {
    expect(resolveWorkbooksRouteSuffix('studio/workbooks')).toBeUndefined();
    expect(resolveWorkbooksRouteSuffix('studio/workbooks/wb-1')).toBeUndefined();
    expect(resolveWorkbooksRouteSuffix('studio/workbooks/edit')).toBeUndefined();
    expect(resolveWorkbooksRouteSuffix('studio/workbooks/edit/wb-1')).toBe('wb-1');
    expect(resolveWorkbooksRouteSuffix('us/studio/workbooks/edit/wb-1')).toBe('wb-1');
    expect(resolveWorkbooksRouteSuffix('edit/wb-1')).toBe('wb-1');
  });

  it('parses edit slugs from path suffixes and pathnames', () => {
    expect(parseWorkbookEditSlug('studio/workbooks/edit/wb-1')).toBe('wb-1');
    expect(parseWorkbookEditSlug('studio/workbooks/wb-1')).toBeNull();
    expect(parseWorkbookEditSlug(undefined)).toBeNull();
    expect(parseWorkbookEditSlugFromPathname('/us/studio/workbooks/edit/wb-1')).toBe('wb-1');
    expect(parseWorkbookEditSlugFromPathname('/studio/workbooks')).toBeNull();
    expect(parseWorkbookEditSlug('studio/my-workbooks/edit/wb-1', 'my-workbooks')).toBe('wb-1');
    expect(parseWorkbookEditSlugFromPathname('/studio/my-workbooks/edit/wb-1', 'my-workbooks')).toBe('wb-1');
    expect(buildSharedWorkbookPath('wb-1')).toBe('/shared/workbooks/wb-1');
  });

  it('builds bookmarkable relative paths', () => {
    expect(buildWorkbooksListRelativePath()).toBe('workbooks');
    expect(buildWorkbookEditRelativePath('wb-1')).toBe('workbooks/edit/wb-1');
    expect(buildWorkbooksListRelativePath('studio', 'my-workbooks')).toBe('my-workbooks');
    expect(buildWorkbookEditRelativePath('wb-1', 'studio', 'my-workbooks')).toBe('my-workbooks/edit/wb-1');
  });

  it('includes the studio portal segment for culture mounts', () => {
    expect(buildWorkbooksListRelativePath('us')).toBe('studio/workbooks');
    expect(buildWorkbookEditRelativePath('wb-1', 'us')).toBe('studio/workbooks/edit/wb-1');
  });

  it('decodes the workbook id from the edit slug', () => {
    expect(resolveWorkbookIdFromEditSlug('wb-1')).toBe('wb-1');
    expect(resolveWorkbookIdFromEditSlug(encodeURIComponent('wb 1'))).toBe('wb 1');
  });
});
