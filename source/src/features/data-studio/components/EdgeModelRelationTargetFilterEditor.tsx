import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { EdgeModelColumn } from '../../../shared/api/contracts/data-api';
import {
  RELATION_TARGET_FILTER_OP_OPTIONS,
  createEmptyRelationTargetFilterCondition,
  relationTargetFilterOpNeedsValue,
  type RelationTargetFilterCondition,
  type RelationTargetFilterOp,
} from '../../../shared/api/contracts/data-api';
import {
  AppButton,
  AppTableGrid,
  FieldHintTooltip,
  FormSection,
  UiInput,
  UiSelect,
  type AppTableGridColumnDef,
} from '../../../shared/ui';
import {
  APP_TABLE_GRID_ACTION_CELL_CLASS,
  APP_TABLE_GRID_ACTION_HEADER_CLASS,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from '../../../shared/ui/surfaceClasses';

export type EdgeModelRelationTargetFilterEditorProps = {
  targetColumns: ReadonlyArray<Pick<EdgeModelColumn, 'name' | 'dataType'>>;
  value: ReadonlyArray<RelationTargetFilterCondition>;
  onChange: (next: RelationTargetFilterCondition[]) => void;
  /** Match sibling FormSection spacing in Relation Properties. */
  divided?: boolean;
};

type TargetFilterRow = RelationTargetFilterCondition & {
  rowKey: string;
  index: number;
};

const updateRow = (
  rows: ReadonlyArray<RelationTargetFilterCondition>,
  index: number,
  patch: Partial<RelationTargetFilterCondition>,
): RelationTargetFilterCondition[] => (
  rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
);

export const EdgeModelRelationTargetFilterEditor: React.FC<
  EdgeModelRelationTargetFilterEditorProps
> = ({
  targetColumns,
  value,
  onChange,
  divided = true,
}) => {
  const tableRows = useMemo((): TargetFilterRow[] => (
    value.map((row, index) => ({
      ...row,
      index,
      rowKey: `target-filter-${index}`,
    }))
  ), [value]);

  const columns = useMemo((): AppTableGridColumnDef<TargetFilterRow>[] => [
    {
      id: 'column',
      label: 'Column',
      isRowHeader: true,
      width: 200,
      sort: false,
      renderCell: (row) => (
        <UiSelect
          size="sm"
          className="block w-full min-w-0"
          value={row.column}
          onChange={(event) => {
            onChange(updateRow(value, row.index, { column: event.target.value }));
          }}
          ariaLabel={`Target filter column ${row.index + 1}`}
        >
          <option value="">Select column…</option>
          {targetColumns.map((column) => (
            <option key={column.name} value={column.name}>
              {column.name}
            </option>
          ))}
        </UiSelect>
      ),
    },
    {
      id: 'op',
      label: 'Operator',
      width: 140,
      sort: false,
      renderCell: (row) => (
        <UiSelect
          size="sm"
          className="block w-full min-w-0"
          value={row.op}
          onChange={(event) => {
            const op = event.target.value as RelationTargetFilterOp;
            onChange(updateRow(value, row.index, {
              op,
              value: relationTargetFilterOpNeedsValue(op) ? (row.value ?? '') : undefined,
            }));
          }}
          ariaLabel={`Target filter operator ${row.index + 1}`}
        >
          {RELATION_TARGET_FILTER_OP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </UiSelect>
      ),
    },
    {
      id: 'value',
      label: (
        <span className="inline-flex items-center gap-0.5">
          Value
          <FieldHintTooltip
            label="Value"
            hint="Scalar for Equals / Not equals. For In list, enter comma-separated values."
          />
        </span>
      ),
      // Flexible — takes remaining width; other columns are fixed.
      cellClassName: 'min-w-0',
      sort: false,
      renderCell: (row) => {
        if (!relationTargetFilterOpNeedsValue(row.op)) {
          return (
            <span className="text-[11px] text-slate-400" aria-hidden="true">—</span>
          );
        }
        return (
          <UiInput
            size="sm"
            autoDir={false}
            aiAssist={false}
            className="block w-full min-w-0 font-mono"
            value={row.value ?? ''}
            onChange={(event) => {
              onChange(updateRow(value, row.index, { value: event.target.value }));
            }}
            placeholder={row.op === 'in' ? 'a, b, c' : 'Value'}
            ariaLabel={`Target filter value ${row.index + 1}`}
          />
        );
      },
    },
    {
      id: 'actions',
      label: '',
      width: 44,
      headerClassName: APP_TABLE_GRID_ACTION_HEADER_CLASS,
      cellClassName: APP_TABLE_GRID_ACTION_CELL_CLASS,
      sort: false,
      filter: false,
      renderCell: (row) => (
        <button
          type="button"
          className={`${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_DELETE_CLASS}`}
          aria-label={`Remove condition ${row.index + 1}`}
          onClick={() => onChange(value.filter((_, rowIndex) => rowIndex !== row.index))}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ),
    },
  ], [onChange, targetColumns, value]);

  return (
    <FormSection
      title="Filter"
      hint="AND conditions on the related table. Form pickers only offer rows that match (e.g. active = true, parent_id is null)."
      ink="contrast"
      divided={divided}
      headerExtra={(
        <AppButton
          type="button"
          size="sm"
          intent="secondary"
          onClick={() => onChange([...value, createEmptyRelationTargetFilterCondition()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add condition
        </AppButton>
      )}
    >
      {tableRows.length > 0 ? (
        <AppTableGrid
          chrome="hero"
          size="xs"
          ariaLabel="Allowed target row conditions"
          scrollOwner="panel"
          stickyHeader={false}
          columns={columns}
          rows={tableRows}
          getRowKey={(row) => row.rowKey}
        />
      ) : (
        <p className="ps-[4px] text-xs text-slate-500">
          No filter — all target rows are allowed in the picker.
        </p>
      )}
    </FormSection>
  );
};
