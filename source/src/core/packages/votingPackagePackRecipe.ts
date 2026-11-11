/**
 * Voting packing recipe for Package Builder — schema + Base Info capture.
 * REST lives in capabilities.edge_apis (Phase 2), not Express mounts.
 */

export const VOTING_SCHEMA_INSTALL_SQLSERVER = 'voting-phase1/db/install/vote_schema.sqlserver.sql';
export const VOTING_SCHEMA_UNINSTALL_SQLSERVER = 'voting-phase1/db/uninstall/vote_schema.sqlserver.sql';

export const VOTING_PACKAGE_VOCAB_ROOT_TITLE = 'Voting';

export const VOTING_TABLE_NAMES = [
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

export const VOTING_PACKAGE_VOCAB_CAPTURE = {
  tableName: 'base_info',
  where: `(title = '${VOTING_PACKAGE_VOCAB_ROOT_TITLE}' OR title_en = '${VOTING_PACKAGE_VOCAB_ROOT_TITLE}')`,
  parentColumn: 'parent_id',
  includeDescendants: true,
  includeBinary: false,
} as const;

export function votingSchemaInstallPath(sourceType: string): string | null {
  const normalized = sourceType.trim().toLowerCase();
  if (normalized.includes('sql server') || normalized.includes('mssql')) {
    return VOTING_SCHEMA_INSTALL_SQLSERVER;
  }
  return null;
}

export function votingSchemaUninstallPath(sourceType: string): string | null {
  const normalized = sourceType.trim().toLowerCase();
  if (normalized.includes('sql server') || normalized.includes('mssql')) {
    return VOTING_SCHEMA_UNINSTALL_SQLSERVER;
  }
  return null;
}
