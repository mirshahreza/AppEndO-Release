/**
 * Studio sidebar membership for packed extension pages.
 * Editors, vocab catalogs, and comment lists belong in page chrome — not the main menu.
 */
export type PackageStudioSidebarChrome = {
  label: string;
  icon: string;
  routePattern: string;
  group?: string;
};

export const PACKAGE_STUDIO_SIDEBAR_CHROME: Record<string, PackageStudioSidebarChrome> = {
  'cms-contents-list': {
    label: 'Contents',
    icon: 'Newspaper',
    routePattern: 'cms/contents',
  },
  'cms-settings': {
    label: 'Settings',
    icon: 'Settings',
    routePattern: 'cms/settings/*',
  },
  'ssh-hub': {
    label: 'SSH',
    icon: 'tabler:IconTerminal2',
    routePattern: 'ssh/*',
    group: 'Remote Hubs',
  },
  'file-hub': {
    label: 'Sftp',
    icon: 'tabler:IconFolders',
    routePattern: 'sftp/*',
    group: 'Remote Hubs',
  },
  'rdp-hub': {
    label: 'RDP',
    icon: 'tabler:IconDeviceDesktop',
    routePattern: 'rdp/*',
    group: 'Remote Hubs',
  },
};

export const PACKAGE_STUDIO_SIDEBAR_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PACKAGE_STUDIO_SIDEBAR_CHROME).map(([pageKey, chrome]) => [pageKey, chrome.label]),
);

/** Standalone comments list — retired; moderation lives in the contents editor. */
const RETIRED_DESIGNER_CATALOG_COMPONENT_NAMES = new Set(['cms-comments']);

export function isRetiredDesignerCatalogComponent(name: string): boolean {
  return RETIRED_DESIGNER_CATALOG_COMPONENT_NAMES.has(name.trim().toLowerCase());
}

export function isPackageStudioSidebarRoute(pageKey: string): boolean {
  const key = pageKey.trim().toLowerCase();
  if (!key) return false;
  if (key.includes('-editor')) return false;
  if (key.includes('-vocab-')) return false;
  if (/(^|-)comments$/.test(key)) return false;
  if (key.startsWith('cms-site-')) return false;
  return true;
}

/** Settings stays last in a package Studio group (CMS, CRM, …). */
export function isPackageStudioSettingsRoute(pageKey: string): boolean {
  return /(^|-)settings$/.test(pageKey.trim().toLowerCase());
}

export function sortPackageStudioSidebarItems<T extends { pageKey: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftSettings = isPackageStudioSettingsRoute(left.pageKey);
    const rightSettings = isPackageStudioSettingsRoute(right.pageKey);
    if (leftSettings === rightSettings) return 0;
    return leftSettings ? 1 : -1;
  });
}

export function packageStudioSidebarLabel(pageKey: string, fallback: string): string {
  return PACKAGE_STUDIO_SIDEBAR_CHROME[pageKey]?.label ?? fallback;
}

export function packageStudioSidebarChrome(pageKey: string): PackageStudioSidebarChrome | undefined {
  return PACKAGE_STUDIO_SIDEBAR_CHROME[pageKey];
}
