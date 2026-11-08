import { buildPackagePageLoaderRef } from '../../shared/api/contracts/package-manifest/verticalApp';

export const HAWIETY_PACKAGE_ID = 'hawiety';
export const HAWIETY_PACKAGE_NAME = 'Hawiety';
export const HAWIETY_PACKAGE_VERSION = '0.3.7';
export const HAWIETY_PORTAL_SEGMENT = 'hawiety';
export const HAWIETY_MOUNT_PATH_PREFIX = '/hawiety';

/** Studio / portal page modules owned by the Hawiety package. */
export const HAWIETY_HOST_PAGE_KEYS = [
  'hwy-member-dossier',
  'hwy-member-dossier-view',
  'hwy-member-dossier-edit',
  'hwy-org-membership-transfer',
  'hwy-geo-responsibility',
  'hwy-geo-responsibility-candidates-admin',
  'hwy-geo-responsibility-montadhemin-admin',
  'hwy-geo-responsibility-removal-requests',
  'hwy-courses-activities',
  'hwy-targhin-requests',
  'hwy-phone-requests',
  'hwy-members-targhin',
  'hwy-member-targhin-admin',
  'hwy-etl-console',
  'hwy-business-rules-reference',
  'hwy-members-all',
  'hwy-members-quick-search',
  'hwy-members-montadhemin',
  'hwy-members-institute-ammah',
  'hwy-members-institute-gov',
  'hwy-members-institute-hemam',
  'hwy-members-institute-mehani',
  'hwy-members',
  'hwy-nakhebin',
  'hwy-queue-local',
  'hwy-queue-call-center',
  'hwy-settings',
  'hwy-institutes',
] as const;

export type HawietyHostPageKey = (typeof HAWIETY_HOST_PAGE_KEYS)[number];

const HAWIETY_HOST_PAGE_KEY_SET = new Set<string>(HAWIETY_HOST_PAGE_KEYS);

export function isHawietyHostPageKey(pageKey: string | undefined): pageKey is HawietyHostPageKey {
  if (!pageKey) return false;
  if (HAWIETY_HOST_PAGE_KEY_SET.has(pageKey)) return true;
  return pageKey.startsWith('hwy-');
}

export function isHawietyCorePageLoaderRef(loaderRef: string | undefined): boolean {
  return Boolean(loaderRef?.startsWith('core:Hwy'));
}

/** Legacy platform resolvers removed in wave H — map old core loaders to package page keys. */
export const HAWIETY_LEGACY_CORE_LOADER_TO_PAGE_KEY: Record<string, string> = {
  'core:HwyBusinessRulesReference': 'hwy-business-rules-reference',
  'core:HwyEtlConsole': 'hwy-etl-console',
  'core:HwyMemberTarghinMembersList': 'hwy-members-targhin',
  'core:HwyMemberTarghinAdmin': 'hwy-targhin-requests',
  'core:HwyCoursesActivities': 'hwy-courses-activities',
  'core:HwyGeoResponsibility': 'hwy-geo-responsibility',
  'core:HwyOrgMembershipTransfer': 'hwy-org-membership-transfer',
  'core:HwyMemberDossierView': 'hwy-member-dossier-view',
  'core:HwyMemberDossierEdit': 'hwy-member-dossier-edit',
  'core:HwyMemberDossier': 'hwy-member-dossier',
};

const HAWIETY_PACKAGE_UI_PAGE_KEYS = new Set(Object.values(HAWIETY_LEGACY_CORE_LOADER_TO_PAGE_KEY));

export function isHawietyPackageUiPageKey(pageKey: string | undefined): boolean {
  return Boolean(pageKey && HAWIETY_PACKAGE_UI_PAGE_KEYS.has(pageKey));
}

export function coerceHawietyPackagePageModule<
  T extends {
    pageKey: string;
    loaderKind?: string;
    loaderRef?: string;
    ownerPackageId?: string | null;
  },
>(module: T): T {
  if (!isHawietyPackageUiPageKey(module.pageKey)) {
    return module;
  }
  if (module.loaderKind === 'designer') {
    return module;
  }
  const loaderRef = module.loaderRef?.trim() ?? '';
  if (module.loaderKind === 'package' && loaderRef.startsWith(`${HAWIETY_PACKAGE_ID}:`)) {
    return module;
  }
  const pageKey =
    (isHawietyCorePageLoaderRef(loaderRef) ? HAWIETY_LEGACY_CORE_LOADER_TO_PAGE_KEY[loaderRef] : undefined)
    ?? module.pageKey;
  return {
    ...module,
    pageKey,
    loaderKind: 'package',
    loaderRef: buildPackagePageLoaderRef(HAWIETY_PACKAGE_ID, pageKey),
    ownerPackageId: HAWIETY_PACKAGE_ID,
  };
}

export function isHawietyRoutePattern(routePattern: string | undefined): boolean {
  if (!routePattern) return false;
  const normalized = routePattern.replace(/^\/+/, '');
  return normalized === HAWIETY_PORTAL_SEGMENT || normalized.startsWith(`${HAWIETY_PORTAL_SEGMENT}/`);
}

export function isHawietyMountPathPrefix(pathPrefix: string | undefined): boolean {
  if (!pathPrefix) return false;
  return pathPrefix === HAWIETY_MOUNT_PATH_PREFIX || pathPrefix.endsWith(HAWIETY_MOUNT_PATH_PREFIX);
}
