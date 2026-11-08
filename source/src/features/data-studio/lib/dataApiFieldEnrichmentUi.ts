import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import { resolveBaseInfoRootForField } from '../../../domain/component-designer/baseInfoFieldInference';
import type {
  ConfigureDataApiEnrichment,
  ConfigureDataApiEnrichmentAttachedField,
} from '../lib/configureDataApiTypes';
import {
  suggestEnrichmentOutputField,
} from '../lib/configureDataApi';
import {
  BASE_INFO_JOIN_TABLE_ID,
  resolveEdgeModelPrimaryKeyColumn,
  type DataApiJoinTableOption,
} from '../lib/dataApiJoinTableOptions';

const createId = (prefix: string): string => (
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`
);

export const resolveSourceFieldForColumn = (
  columnName: string,
  model?: EdgeModelDefinition,
): string => {
  const column = model?.columns.find((item) => item.name === columnName);
  return column?.field ?? columnName;
};

export const findEnrichmentForColumn = (
  enrichments: ConfigureDataApiEnrichment[],
  columnName: string,
  model?: EdgeModelDefinition,
): ConfigureDataApiEnrichment | undefined => {
  const sourceField = resolveSourceFieldForColumn(columnName, model);
  return enrichments.find((item) => (
    item.sourceField === sourceField || item.sourceField === columnName
  ));
};

export const countEnrichmentOutputs = (enrichment: ConfigureDataApiEnrichment): number => {
  if (enrichment.kind === 'base_info_title') {
    if (enrichment.attachedFields?.length) {
      return enrichment.attachedFields.length;
    }
    return enrichment.includeUiMeta ? 2 : 1;
  }
  return enrichment.attachedFields.length;
};

export const describeEnrichmentSummary = (
  enrichment: ConfigureDataApiEnrichment,
  joinTableOptions: DataApiJoinTableOption[],
): string => {
  if (enrichment.kind === 'base_info_title') {
    const count = enrichment.attachedFields?.length ?? 1;
    return `base_info · ${count} field${count === 1 ? '' : 's'}`;
  }

  const tableLabel = joinTableOptions.find((item) => item.id === enrichment.targetModelId)?.label
    ?? enrichment.targetModelId;
  const fieldCount = enrichment.attachedFields.length;
  return `${tableLabel} · ${fieldCount} field${fieldCount === 1 ? '' : 's'}`;
};

export type FieldEnrichmentDialogState = {
  joinTableId: string;
  selectedFieldNames: string[];
};

const buildBaseInfoOutputField = (
  sourceField: string,
  sourceColumn: string,
): string => {
  if (sourceColumn === 'title') {
    return suggestEnrichmentOutputField(sourceField);
  }
  return `${sourceField}_${sourceColumn}`;
};

const defaultBaseInfoSelectedFields = (): string[] => ['title'];

const enrichmentToSelectedFieldNames = (
  enrichment: ConfigureDataApiEnrichment,
): string[] => {
  if (enrichment.kind === 'base_info_title') {
    if (enrichment.attachedFields?.length) {
      return enrichment.attachedFields.map((item) => item.sourceColumn);
    }
    const fields = ['title'];
    if (enrichment.includeUiMeta) {
      fields.push('ui_html');
    }
    return fields;
  }

  return enrichment.attachedFields.map((item) => item.sourceColumn);
};

export const buildFieldEnrichmentDialogState = (
  columnName: string,
  _sourceModel: EdgeModelDefinition | undefined,
  joinTableOptions: DataApiJoinTableOption[],
  existing?: ConfigureDataApiEnrichment,
): FieldEnrichmentDialogState => {
  if (existing?.kind === 'join_lookup') {
    return {
      joinTableId: existing.targetModelId,
      selectedFieldNames: enrichmentToSelectedFieldNames(existing),
    };
  }

  if (existing?.kind === 'base_info_title') {
    return {
      joinTableId: BASE_INFO_JOIN_TABLE_ID,
      selectedFieldNames: enrichmentToSelectedFieldNames(existing),
    };
  }

  const defaultJoinTableId = joinTableOptions[0]?.id ?? BASE_INFO_JOIN_TABLE_ID;
  return {
    joinTableId: defaultJoinTableId,
    selectedFieldNames: defaultJoinTableId === BASE_INFO_JOIN_TABLE_ID
      ? defaultBaseInfoSelectedFields()
      : [],
  };
};

export const buildEnrichmentFromDialogState = (
  columnName: string,
  sourceModel: EdgeModelDefinition | undefined,
  joinTableOptions: DataApiJoinTableOption[],
  state: FieldEnrichmentDialogState,
  existingId?: string,
): ConfigureDataApiEnrichment | null => {
  const sourceField = resolveSourceFieldForColumn(columnName, sourceModel);
  const joinOption = joinTableOptions.find((item) => item.id === state.joinTableId);
  const selectedFieldNames = [...new Set(state.selectedFieldNames)];

  if (selectedFieldNames.length === 0) {
    return null;
  }

  if (!joinOption || joinOption.source === 'base_info') {
    const attachedFields: ConfigureDataApiEnrichmentAttachedField[] = selectedFieldNames
      .map((sourceColumn) => ({
        sourceColumn,
        outputField: buildBaseInfoOutputField(sourceField, sourceColumn),
      }));

    const titleField = attachedFields.find((item) => item.sourceColumn === 'title');
    const rootId = resolveBaseInfoRootForField(columnName)
      ?? resolveBaseInfoRootForField(sourceField);

    return {
      id: existingId ?? createId('enrich'),
      sourceField,
      kind: 'base_info_title',
      joinTableSource: 'base_info',
      ...(rootId ? { rootId } : {}),
      attachedFields,
      outputField: titleField?.outputField,
      langSource: 'query:lang',
      includeUiMeta: selectedFieldNames.includes('ui_html') || undefined,
    };
  }

  const targetMatchColumn = joinOption.model
    ? resolveEdgeModelPrimaryKeyColumn(joinOption.model)
    : '';
  const attachedFields: ConfigureDataApiEnrichmentAttachedField[] = selectedFieldNames
    .map((sourceColumn) => ({
      sourceColumn,
      outputField: `${sourceColumn}_joined`,
    }));

  if (!targetMatchColumn || attachedFields.length === 0) {
    return null;
  }

  return {
    id: existingId ?? createId('enrich'),
    sourceField,
    kind: 'join_lookup',
    joinTableSource: 'edge_model',
    targetModelId: joinOption.id,
    targetMatchColumn,
    attachedFields,
  };
};

export const resetDialogStateForJoinTable = (
  joinTableId: string,
  columnName: string,
  _sourceModel: EdgeModelDefinition | undefined,
  joinTableOptions: DataApiJoinTableOption[],
): FieldEnrichmentDialogState => {
  const joinOption = joinTableOptions.find((item) => item.id === joinTableId);

  return {
    joinTableId,
    selectedFieldNames: !joinOption || joinOption.source === 'base_info'
      ? defaultBaseInfoSelectedFields()
      : [],
  };
};

export const toggleDialogSelectedField = (
  state: FieldEnrichmentDialogState,
  fieldName: string,
): FieldEnrichmentDialogState => {
  const selected = new Set(state.selectedFieldNames);
  if (selected.has(fieldName)) {
    selected.delete(fieldName);
  } else {
    selected.add(fieldName);
  }

  return {
    ...state,
    selectedFieldNames: [...selected],
  };
};
