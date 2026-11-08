import { PUBLIC_SITE_PACKAGE_ID } from '../../shared/api/contracts/platform/mountConstants';
import {
  CMS_SITE_BRAND_SLOT,
  CMS_SITE_CTA_SLOT,
  CMS_SITE_FOOTER_SLOT,
  CMS_SITE_NAV_SLOT,
} from '../../shared/lib/cmsSiteSlots';

export const CMS_PUBLIC_SITE_HOME_PAGE_KEY = 'cms-site-home';
export const CMS_PUBLIC_SITE_ARTICLE_PAGE_KEY = 'cms-site-article';

export const CMS_PUBLIC_SITE_PAGE_KEYS = [
  CMS_PUBLIC_SITE_HOME_PAGE_KEY,
  CMS_PUBLIC_SITE_ARTICLE_PAGE_KEY,
] as const;

export const CMS_PUBLIC_SITE_CHROME_COMPONENT_KEYS = [
  'cms-site-brand',
  'cms-site-nav',
  'cms-site-cta',
  'cms-site-footer',
] as const;

const CMS_PUBLIC_SITE_UI_KEYS = new Set<string>([
  ...CMS_PUBLIC_SITE_PAGE_KEYS,
  ...CMS_PUBLIC_SITE_CHROME_COMPONENT_KEYS,
]);

export function isCmsPublicSitePageKey(pageKey: string): boolean {
  return (CMS_PUBLIC_SITE_PAGE_KEYS as readonly string[]).includes(pageKey);
}

/** Anonymous GET /api/packages/cms/ui/:key — public home/article + chrome. */
export function isAnonymousCmsPublicSiteUiModule(packageId: string, componentKey: string): boolean {
  return packageId.trim().toLowerCase() === PUBLIC_SITE_PACKAGE_ID
    && CMS_PUBLIC_SITE_UI_KEYS.has(componentKey.trim().toLowerCase());
}

const PACKAGE_UI_MODULE_API_PATH = /^\/packages\/([^/]+)\/ui\/([^/]+)\/?$/;

/** Auth-bypass matcher for GET /api/packages/cms/ui/{public-site-key}. */
export function isAnonymousCmsPublicSiteUiApiPath(apiRelativePath: string): boolean {
  const match = PACKAGE_UI_MODULE_API_PATH.exec(apiRelativePath.trim());
  if (!match) return false;
  return isAnonymousCmsPublicSiteUiModule(
    decodeURIComponent(match[1]),
    decodeURIComponent(match[2]),
  );
}

export function buildCmsPublicSiteUiRoutes(): Array<{
  pageKey: string;
  entry: string;
  suggestedRoutePattern?: string;
  suggestedMountId?: string;
}> {
  return [
    {
      pageKey: CMS_PUBLIC_SITE_HOME_PAGE_KEY,
      entry: 'ui/cms-site-home.tsx',
    },
    {
      pageKey: CMS_PUBLIC_SITE_ARTICLE_PAGE_KEY,
      entry: 'ui/cms-site-article.tsx',
    },
  ];
}

export function buildCmsPublicSiteUiComponents(): Array<{
  componentKey: string;
  slotId: string;
  entry: string;
  order: number;
}> {
  return [
    { componentKey: 'cms-site-brand', slotId: CMS_SITE_BRAND_SLOT, entry: 'ui/cms-site-brand.tsx', order: 10 },
    { componentKey: 'cms-site-nav', slotId: CMS_SITE_NAV_SLOT, entry: 'ui/cms-site-nav.tsx', order: 11 },
    { componentKey: 'cms-site-cta', slotId: CMS_SITE_CTA_SLOT, entry: 'ui/cms-site-cta.tsx', order: 12 },
    { componentKey: 'cms-site-footer', slotId: CMS_SITE_FOOTER_SLOT, entry: 'ui/cms-site-footer.tsx', order: 13 },
  ];
}

export function buildCmsPublicSiteUiFiles(): Array<{ entry: string; source: string }> {
  return [
    {
      entry: 'ui/cms-site-home.tsx',
      source: "export { CmsSiteHomePage as default } from '@/features/cms-site/CmsSiteHomePage';\n",
    },
    {
      entry: 'ui/cms-site-article.tsx',
      source: "export { CmsSiteArticlePage as default } from '@/features/cms-site/CmsSiteArticlePage';\n",
    },
    {
      entry: 'ui/cms-site-brand.tsx',
      source: "export { CmsSiteBrandSlot as default } from '@/features/cms-site/components/CmsSiteBrandSlot';\n",
    },
    {
      entry: 'ui/cms-site-nav.tsx',
      source: "export { CmsSiteNavSlot as default } from '@/features/cms-site/components/CmsSiteNavSlot';\n",
    },
    {
      entry: 'ui/cms-site-cta.tsx',
      source: "export { CmsSiteCtaSlot as default } from '@/features/cms-site/components/CmsSiteCtaSlot';\n",
    },
    {
      entry: 'ui/cms-site-footer.tsx',
      source: "export { CmsSiteFooterSlot as default } from '@/features/cms-site/components/CmsSiteFooterSlot';\n",
    },
  ];
}

export function mergeCmsPublicSiteCapabilities(capabilities: {
  ui_routes?: Array<Record<string, unknown>>;
  ui_components?: Array<Record<string, unknown>>;
}): {
  ui_routes: Array<Record<string, unknown>>;
  ui_components: Array<Record<string, unknown>>;
} {
  const routes = [...(capabilities.ui_routes ?? [])];
  const components = [...(capabilities.ui_components ?? [])];
  const routeKeys = new Set(routes.map((route) => String(route.pageKey ?? '')));
  const componentKeys = new Set(components.map((item) => String(item.componentKey ?? '')));

  for (const route of buildCmsPublicSiteUiRoutes()) {
    if (!routeKeys.has(route.pageKey)) {
      routes.push(route);
    }
  }
  for (const component of buildCmsPublicSiteUiComponents()) {
    if (!componentKeys.has(component.componentKey)) {
      components.push(component);
    }
  }

  return { ui_routes: routes, ui_components: components };
}
