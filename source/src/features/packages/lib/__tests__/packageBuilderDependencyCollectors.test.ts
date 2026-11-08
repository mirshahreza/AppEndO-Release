/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  collectShellRecipeNavigationIds,
  collectWorkspaceAssetUrlsFromShell,
  collectWorkspaceAssetUrlsFromValue,
  extractDesignerAssetPaths,
} from '../packageBuilderDependencyCollectors';
import type { PackageBuilderCatalogShellItem } from '../packageBuilderCatalog';

const shellWithDeps = (overrides: Partial<PackageBuilderCatalogShellItem> = {}): PackageBuilderCatalogShellItem => ({
  shellKey: 'site-shell',
  title: 'Site Shell',
  entry: 'designer/portal-layouts/site-shell.json',
  draftJson: JSON.stringify({
    document: {
      metadata: {
        shellDesigner: {
          owner: 'shell-designer',
          recipe: {
            navigation: {
              primaryNavigationRef: 'site-main',
              side: { navigationRef: 'site-side' },
            },
          },
          starterLanding: { pageKey: 'home-landing', routePath: '/' },
        },
      },
      nodes: {
        a: {
          props: {
            logoUrl: '/assets/workspace/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.png',
          },
        },
      },
    },
  }, null, 2),
  ...overrides,
});

describe('packageBuilderDependencyCollectors', () => {
  it('collects navigation refs from shell recipe metadata', () => {
    expect(collectShellRecipeNavigationIds(shellWithDeps())).toEqual(['site-main', 'site-side']);
  });

  it('collects workspace asset urls from shell draft json', () => {
    expect(collectWorkspaceAssetUrlsFromShell(shellWithDeps())).toEqual([
      '/assets/workspace/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.png',
    ]);
  });

  it('collects platform font urls from designer source', () => {
    expect(extractDesignerAssetPaths('src="/assets/platform/fonts/inter/inter.woff2"')).toEqual([
      '/assets/platform/fonts/inter/inter.woff2',
    ]);
    expect(collectWorkspaceAssetUrlsFromValue(
      { fontUrl: '/assets/platform/fonts/inter/inter.woff2' },
    )).toEqual(new Set(['/assets/platform/fonts/inter/inter.woff2']));
  });
});
