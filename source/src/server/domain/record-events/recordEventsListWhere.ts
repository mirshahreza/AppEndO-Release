import type { ListWhereColumnMap } from '../../../shared/ui/list-filter/listWhereQuery';

export const RECORD_EVENTS_LIST_WHERE_COLUMNS: ListWhereColumnMap = {
  entity: { path: 'subjectKind', type: 'string' },
  subjectId: { path: 'subjectId', type: 'string' },
  field: { path: 'field', type: 'string' },
  outcome: { path: 'outcome', type: 'enum' },
  eventKind: { path: 'eventKind', type: 'enum' },
  occurredAt: { path: 'occurredAt', type: 'date' },
};
