import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  AppButton,
  AppSelectionToggle,
  APP_SELECTION_TOGGLE_WRAP_CLASS,
  AppSplitButton,
  SplitButtonMenuItem,
  UiCheckbox,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { SchemaFieldInfo } from '../../../shared/api/queries/data-sources';
import type { RouteFieldType, RouteValidationField } from '../lib/routeComposerTypes';

const VALIDATION_FIELDS_GRID_CLASS =
  'grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_85px_2.5rem]';
const VALIDATION_FIELDS_GRID_READONLY_CLASS =
  'grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_85px]';
const VALIDATION_FIELD_NAME_INPUT_CLASS =
  'h-8 min-w-0 w-full font-mono text-[11px] disabled:opacity-100';

const FIELD_TYPE_OPTIONS: Array<{ value: RouteFieldType; label: string }> = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
];

type DataApiColumnToggleButtonsProps = {
  selectedNames: string[];
  columnOptions: SchemaFieldInfo[];
  isColumnOptionsLoading?: boolean;
  disabled?: boolean;
  onChange: (selectedNames: string[]) => void;
};

const DataApiColumnToggleButtons: React.FC<DataApiColumnToggleButtonsProps> = ({
  selectedNames,
  columnOptions,
  isColumnOptionsLoading = false,
  disabled,
  onChange,
}) => {
  const selectedSet = new Set(selectedNames);

  if (isColumnOptionsLoading) {
    return <p className="text-[10px] text-slate-400">Loading column names...</p>;
  }

  if (columnOptions.length === 0) {
    return <p className="text-[10px] text-slate-400">No columns available.</p>;
  }

  return (
    <div className={APP_SELECTION_TOGGLE_WRAP_CLASS} role="group" aria-label="Column selection">
      {columnOptions.map((column) => {
        const selected = selectedSet.has(column.name);

        return (
          <AppSelectionToggle
            key={column.name}
            selected={selected}
            disabled={disabled}
            onClick={() => {
              if (selected) {
                onChange(selectedNames.filter((name) => name !== column.name));
                return;
              }
              onChange([...selectedNames, column.name]);
            }}
          >
            <span className="font-mono">{column.name}</span>
          </AppSelectionToggle>
        );
      })}
    </div>
  );
};

export type DataApiValidationFieldsEditorProps = {
  fields: RouteValidationField[];
  columnOptions: SchemaFieldInfo[];
  isColumnOptionsLoading?: boolean;
  columnOptionsError?: string | null;
  objectConfigured: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** When true, omit the section header row — parent supplies FormSection title/actions. */
  embedded?: boolean;
  onChange: (fields: RouteValidationField[]) => void;
};

export const DataApiValidationFieldsEditor: React.FC<DataApiValidationFieldsEditorProps> = ({
  fields,
  columnOptions,
  isColumnOptionsLoading = false,
  columnOptionsError = null,
  objectConfigured,
  disabled,
  readOnly = false,
  embedded = false,
  onChange,
}) => {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const isEditingDisabled = disabled || readOnly;

  const availableColumns = useMemo(() => {
    const usedNames = new Set(fields.map((field) => field.name).filter(Boolean));
    return columnOptions.filter((column) => !usedNames.has(column.name));
  }, [columnOptions, fields]);

  const addColumnField = (column: SchemaFieldInfo) => {
    onChange([
      ...fields,
      {
        id: `field-${Math.random().toString(36).slice(2, 9)}`,
        name: column.name,
        type: column.suggestedFieldType,
        required: !column.nullable,
      },
    ]);
    setAddMenuOpen(false);
  };

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', embedded ? 'h-full flex-1' : 'h-full')}>
      {!embedded ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {readOnly ? 'Input Parameters (read-only)' : 'Input Fields'}
          </span>
          {!readOnly ? (
            <AppSplitButton
              intent="secondary"
              size="sm"
              label="Add Field"
              icon={<Plus className="h-3 w-3" />}
              isOpen={addMenuOpen}
              onOpenChange={setAddMenuOpen}
              menuAriaLabel="Available columns"
              triggerAriaLabel="Add field"
              disabled={
                disabled
                || !objectConfigured
                || isColumnOptionsLoading
                || availableColumns.length === 0
              }
              menuClassName="max-h-56 min-w-[14rem] overflow-y-auto"
            >
              {availableColumns.map((column) => (
                <SplitButtonMenuItem
                  key={column.name}
                  onClick={() => addColumnField(column)}
                >
                  <span className="truncate font-mono">{column.name}</span>
                  <span className="shrink-0 text-slate-400">({column.dataType})</span>
                </SplitButtonMenuItem>
              ))}
            </AppSplitButton>
          ) : null}
        </div>
      ) : null}

      {!objectConfigured ? (
        <p className="shrink-0 text-[10px] text-slate-400">
          Edge model columns are required before configuring input fields.
        </p>
      ) : null}

      {columnOptionsError ? (
        <p className="shrink-0 text-[10px] text-red-600">{columnOptionsError}</p>
      ) : null}

      <div className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden',
        !embedded && 'rounded-lg border border-slate-200',
      )}>
        {fields.length > 0 ? (
          <>
            <div
              className={cn(
                'grid shrink-0 gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500',
                readOnly ? VALIDATION_FIELDS_GRID_READONLY_CLASS : VALIDATION_FIELDS_GRID_CLASS,
              )}
            >
              <span>Field Name</span>
              <span>Data Type</span>
              <span className="text-center">Required</span>
              {!readOnly ? <span /> : null}
            </div>
            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={cn(
                    'grid items-center gap-2 px-3 py-2',
                    readOnly ? VALIDATION_FIELDS_GRID_READONLY_CLASS : VALIDATION_FIELDS_GRID_CLASS,
                  )}
                >
                  <UiInput
                    size="sm"
                    value={field.name}
                    disabled
                    readOnly
                    ariaLabel={`Field name ${field.name || 'empty'}`}
                    placeholder={isColumnOptionsLoading ? 'Loading columns...' : '—'}
                    className={VALIDATION_FIELD_NAME_INPUT_CLASS}
                  />
                  <UiSelect
                    value={field.type}
                    disabled={isEditingDisabled}
                    className="h-8 min-w-0 w-full text-[11px]"
                    onChange={(event) => {
                      onChange(fields.map((item) => (
                        item.id === field.id
                          ? { ...item, type: event.target.value as RouteFieldType }
                          : item
                      )));
                    }}
                  >
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </UiSelect>
                  <div className="flex w-[85px] justify-center">
                    <UiCheckbox
                      checked={field.required}
                      disabled={isEditingDisabled}
                      onChange={(event) => {
                        onChange(fields.map((item) => (
                          item.id === field.id ? { ...item, required: event.target.checked } : item
                        )));
                      }}
                      className="h-4 w-4"
                    />
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(fields.filter((item) => item.id !== field.id))}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-slate-50/70 px-3 py-8 text-center text-[11px] text-slate-500">
            {isColumnOptionsLoading
              ? 'Loading column names...'
              : columnOptions.length > 0
                ? 'No input fields yet. Use Add Field to pick columns from the edge model.'
                : 'No input fields yet. Add fields to define the allowed request body shape.'}
          </div>
        )}
      </div>
    </div>
  );
};

export type DataApiOutputFieldsEditorProps = {
  outputFields: string[];
  columnOptions: SchemaFieldInfo[];
  isColumnOptionsLoading?: boolean;
  disabled?: boolean;
  /** When true, omit the section header row — parent supplies FormSection title/actions. */
  embedded?: boolean;
  onChange: (outputFields: string[]) => void;
};

export const DataApiOutputFieldsEditor: React.FC<DataApiOutputFieldsEditorProps> = ({
  outputFields,
  columnOptions,
  isColumnOptionsLoading = false,
  disabled,
  embedded = false,
  onChange,
}) => {
  const selectedSet = new Set(outputFields);
  const allSelected = columnOptions.length > 0 && columnOptions.every((column) => selectedSet.has(column.name));

  const toggleList = (
    <DataApiColumnToggleButtons
      selectedNames={outputFields}
      columnOptions={columnOptions}
      isColumnOptionsLoading={isColumnOptionsLoading}
      disabled={disabled}
      onChange={onChange}
    />
  );

  if (embedded) {
    return toggleList;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Output Fields
        </span>
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          disabled={disabled || columnOptions.length === 0}
          onClick={() => (allSelected ? onChange([]) : onChange(columnOptions.map((column) => column.name)))}
        >
          {allSelected ? 'Clear All' : 'Select All'}
        </AppButton>
      </div>
      <p className="text-[10px] text-slate-500">
        Choose which columns are returned in the response. Leave none selected to return all columns.
      </p>
      {toggleList}
    </div>
  );
};

export type DataApiInputFieldsToggleEditorProps = {
  fields: RouteValidationField[];
  columnOptions: SchemaFieldInfo[];
  isColumnOptionsLoading?: boolean;
  disabled?: boolean;
  embedded?: boolean;
  onChange: (fields: RouteValidationField[]) => void;
};

export const DataApiInputFieldsToggleEditor: React.FC<DataApiInputFieldsToggleEditorProps> = ({
  fields,
  columnOptions,
  isColumnOptionsLoading = false,
  disabled,
  embedded = false,
  onChange,
}) => {
  const selectedNames = fields.map((field) => field.name);
  const allSelected = columnOptions.length > 0
    && columnOptions.every((column) => selectedNames.includes(column.name));

  const handleSelectedNamesChange = (names: string[]) => {
    const existingByName = new Map(fields.map((field) => [field.name, field]));
    onChange(names.map((name) => {
      const existing = existingByName.get(name);
      if (existing) return existing;

      const column = columnOptions.find((item) => item.name === name);
      return {
        id: `field-${Math.random().toString(36).slice(2, 9)}`,
        name,
        type: column?.suggestedFieldType ?? 'string',
        required: column ? !column.nullable : false,
      };
    }));
  };

  const toggleList = (
    <DataApiColumnToggleButtons
      selectedNames={selectedNames}
      columnOptions={columnOptions}
      isColumnOptionsLoading={isColumnOptionsLoading}
      disabled={disabled}
      onChange={handleSelectedNamesChange}
    />
  );

  if (embedded) {
    return toggleList;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Input Fields
        </span>
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          disabled={disabled || columnOptions.length === 0}
          onClick={() => (
            allSelected
              ? onChange([])
              : handleSelectedNamesChange(columnOptions.map((column) => column.name))
          )}
        >
          {allSelected ? 'Clear All' : 'Select All'}
        </AppButton>
      </div>
      <p className="text-[10px] text-slate-500">
        Choose which columns callers may send in the request body.
      </p>
      {toggleList}
    </div>
  );
};
