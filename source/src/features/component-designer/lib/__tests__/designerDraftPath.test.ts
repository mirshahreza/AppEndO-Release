import { describe, expect, it } from 'vitest';
import type { DesignerVersionSummary } from '../../../../shared/api/queries/component-designer';
import {
  buildComponentDesignerDraftUrl,
  buildComponentDesignerNewUrl,
  buildDesignerComponentPath,
  buildDesignerHandoffUrl,
  isDesignerNewDraftSearchParam,
  parseDesignerComponentPath,
  resolveDesignerComponentLoaderRef,
  resolveDesignerDraftIdFromComponentPath,
  resolveExperienceManifestPageKey,
  resolveStudioMountPathPrefix,
} from '../designerDraftPath';

const drafts: DesignerVersionSummary[] = [
  {
    id: 'draft-alpha',
    name: 'alpha',
    folder: 'general',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'draft-beta',
    name: 'alpha',
    folder: 'archive',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('designerDraftPath', () => {
  it('builds and parses user-facing component paths', () => {
    expect(buildDesignerComponentPath('general', 'test-c')).toBe('general/test-c');
    expect(parseDesignerComponentPath('general/test-c')).toEqual({
      folder: 'general',
      componentName: 'test-c',
    });
    expect(parseDesignerComponentPath('test-c')).toBeNull();
  });

  it('maps designer identity to experience pageKey and loaderRef', () => {
    expect(resolveExperienceManifestPageKey('general/my-page')).toBe('my-page');
    expect(resolveExperienceManifestPageKey('dashboard')).toBe('dashboard');
    expect(resolveDesignerComponentLoaderRef('general/my-page')).toBe('general/my-page');
    expect(resolveDesignerComponentLoaderRef('dashboard')).toBeNull();
  });

  it('resolves drafts by folder and component name', () => {
    expect(resolveDesignerDraftIdFromComponentPath(drafts, 'general/alpha')).toBe('draft-alpha');
    expect(resolveDesignerDraftIdFromComponentPath(drafts, 'archive/alpha')).toBe('draft-beta');
    expect(resolveDesignerDraftIdFromComponentPath(drafts, 'missing/alpha')).toBe('draft-alpha');
    expect(resolveDesignerDraftIdFromComponentPath(drafts, 'alpha')).toBe('draft-alpha');
  });

  it('builds component designer URLs with path segments', () => {
    expect(buildComponentDesignerDraftUrl('/studio', 'general', 'test-c'))
      .toBe('/studio/client-components/edit/test-c');
  });

  it('builds new-draft catalog URL', () => {
    expect(buildComponentDesignerNewUrl('/studio')).toBe('/studio/client-components/edit/new');
    expect(isDesignerNewDraftSearchParam('1')).toBe(true);
    expect(isDesignerNewDraftSearchParam(null)).toBe(false);
  });

  it('builds designer deep links with studio mount prefix', () => {
    expect(resolveStudioMountPathPrefix('/us/studio/server-functions/math/sum-two-numbers')).toBe('/us/studio');
    expect(resolveStudioMountPathPrefix('/studio/client-components')).toBe('/studio');
    expect(buildDesignerHandoffUrl('/us/studio', {
      layoutId: 'math-sum-two-numbers-ui',
      name: 'sum-two-numbers calculator',
      componentPath: 'math/sum-two-numbers-calculator',
    })).toBe('/us/studio/client-components/edit/sum-two-numbers-calculator');
  });
});

