export const VOTING_PACKAGE_ID = 'voting';
export const VOTING_PACKAGE_NAME = 'Voting';
export const VOTING_PACKAGE_VERSION = '0.1.0';

/** Studio page-modules owned by the Voting package (Phase 3+). */
export const VOTING_HOST_PAGE_KEYS = [
  'voting-votings',
  'voting-settings',
  'voting-mortakezin-list',
  'voting-candidates',
  'voting-voters',
  'voting-invited',
  'voting-polling-stations',
  'voting-observers',
  'voting-notifications',
  'voting-internal-polls',
] as const;

export type VotingHostPageKey = (typeof VOTING_HOST_PAGE_KEYS)[number];

/** Optional mount under Hawiety portal when both packages are installed. */
export const VOTING_HAWIETY_NAV_PREFIX = '/elections';
