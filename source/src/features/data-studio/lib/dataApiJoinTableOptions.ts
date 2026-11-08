import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';

export const BASE_INFO_JOIN_TABLE_ID = '__base_info__';

export const BASE_INFO_TABLE_COLUMNS = [
  'id',
  'parent_id',
  'title',
  'title_en',
  'title_fa',
  'title_ar',
  'short_name',
  'view_order',
  'note',
  'note_en',
  'note_fa',
  'note_ar',
  'metadata',
  'value',
  'is_active',
  'ui_color',
  'ui_html',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

export type DataApiJoinTableFieldOption = {
  name: string;
  label: string;
};

export const BASE_INFO_JOIN_FIELDS: DataApiJoinTableFieldOption[] = BASE_INFO_TABLE_COLUMNS.map(
  (name) => ({ name, label: name }),
);

export type DataApiJoinTableOption = {
  id: string;
  label: string;
  source: 'base_info' | 'edge_model';
  model?: EdgeModelDefinition;
};

export const buildJoinTableOptions = (
  sourceModel: EdgeModelDefinition | undefined,
  allModels: EdgeModelDefinition[],
): DataApiJoinTableOption[] => {
  const options: DataApiJoinTableOption[] = [{
    id: BASE_INFO_JOIN_TABLE_ID,
    label: 'base_info',
    source: 'base_info',
  }];

  if (!sourceModel) {
    return options;
  }

  for (const model of allModels) {
    if (model.id === sourceModel.id || model.dataSourceId !== sourceModel.dataSourceId) {
      continue;
    }
    if (model.objectType !== 'TABLE' && model.objectType !== 'VIEW') {
      continue;
    }
    options.push({
      id: model.id,
      label: model.labels.title || model.objectName,
      source: 'edge_model',
      model,
    });
  }

  return options;
};

export const resolveEdgeModelPrimaryKeyColumn = (model: EdgeModelDefinition): string => {
  if (typeof model.primaryKey === 'string') {
    const column = model.columns.find((item) => (
      item.field === model.primaryKey || item.name === model.primaryKey
    ));
    return column?.name ?? model.primaryKey;
  }

  const first = model.primaryKey[0];
  const column = model.columns.find((item) => item.field === first || item.name === first);
  return column?.name ?? first;
};

export const resolveJoinTableFieldOptions = (
  joinOption: DataApiJoinTableOption | undefined,
): DataApiJoinTableFieldOption[] => {
  if (!joinOption) {
    return [];
  }

  if (joinOption.source === 'base_info') {
    return BASE_INFO_JOIN_FIELDS.map((field) => ({ ...field }));
  }

  return (joinOption.model?.columns ?? []).map((column) => ({
    name: column.name,
    label: column.name,
  }));
};
