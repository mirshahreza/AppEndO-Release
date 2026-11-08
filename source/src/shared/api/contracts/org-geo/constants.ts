/** Platform Base Info tree root (`Base`). Organization and Geographic Divisions are children. */
export const BASE_INFO_PLATFORM_ROOT_ID = '100';

/** Platform Organization category in `base_info` (under Base). */
export const ORG_BASE_INFO_ROOT_ID = `${BASE_INFO_PLATFORM_ROOT_ID}.4`;
export const ORG_BASE_INFO_ROOT_SHORT_NAME = 'platform.org';
export const ORG_BASE_INFO_ROOT_TITLE_EN = 'Organization';

/** Platform Geographic Divisions category in `base_info` (under Base). */
export const GEO_BASE_INFO_ROOT_ID = `${BASE_INFO_PLATFORM_ROOT_ID}.5`;
export const GEO_BASE_INFO_ROOT_SHORT_NAME = 'platform.geo';
export const GEO_BASE_INFO_ROOT_TITLE_EN = 'Geographic Divisions';

export const ORG_GEO_PAGE_KEYS = {
  organizationChart: 'organization-chart',
  geographicDivisions: 'geographic-divisions',
} as const;

/** Scope membership dimensions (p-87-aligned). */
export const SCOPE_DIMENSION_ORG = 'org';
export const SCOPE_DIMENSION_GEO = 'geo';

/** Append-only junction history events for `base_scope_memberships`. */
export const SCOPE_MEMBERSHIP_EVENT_TYPES = ['assigned', 'removed'] as const;
export type ScopeMembershipEventType = (typeof SCOPE_MEMBERSHIP_EVENT_TYPES)[number];

export const SCOPE_DIMENSION_ROOT: Record<string, string> = {
  [SCOPE_DIMENSION_ORG]: ORG_BASE_INFO_ROOT_ID,
  [SCOPE_DIMENSION_GEO]: GEO_BASE_INFO_ROOT_ID,
};
