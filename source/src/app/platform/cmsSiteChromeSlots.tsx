import * as React from 'react';
import {
  CMS_SITE_BRAND_SLOT,
  CMS_SITE_CTA_SLOT,
  CMS_SITE_FOOTER_SLOT,
  CMS_SITE_NAV_SLOT,
} from '../../shared/lib/cmsSiteSlots';
import { PUBLIC_SITE_PACKAGE_ID } from '../../shared/api/contracts/platform/mountConstants';
import { buildPackagePageLoaderRef } from '../../shared/api/contracts/package-manifest/verticalApp';
import { PackagePageModule } from './PackagePageModule';

export const cmsSiteChromeSlots: Record<string, React.ReactNode> = {
  [CMS_SITE_BRAND_SLOT]: (
    <PackagePageModule fallback="silent" loaderRef={buildPackagePageLoaderRef(PUBLIC_SITE_PACKAGE_ID, 'cms-site-brand')} />
  ),
  [CMS_SITE_NAV_SLOT]: (
    <PackagePageModule fallback="silent" loaderRef={buildPackagePageLoaderRef(PUBLIC_SITE_PACKAGE_ID, 'cms-site-nav')} />
  ),
  [CMS_SITE_CTA_SLOT]: (
    <PackagePageModule fallback="silent" loaderRef={buildPackagePageLoaderRef(PUBLIC_SITE_PACKAGE_ID, 'cms-site-cta')} />
  ),
  [CMS_SITE_FOOTER_SLOT]: (
    <PackagePageModule fallback="silent" loaderRef={buildPackagePageLoaderRef(PUBLIC_SITE_PACKAGE_ID, 'cms-site-footer')} />
  ),
};
