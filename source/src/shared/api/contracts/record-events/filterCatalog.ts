import { listObjectNamesForPlatformApi, listPlatformApisForObject } from '../../../lib/baseObjectPlatformApis';

export const RECORD_EVENT_FILTER_ALL = 'ALL';

export const RECORD_EVENT_DATA_API_FILTER_PREFIX = 'data-api:';

export const RECORD_EVENT_NO_MATCH_KIND = '__none__';

export const RECORD_EVENT_KNOWN_ENTITIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'base_users', label: 'Users' },
  { value: 'base_roles', label: 'Roles' },
  { value: 'base_sample_mock_records', label: 'Sample mock' },
  { value: 'hwy_members', label: 'Hawiety members' },
];

export type RecordEventFilterOption = {
  value: string;
  label: string;
  subjectKinds: string[];
};

export const toDataApiFilterValue = (apiKey: string): string => (
  `${RECORD_EVENT_DATA_API_FILTER_PREFIX}${apiKey}`
);

export const parseDataApiFilterValue = (value: string): string | null => (
  value.startsWith(RECORD_EVENT_DATA_API_FILTER_PREFIX)
    ? value.slice(RECORD_EVENT_DATA_API_FILTER_PREFIX.length)
    : null
);

export const listRecordEventPlatformApiFilters = (): RecordEventFilterOption[] => {
  const map = new Map<string, RecordEventFilterOption>();
  for (const entity of RECORD_EVENT_KNOWN_ENTITIES) {
    for (const api of listPlatformApisForObject(entity.value)) {
      const current = map.get(api.key) ?? {
        value: api.key,
        label: api.label,
        subjectKinds: [],
      };
      if (!current.subjectKinds.includes(entity.value)) {
        current.subjectKinds.push(entity.value);
      }
      map.set(api.key, current);
    }
  }
  return [...map.values()].sort((left, right) => left.label.localeCompare(right.label));
};

export const listRecordEventDataApiFilters = (
  definitions: ReadonlyArray<{ key: string; label: string; edgeModelId: string }>,
  models: ReadonlyArray<{ id: string; objectName: string }>,
): RecordEventFilterOption[] => {
  const objectNameById = new Map(models.map((model) => [model.id, model.objectName]));
  return definitions
    .map((definition) => {
      const objectName = objectNameById.get(definition.edgeModelId)?.trim();
      if (!objectName) return null;
      return {
        value: toDataApiFilterValue(definition.key),
        label: `${definition.label} (Data API)`,
        subjectKinds: [objectName],
      } satisfies RecordEventFilterOption;
    })
    .filter((item): item is RecordEventFilterOption => item !== null)
    .sort((left, right) => left.label.localeCompare(right.label));
};

export const mergeRecordEventEntityOptions = (input: {
  models?: ReadonlyArray<{ objectName: string; title: string }>;
  extraValues?: ReadonlyArray<string>;
}): Array<{ value: string; label: string }> => {
  const map = new Map<string, string>();
  for (const entity of RECORD_EVENT_KNOWN_ENTITIES) {
    map.set(entity.value, entity.label);
  }
  for (const model of input.models ?? []) {
    const value = model.objectName.trim();
    if (!value || map.has(value)) continue;
    map.set(value, model.title.trim() || value);
  }
  for (const extra of input.extraValues ?? []) {
    const value = extra.trim();
    if (!value || value === RECORD_EVENT_FILTER_ALL || map.has(value)) continue;
    map.set(value, value);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
};

export const commitRecordEventFilterValue = (
  raw: string,
  options: ReadonlyArray<{ value: string; label: string }>,
): string => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === RECORD_EVENT_FILTER_ALL) return RECORD_EVENT_FILTER_ALL;
  const byValue = options.find((item) => item.value === trimmed);
  if (byValue) return byValue.value;
  const lowered = trimmed.toLowerCase();
  const byLabel = options.find((item) => item.label.toLowerCase() === lowered);
  if (byLabel) return byLabel.value;
  return trimmed;
};

export const subjectKindsForRecordEventApiFilter = (
  apiValue: string,
  dataApiFilters: ReadonlyArray<RecordEventFilterOption> = [],
): string[] | undefined => {
  const value = apiValue.trim();
  if (!value || value === RECORD_EVENT_FILTER_ALL) return undefined;
  const dataKey = parseDataApiFilterValue(value);
  if (dataKey) {
    return dataApiFilters.find((item) => item.value === value)?.subjectKinds ?? [];
  }
  const catalog = [...listRecordEventPlatformApiFilters(), ...dataApiFilters];
  const byValue = catalog.find((item) => item.value === value);
  if (byValue) return byValue.subjectKinds;
  const lowered = value.toLowerCase();
  const byLabel = catalog.find((item) => item.label.toLowerCase() === lowered);
  if (byLabel) return byLabel.subjectKinds;
  const byDataKey = dataApiFilters.find((item) => parseDataApiFilterValue(item.value) === value);
  if (byDataKey) return byDataKey.subjectKinds;
  const objects = listObjectNamesForPlatformApi(value);
  if (objects.length > 0) return objects;
  return [value];
};

export const parseSubjectKindsCsv = (raw: string | undefined): string[] => (
  (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

export const resolveRecordEventSubjectKinds = (input: {
  subjectKind?: string;
  subjectKinds?: string;
}): string[] | 'empty' | undefined => {
  const listed = parseSubjectKindsCsv(input.subjectKinds);
  const entity = input.subjectKind?.trim() || '';
  if (listed.includes(RECORD_EVENT_NO_MATCH_KIND) && !listed.includes(entity)) {
    return 'empty';
  }
  if (entity && listed.length > 0 && !listed.includes(entity)) {
    return 'empty';
  }
  if (entity) return [entity];
  if (listed.length === 0) return undefined;
  return listed;
};

export const toRecordEventListKindParams = (input: {
  entity: string;
  api: string;
  dataApiFilters?: ReadonlyArray<RecordEventFilterOption>;
}): { subjectKind?: string; subjectKinds?: string } => {
  const entity = input.entity.trim() && input.entity !== RECORD_EVENT_FILTER_ALL
    ? input.entity.trim()
    : undefined;
  const apiKinds = subjectKindsForRecordEventApiFilter(input.api, input.dataApiFilters);
  if (apiKinds === undefined) {
    return { subjectKind: entity };
  }
  return {
    subjectKind: entity,
    subjectKinds: apiKinds.length > 0 ? apiKinds.join(',') : RECORD_EVENT_NO_MATCH_KIND,
  };
};
