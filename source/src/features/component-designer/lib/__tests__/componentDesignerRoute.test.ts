import { describe, expect, it } from 'vitest';
import type { DesignerVersionSummary } from '../../../../shared/api/queries/component-designer';
import {
  buildComponentDesignerEditRelativePath,
  buildComponentDesignerEditSlug,
  buildComponentDesignerListRelativePath,
  buildComponentDesignerNewRelativePath,
  buildLiveDesignerRelativePath,
  CLIENT_COMPONENT_NEW_SLUG,
  parseComponentDesignerEditSlug,
  parseLiveDesignerComponentPath,
  resolveComponentDesignerRouteSuffix,
  resolveDesignerDraftIdFromEditSlug,
} from '../../componentDesignerRoute';

const drafts: DesignerVersionSummary[] = [
  {
    id: 'draft-alpha',
    name: 'alpha',
    folder: 'general',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('componentDesignerRoute', () => {
  it('builds name-only edit slugs', () => {
    expect(buildComponentDesignerEditSlug({ folder: 'general', name: 'test-c' })).toBe('test-c');
  });

  it('strips client-components route prefixes from splat suffixes', () => {
    expect(resolveComponentDesignerRouteSuffix('studio/client-components')).toBeUndefined();
    expect(resolveComponentDesignerRouteSuffix('studio/client-components/general/test-c')).toBe('general/test-c');
    expect(resolveComponentDesignerRouteSuffix('us/studio/client-components/edit/general/test-c')).toBe('edit/general/test-c');
    expect(resolveComponentDesignerRouteSuffix('client-components/edit/new')).toBe(`edit/${CLIENT_COMPONENT_NEW_SLUG}`);
  });

  it('parses canonical edit/{folder}/{name} live designer paths', () => {
    expect(parseLiveDesignerComponentPath('studio/client-components/edit/general/test-c')).toBe('general/test-c');
    expect(parseLiveDesignerComponentPath('edit/general/test-c')).toBe('general/test-c');
    expect(parseLiveDesignerComponentPath('edit/test-c')).toBe('test-c');
    expect(parseLiveDesignerComponentPath('client-components/live-designer/general/test-c')).toBe('general/test-c');
    expect(parseLiveDesignerComponentPath('client-components/edit/new')).toBeNull();
  });

  it('parses legacy classic slugs without edit for redirect', () => {
    expect(parseComponentDesignerEditSlug('studio/client-components/general/test-c')).toBe('general/test-c');
    expect(parseComponentDesignerEditSlug('client-components/edit/new')).toBe(CLIENT_COMPONENT_NEW_SLUG);
    expect(parseComponentDesignerEditSlug('client-components/edit/general/test-c')).toBeNull();
    expect(parseComponentDesignerEditSlug(undefined)).toBeNull();
  });

  it('resolves drafts by folder/name slug', () => {
    expect(resolveDesignerDraftIdFromEditSlug(drafts, 'general/alpha')).toBe('draft-alpha');
    expect(resolveDesignerDraftIdFromEditSlug(drafts, 'alpha')).toBe('draft-alpha');
    expect(resolveDesignerDraftIdFromEditSlug(drafts, CLIENT_COMPONENT_NEW_SLUG)).toBeNull();
    expect(resolveDesignerDraftIdFromEditSlug(drafts, 'missing/route')).toBeNull();
  });

  it('builds bookmarkable relative paths with edit segment', () => {
    expect(buildComponentDesignerListRelativePath()).toBe('client-components');
    expect(buildComponentDesignerEditRelativePath({ folder: 'general', name: 'test-c' }))
      .toBe('client-components/edit/test-c');
    expect(buildLiveDesignerRelativePath({ folder: 'general', name: 'test-c' }))
      .toBe('client-components/edit/test-c');
    expect(buildComponentDesignerNewRelativePath()).toBe('client-components/edit/new');
  });

  it('includes the studio portal segment for culture mounts', () => {
    expect(buildComponentDesignerListRelativePath('us')).toBe('studio/client-components');
    expect(buildComponentDesignerEditRelativePath({ folder: 'general', name: 'test-c' }, 'us'))
      .toBe('studio/client-components/edit/test-c');
    expect(buildComponentDesignerNewRelativePath('us')).toBe('studio/client-components/edit/new');
  });
});
