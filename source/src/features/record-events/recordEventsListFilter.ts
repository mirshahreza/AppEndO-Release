import {
  RECORD_EVENT_FILTER_ALL,
  subjectKindsForRecordEventApiFilter,
  type RecordEventFilterOption,
} from '../../shared/api/contracts/record-events';
import {
  collectListWhereFieldValues,
  DEFAULT_WHERE_OPERATORS,
  listWhereTreeToIr,
  sanitizeListWhereTree,
  type WhereField,
  type WhereGroupNode,
} from '../../shared/ui';
import { createEmptyWhereTree } from '../../shared/ui/where-builder/whereBuilderModel';
import { RECORD_EVENT_KINDS, RECORD_EVENT_OUTCOMES } from './constants';

export const RECORD_EVENTS_WHERE_OPERATORS = DEFAULT_WHERE_OPERATORS;

const OUTCOME_LABELS: Record<(typeof RECORD_EVENT_OUTCOMES)[number], string> = {
  success: 'Success',
  denied: 'Denied',
  failed: 'Failed',
};

export function createRecordEventsWhereFields(input: {
  entityOptions: ReadonlyArray<{ value: string; label: string }>;
  apiOptions: ReadonlyArray<{ value: string; label: string }>;
}): WhereField[] {
  return [
    {
      id: 'entity',
      label: 'Entity',
      type: 'text',
      allowCustomValue: true,
      options: input.entityOptions
        .filter((item) => item.value !== RECORD_EVENT_FILTER_ALL)
        .map((item) => ({ id: item.value, label: item.label })),
    },
    {
      id: 'api',
      label: 'API',
      type: 'text',
      allowCustomValue: true,
      options: input.apiOptions
        .filter((item) => item.value !== RECORD_EVENT_FILTER_ALL)
        .map((item) => ({ id: item.value, label: item.label })),
    },
    { id: 'subjectId', label: 'Record id', type: 'text' },
    { id: 'field', label: 'Field', type: 'text' },
    {
      id: 'outcome',
      label: 'Outcome',
      type: 'text',
      options: RECORD_EVENT_OUTCOMES.map((item) => ({ id: item, label: OUTCOME_LABELS[item] })),
    },
    {
      id: 'eventKind',
      label: 'Kind',
      type: 'text',
      options: RECORD_EVENT_KINDS.map((item) => ({ id: item, label: item })),
    },
    { id: 'occurredAt', label: 'Time', type: 'date' },
  ];
}

export function sanitizeRecordEventsWhereTree(
  raw: unknown,
  fields: readonly WhereField[],
): WhereGroupNode {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && (raw as { kind?: string }).kind === 'group') {
    return sanitizeListWhereTree(raw, fields, RECORD_EVENTS_WHERE_OPERATORS);
  }
  return createEmptyWhereTree();
}

export function recordEventKindParamsFromWhere(
  tree: WhereGroupNode,
  dataApiFilters: ReadonlyArray<RecordEventFilterOption>,
): { entity: string; api: string; subjectId: string; apiKinds: string[] } {
  const ir = listWhereTreeToIr(tree, RECORD_EVENTS_WHERE_OPERATORS);
  const entities = collectListWhereFieldValues(ir, 'entity');
  const apis = collectListWhereFieldValues(ir, 'api');
  const subjectIds = collectListWhereFieldValues(ir, 'subjectId');
  const apiKinds = [...new Set(
    apis.flatMap((api) => subjectKindsForRecordEventApiFilter(api, dataApiFilters) ?? []),
  )];
  return {
    entity: entities.length === 1 ? entities[0]! : RECORD_EVENT_FILTER_ALL,
    api: apis.length === 1 ? apis[0]! : RECORD_EVENT_FILTER_ALL,
    subjectId: subjectIds[0] ?? '',
    apiKinds,
  };
}
