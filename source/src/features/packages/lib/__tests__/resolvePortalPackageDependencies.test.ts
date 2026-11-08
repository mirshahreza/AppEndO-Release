import { describe, expect, it } from 'vitest';
import type { ExperienceManifestPortal } from '../../../../shared/api/contracts/platform/experienceManifest';
import type { NavigationManifestSummary } from '../../../../shared/api/contracts/platform/navigation';
import {
  extractDesignerAssetPaths,
  resolvePortalApisForPackage,
  resolvePortalDerivedComponentsForPackage,
  resolveNavigationsForPortals,
  resolvePortalPackageDependencies,
} from '../resolvePortalPackageDependencies';

const samplePortal = (overrides: Partial<ExperienceManifestPortal> = {}): ExperienceManifestPortal => ({
  segment: 'commerce',
  name: 'Commerce',
  shellKey: 'commerce-layout',
  enabled: true,
  pages: [],
  navigationRef: 'commerce',
  ...overrides,
});

const sampleNavigation = (
  id: string,
  portalSegment?: string,
): NavigationManifestSummary => ({
  id,
  portalSegment,
  groups: [{
    heading: 'Main',
    items: [{
      label: 'Dashboard',
      pageKey: 'dashboard',
      icon: 'LayoutDashboard',
    }],
  }],
  builtIn: false,
  groupCount: 1,
  itemCount: 1,
});

describe('resolveNavigationsForPortals', () => {
  it('collects navigation manifests owned by selected portals', () => {
    const portals = [samplePortal()];
    const navigations = [
      sampleNavigation('commerce', 'commerce'),
      sampleNavigation('other', 'other'),
    ];

    expect(resolveNavigationsForPortals(portals, navigations).map((item) => item.id)).toEqual(['commerce']);
  });

  it('skips redirect portals', () => {
    const portals = [samplePortal({
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
    })];
    const navigations = [sampleNavigation('commerce', 'commerce')];

    expect(resolveNavigationsForPortals(portals, navigations)).toEqual([]);
  });
});

describe('resolvePortalPackageDependencies', () => {
  it('returns navigation items, layout, and asset files for a portal', () => {
    const portals = [samplePortal()];
    const navigations = [sampleNavigation('commerce', 'commerce')];
    const uiComponents = [{
      id: 'layout-1',
      componentKey: 'portal-layouts/commerce-layout',
      label: 'portal-layouts/commerce-layout',
      exportBundle: {
        entry: 'ui/portal-layouts/commerce-layout.tsx',
        code: '<img src="/assets/workspace/commerce-logo.png" />',
      },
    }];

    const result = resolvePortalPackageDependencies(portals, navigations, uiComponents);

    expect(result.navigations).toHaveLength(1);
    expect(result.navigationItems).toEqual([expect.objectContaining({
      manifestId: 'commerce',
      label: 'Dashboard',
      pageKey: 'dashboard',
    })]);
    expect(result.layouts).toEqual([expect.objectContaining({
      portalSegment: 'commerce',
      componentKey: 'portal-layouts/commerce-layout',
      builtIn: false,
    })]);
    expect(result.files).toEqual([{
      path: '/assets/workspace/commerce-logo.png',
      source: 'portal-layouts/commerce-layout',
    }]);
  });
});

describe('resolvePortalDerivedCapabilities', () => {
  it('matches navigation page keys to catalog components and apis in component code', () => {
    const uiComponents = [{
      id: 'page-1',
      componentKey: 'sales/dashboard',
      label: 'sales/dashboard',
      exportBundle: {
        entry: 'ui/sales/dashboard.tsx',
        code: 'fetch("/api/custom/sales/list")',
      },
    }];

    const navigations = [sampleNavigation('commerce', 'commerce')];
    navigations[0]!.groups[0]!.items[0]!.pageKey = 'sales/dashboard';

    const portals = [samplePortal()];
    const derivedComponents = resolvePortalDerivedComponentsForPackage(portals, navigations, uiComponents);
    expect(derivedComponents.map((item) => item.componentKey)).toContain('sales/dashboard');

    const apis = resolvePortalApisForPackage(derivedComponents, [{
      id: 'api-1',
      name: 'Sales list',
      folder: 'custom',
      method: 'GET' as const,
      path: '/api/custom/sales/list',
      source: 'managed' as const,
    }]);
    expect(apis).toHaveLength(1);
  });

  it('starts closure from a manually selected page seed including reusable refs and assets', () => {
    const assetUrl = '/assets/workspace/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.png';
    const page = {
      id: 'page-1',
      componentKey: 'crm/contacts',
      label: 'crm/contacts',
      exportBundle: {
        entry: 'ui/crm/contacts.tsx',
        code: 'export default function Contacts() { return null; }',
        draftJson: JSON.stringify({
          document: {
            nodes: {
              card: { componentRef: { refType: 'reusable', refId: 'crm/contact-card' } },
            },
          },
        }),
      },
    };
    const reusable = {
      id: 'card-1',
      componentKey: 'crm/contact-card',
      label: 'crm/contact-card',
      exportBundle: {
        entry: 'ui/crm/contact-card.tsx',
        code: `<img src="${assetUrl}" />`,
      },
    };

    const derived = resolvePortalDerivedComponentsForPackage(
      [],
      [],
      [page, reusable],
      [],
      { seedComponents: [page] },
    );
    expect(derived.map((item) => item.componentKey)).toEqual(
      expect.arrayContaining(['crm/contacts', 'crm/contact-card']),
    );

    const files = resolvePortalPackageDependencies(
      [],
      [],
      [page, reusable],
      [],
      { seedComponents: [page], assetScanComponents: derived },
    ).files;
    expect(files.map((file) => file.path)).toContain(assetUrl);
  });

  it('derives navigation pages from a shell-only selection', () => {
    const shell = {
      shellKey: 'site-shell',
      title: 'Site Shell',
      entry: 'designer/portal-layouts/site-shell.json',
      draftJson: JSON.stringify({
        document: {
          metadata: {
            shellDesigner: {
              recipe: {
                navigation: { primaryNavigationRef: 'site-main' },
              },
            },
          },
        },
      }),
    };
    const uiComponents = [{
      id: 'home-1',
      componentKey: 'home-landing',
      label: 'home-landing',
      exportBundle: {
        entry: 'ui/home-landing.tsx',
        code: 'export default function Home() { return null; }',
      },
    }];
    const navigations = [sampleNavigation('site-main')];
    navigations[0]!.groups[0]!.items[0]!.pageKey = 'home-landing';

    const derived = resolvePortalDerivedComponentsForPackage(
      [],
      navigations,
      uiComponents,
      [],
      { additionalShells: [shell] },
    );
    expect(derived.map((item) => item.componentKey)).toContain('home-landing');
  });
});

describe('extractDesignerAssetPaths', () => {
  it('ignores placeholders and data urls', () => {
    expect(extractDesignerAssetPaths('src="/placeholder.svg" data:image/png;base64,abc')).toEqual([]);
  });
});
