import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import {
  AppButton,
  AppSelectionToggle,
  APP_SELECTION_TOGGLE_WRAP_CLASS,
  CreateEditModalShell,
  FormField,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';
import type { ConfigureDataApiEnrichment } from '../lib/configureDataApiTypes';
import {
  BASE_INFO_JOIN_TABLE_ID,
  resolveJoinTableFieldOptions,
  type DataApiJoinTableOption,
} from '../lib/dataApiJoinTableOptions';
import {
  buildEnrichmentFromDialogState,
  buildFieldEnrichmentDialogState,
  resetDialogStateForJoinTable,
  toggleDialogSelectedField,
} from '../lib/dataApiFieldEnrichmentUi';
type DataApiFieldEnrichmentDialogProps = {
  open: boolean;
  columnName: string;
  sourceModel?: EdgeModelDefinition;
  joinTableOptions: DataApiJoinTableOption[];
  enrichment?: ConfigureDataApiEnrichment;
  onClose: () => void;
  onSave: (enrichment: ConfigureDataApiEnrichment | null) => void;
};

export const DataApiFieldEnrichmentDialog: React.FC<DataApiFieldEnrichmentDialogProps> = ({
  open,
  columnName,
  sourceModel,
  joinTableOptions,
  enrichment,
  onClose,
  onSave,
}) => {
  const resolvedJoinTableOptions = useMemo(() => (
    joinTableOptions.length > 0
      ? joinTableOptions
      : [{
        id: BASE_INFO_JOIN_TABLE_ID,
        label: 'base_info',
        source: 'base_info' as const,
      }]
  ), [joinTableOptions]);

  const [state, setState] = useState(() => (
    buildFieldEnrichmentDialogState(columnName, sourceModel, resolvedJoinTableOptions, enrichment)
  ));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setState(buildFieldEnrichmentDialogState(columnName, sourceModel, resolvedJoinTableOptions, enrichment));
    setError(null);
  }, [columnName, enrichment, resolvedJoinTableOptions, open, sourceModel]);

  const selectedJoinOption = useMemo(
    () => resolvedJoinTableOptions.find((item) => item.id === state.joinTableId)
      ?? resolvedJoinTableOptions.find((item) => item.id === BASE_INFO_JOIN_TABLE_ID),
    [resolvedJoinTableOptions, state.joinTableId],
  );

  const fieldOptions = useMemo(
    () => resolveJoinTableFieldOptions(selectedJoinOption),
    [selectedJoinOption],
  );

  const selectedFieldSet = useMemo(
    () => new Set(state.selectedFieldNames),
    [state.selectedFieldNames],
  );

  const isBaseInfoJoin = selectedJoinOption?.source !== 'edge_model';

  const handleSave = () => {
    const next = buildEnrichmentFromDialogState(
      columnName,
      sourceModel,
      resolvedJoinTableOptions,
      state,
      enrichment?.id,
    );

    if (!next) {
      setError(state.selectedFieldNames.length === 0
        ? (isBaseInfoJoin
          ? 'Select at least one field from base_info.'
          : 'Select at least one field from the join table.')
        : 'Unable to build enrichment for the selected join table.');
      return;
    }

    onSave(next);
    onClose();
  };

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="lg"
      title="Join & enrich field"
      subtitle={(
        <span className="font-mono text-[11px] text-slate-600">{columnName}</span>
      )}
      subtitleTone="muted"
      onClose={onClose}
      onBackdropClick={onClose}
      closeOnEscape
      showCloseButton
      footer={(
        <>
          {enrichment ? (
            <AppButton intent="cancel" onClick={handleRemove}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </AppButton>
          ) : (
            <AppButton intent="cancel" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </AppButton>
          )}
          <AppButton intent="primary" onClick={handleSave}>
            <Check className="h-3.5 w-3.5" />
            Save
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="text-[11px] text-slate-500">
          Join another table on this field value and attach extra columns to the API response.
          Default join table is
          {' '}
          <code className="font-mono text-[10px]">base_info</code>
          {' '}
          for title lookup.
        </p>

        <FormField label="Join table">
          <UiSelect
            size="sm"
            value={state.joinTableId || BASE_INFO_JOIN_TABLE_ID}
            className="h-8 min-w-0 w-full text-[11px]"
            onChange={(event) => {
              setState(resetDialogStateForJoinTable(
                event.target.value,
                columnName,
                sourceModel,
                resolvedJoinTableOptions,
              ));
              setError(null);
            }}
          >
            {resolvedJoinTableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </UiSelect>
        </FormField>

        <FormField label="Fields">
          {fieldOptions.length === 0 ? (
            <p className="ps-[4px] text-[10px] text-slate-400">No fields available for this table.</p>
          ) : (
            <div className={APP_SELECTION_TOGGLE_WRAP_CLASS} role="group" aria-label="Join field selection">
              {fieldOptions.map((field) => {
                const selected = selectedFieldSet.has(field.name);

                return (
                  <AppSelectionToggle
                    key={field.name}
                    selected={selected}
                    onClick={() => {
                      setState((current) => toggleDialogSelectedField(current, field.name));
                      setError(null);
                    }}
                  >
                    <span className="font-mono">{field.label}</span>
                  </AppSelectionToggle>
                );
              })}
            </div>
          )}
        </FormField>

        {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};

type DataApiOutputFieldRow = {
  column: SchemaFieldInfo;
  selected: boolean;
  enrichment?: ConfigureDataApiEnrichment;
};

const findEnrichmentForOutputColumn = (
  enrichments: ConfigureDataApiEnrichment[],
  columnName: string,
  sourceModel?: EdgeModelDefinition,
): ConfigureDataApiEnrichment | undefined => (
  enrichments.find((item) => (
    item.sourceField === columnName
    || sourceModel?.columns.some((modelColumn) => (
      (modelColumn.name === columnName || modelColumn.field === columnName)
      && (item.sourceField === modelColumn.field || item.sourceField === modelColumn.name)
    ))
  ))
);

const OUTPUT_FIELD_CHIP_PLUS_BUTTON_CLASS =
  'absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-opacity hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:pointer-events-none disabled:opacity-0';

export type DataApiOutputFieldsWithEnrichmentEditorProps = {
  outputFields: string[];
  columnOptions: SchemaFieldInfo[];
  enrichments: ConfigureDataApiEnrichment[];
  sourceModel?: EdgeModelDefinition;
  joinTableOptions: DataApiJoinTableOption[];
  isColumnOptionsLoading?: boolean;
  disabled?: boolean;
  onChange: (outputFields: string[]) => void;
  onEnrichmentsChange: (enrichments: ConfigureDataApiEnrichment[]) => void;
};

export const DataApiOutputFieldsWithEnrichmentEditor: React.FC<
  DataApiOutputFieldsWithEnrichmentEditorProps
> = ({
  outputFields,
  columnOptions,
  enrichments,
  sourceModel,
  joinTableOptions,
  isColumnOptionsLoading = false,
  disabled,
  onChange,
  onEnrichmentsChange,
}) => {
  const [dialogColumn, setDialogColumn] = useState<string | null>(null);
  const selectedSet = new Set(outputFields);

  const rows: DataApiOutputFieldRow[] = useMemo(() => (
    columnOptions.map((column) => ({
      column,
      selected: selectedSet.has(column.name),
      enrichment: findEnrichmentForOutputColumn(enrichments, column.name, sourceModel),
    }))
  ), [columnOptions, enrichments, outputFields, sourceModel]);

  const openEnrichment = rows.find((row) => row.column.name === dialogColumn);

  const toggleColumn = (columnName: string, selected: boolean) => {
    if (selected) {
      onChange(outputFields.filter((name) => name !== columnName));
      const enrichment = findEnrichmentForOutputColumn(enrichments, columnName, sourceModel);
      if (enrichment) {
        onEnrichmentsChange(enrichments.filter((item) => item.id !== enrichment.id));
      }
      return;
    }

    onChange([...outputFields, columnName]);
  };

  if (isColumnOptionsLoading) {
    return <p className="text-[10px] text-slate-400">Loading column names...</p>;
  }

  if (columnOptions.length === 0) {
    return <p className="text-[10px] text-slate-400">No columns available.</p>;
  }

  return (
    <>
      <div className={APP_SELECTION_TOGGLE_WRAP_CLASS} role="group" aria-label="Output field selection">
        {rows.map((row) => (
          <div key={row.column.name} className="group relative">
            <AppSelectionToggle
              selected={row.selected}
              disabled={disabled}
              className="pe-4"
              onClick={() => toggleColumn(row.column.name, row.selected)}
            >
              <span className="font-mono">{row.column.name}</span>
            </AppSelectionToggle>
            <button
              type="button"
              aria-label={`Join and enrich ${row.column.name}`}
              disabled={disabled || !row.selected}
              className={cn(
                OUTPUT_FIELD_CHIP_PLUS_BUTTON_CLASS,
                row.enrichment
                  ? 'opacity-100 border-indigo-200 bg-indigo-50 text-indigo-600'
                  : 'opacity-0 group-hover:opacity-100',
              )}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDialogColumn(row.column.name);
              }}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <DataApiFieldEnrichmentDialog
        open={dialogColumn !== null}
        columnName={dialogColumn ?? ''}
        sourceModel={sourceModel}
        joinTableOptions={joinTableOptions}
        enrichment={openEnrichment?.enrichment}
        onClose={() => setDialogColumn(null)}
        onSave={(nextEnrichment) => {
          if (!dialogColumn) {
            return;
          }

          const sourceField = sourceModel?.columns.find((item) => item.name === dialogColumn)?.field
            ?? dialogColumn;

          const withoutCurrent = enrichments.filter((item) => (
            item.sourceField !== sourceField && item.sourceField !== dialogColumn
          ));

          onEnrichmentsChange(
            nextEnrichment ? [...withoutCurrent, nextEnrichment] : withoutCurrent,
          );
        }}
      />
    </>
  );
};
