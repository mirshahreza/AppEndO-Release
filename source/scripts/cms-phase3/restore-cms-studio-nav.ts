/**
 * Restore Studio sidebar CMS group to Contents + Settings (Phase 3 contract).
 * Use when a package install replaced it with table-wizard / general-cms-* items.
 */
import {
  buildCmsStudioNavGroup,
  CMS_ROUTE_PREFIX,
  upsertCmsStudioNavGroup,
} from './cmsStudioNav';

upsertCmsStudioNavGroup(buildCmsStudioNavGroup({
  contents: {
    pageKey: 'cms-contents-list',
    routePattern: `${CMS_ROUTE_PREFIX}/contents`,
    label: 'Contents',
    icon: 'Newspaper',
    description: 'Write, version, publish, and archive editorial content.',
    iconColor: 'text-sky-600',
    order: 1,
  },
  settings: {
    pageKey: 'cms-settings',
    routePattern: `${CMS_ROUTE_PREFIX}/settings/*`,
    label: 'Settings',
    icon: 'Settings',
    description: 'Domain settings and Base Info vocabularies.',
    iconColor: 'text-slate-600',
    order: 2,
  },
}));

console.log('CMS Studio nav restored: Contents | Settings');
