import type { GridListMode } from '../../shared/lib/gridPagingConstants';

export { DEFAULT_GRID_PAGE_SIZE as DEFAULT_PAGE_SIZE } from '../../shared/lib/gridPagingConstants';

export const DEFAULT_LIST_MODE: GridListMode = 'infinite';

export const RECORD_EVENT_OUTCOMES = ['success', 'denied', 'failed'] as const;

export const RECORD_EVENT_KIND_ALL = 'ALL';
export const RECORD_EVENT_OUTCOME_ALL = 'ALL';

export const RECORD_EVENT_KINDS = [
  'created',
  'deleted',
  'field.changed',
  'status.changed',
  'association.added',
  'association.removed',
  'access.denied',
  'config.changed',
  'history.erased',
  'history.archived',
] as const;
