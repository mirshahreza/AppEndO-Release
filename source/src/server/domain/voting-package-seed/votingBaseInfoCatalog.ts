/**
 * Voting package Base Info catalog (opt-in).
 * Not wired into controlPlaneSeed / app bootstrap.
 */

export type VotingBaseInfoItemSeed = {
  title: string;
  shortName: string;
  viewOrder: number;
  value: number;
  note?: string;
};

export type VotingBaseInfoCategorySeed = {
  title: string;
  viewOrder: number;
  value: number;
  items: VotingBaseInfoItemSeed[];
};

const item = (
  title: string,
  shortName: string,
  viewOrder: number,
  note?: string,
): VotingBaseInfoItemSeed => ({
  title,
  shortName,
  viewOrder,
  value: viewOrder,
  ...(note ? { note } : {}),
});

export const VOTING_BASE_INFO_ROOT_TITLE = 'Voting';

export const VOTING_BASE_INFO_CATEGORIES: VotingBaseInfoCategorySeed[] = [
  {
    title: 'Voting statuses',
    viewOrder: 1,
    value: 1,
    items: [
      item('Draft', 'draft', 1, 'Being configured; no voting.'),
      item('Open', 'open', 2, 'Active election operations.'),
      item('Closed', 'closed', 3, 'Voting ended; results may be finalized.'),
      item('Archived', 'archived', 4, 'Historical record only.'),
    ],
  },
  {
    title: 'Ballot types',
    viewOrder: 2,
    value: 2,
    items: [
      item('General', 'general', 1),
      item('Regional', 'regional', 2),
      item('Internal poll', 'internal_poll', 3),
    ],
  },
  {
    title: 'Registration statuses',
    viewOrder: 3,
    value: 3,
    items: [
      item('Invited', 'invited', 1),
      item('Approved', 'approved', 2),
      item('Rejected', 'rejected', 3),
      item('Voted', 'voted', 4),
    ],
  },
  {
    title: 'Observer roles',
    viewOrder: 4,
    value: 4,
    items: [
      item('Station observer', 'station', 1),
      item('Regional observer', 'regional', 2),
    ],
  },
  {
    title: 'Cast channels',
    viewOrder: 5,
    value: 5,
    items: [
      item('Studio staff', 'studio_staff', 1),
      item('Member portal', 'member_portal', 2),
      item('Import / ETL', 'etl', 3),
    ],
  },
];
