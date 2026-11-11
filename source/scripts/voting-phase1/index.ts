/**
 * Voting package Phase 1 helpers (opt-in scripts only).
 */

export const VOTE_TABLE_NAMES = [
  'vote_votings',
  'vote_ballots',
  'vote_candidates',
  'vote_voter_registrations',
  'vote_polling_stations',
  'vote_observers',
  'vote_cast_events',
  'vote_poll_questions',
  'vote_poll_answers',
] as const;

export {
  VOTING_BASE_INFO_CATEGORIES,
  VOTING_BASE_INFO_ROOT_TITLE,
  type VotingBaseInfoCategorySeed,
  type VotingBaseInfoItemSeed,
} from '../../src/server/domain/voting-package-seed/votingBaseInfoCatalog';

export {
  seedVotingBaseInfo,
  unseedVotingBaseInfo,
  type VotingBaseInfoSeedResult,
} from '../../src/server/domain/voting-package-seed/seedVotingBaseInfo';
