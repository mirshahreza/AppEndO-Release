import { describe, expect, it } from 'vitest';
import {
  buildCmsPublicSiteUiComponents,
  buildCmsPublicSiteUiFiles,
  buildCmsPublicSiteUiRoutes,
  isAnonymousCmsPublicSiteUiApiPath,
  isAnonymousCmsPublicSiteUiModule,
  isCmsPublicSitePageKey,
  mergeCmsPublicSiteCapabilities,
} from '../cmsPublicSitePack';

describe('CMS public site pack recipe', () => {
  it('owns home, article, and chrome entries', () => {
    expect(buildCmsPublicSiteUiRoutes().map((route) => route.pageKey)).toEqual([
      'cms-site-home',
      'cms-site-article',
    ]);
    expect(buildCmsPublicSiteUiComponents().map((item) => item.componentKey)).toEqual([
      'cms-site-brand',
      'cms-site-nav',
      'cms-site-cta',
      'cms-site-footer',
    ]);
    expect(buildCmsPublicSiteUiFiles().map((file) => file.entry)).toEqual(expect.arrayContaining([
      'ui/cms-site-home.tsx',
      'ui/cms-site-brand.tsx',
    ]));
  });

  it('allows anonymous UI modules only for CMS public site keys', () => {
    expect(isAnonymousCmsPublicSiteUiModule('cms', 'cms-site-home')).toBe(true);
    expect(isAnonymousCmsPublicSiteUiModule('cms', 'cms-site-brand')).toBe(true);
    expect(isAnonymousCmsPublicSiteUiModule('cms', 'cms-contents-list')).toBe(false);
    expect(isAnonymousCmsPublicSiteUiModule('remote-hubs', 'file-hub')).toBe(false);
    expect(isCmsPublicSitePageKey('cms-site-article')).toBe(true);
    expect(isAnonymousCmsPublicSiteUiApiPath('/packages/cms/ui/cms-site-home')).toBe(true);
    expect(isAnonymousCmsPublicSiteUiApiPath('/packages/cms/ui/cms-site-brand')).toBe(true);
    expect(isAnonymousCmsPublicSiteUiApiPath('/packages/cms/ui/cms-contents-list')).toBe(false);
    expect(isAnonymousCmsPublicSiteUiApiPath('/packages/remote-hubs/ui/file-hub')).toBe(false);
  });

  it('merges public site capabilities without duplicating pageKeys', () => {
    const merged = mergeCmsPublicSiteCapabilities({
      ui_routes: [{ pageKey: 'cms-contents-list', entry: 'ui/cms/cms-contents-list.tsx' }],
      ui_components: [{ componentKey: 'cms-contents-list', slotId: 'core.dashboard.widgets', entry: 'ui/cms/cms-contents-list.tsx' }],
    });
    expect(merged.ui_routes.map((route) => route.pageKey)).toEqual([
      'cms-contents-list',
      'cms-site-home',
      'cms-site-article',
    ]);
    expect(merged.ui_components.map((item) => item.componentKey)).toContain('cms-site-brand');
  });
});
