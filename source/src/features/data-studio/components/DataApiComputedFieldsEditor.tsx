import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AppButton, FormField, UiInput, UiSelect } from '../../../shared/ui';
import type { ConfigureDataApiComputedField } from '../lib/configureDataApiTypes';

const COMPUTED_KIND_OPTIONS = [
  { value: 'scalar_subquery', label: 'Scalar subquery' },
  { value: 'aggregate', label: 'Aggregate expression' },
] as const;

const PLACEHOLDER_TABLE = '{{table}}';
const PLACEHOLDER_QUALIFIED_TABLE = '{{qualifiedTable}}';
const PLACEHOLDER_PK = '{{pk}}';

type DataApiComputedFieldsEditorProps = {
  computedFields: ConfigureDataApiComputedField[];
  onChange: (computedFields: ConfigureDataApiComputedField[]) => void;
};

const createComputedField = (): ConfigureDataApiComputedField => ({
  id: `computed_${Math.random().toString(36).slice(2, 9)}`,
  outputField: 'orderCount',
  kind: 'scalar_subquery',
  expression: '(SELECT COUNT(*) FROM orders o WHERE o.customer_id = {{qualifiedTable}}.{{pk}})',
});

export const DataApiComputedFieldsEditor: React.FC<DataApiComputedFieldsEditorProps> = ({
  computedFields,
  onChange,
}) => (
  <div className="flex flex-col gap-3">
    <p className="text-[11px] text-slate-500">
      Add per-row computed values using SQL expressions. Placeholders:
      {' '}
      <code className="font-mono text-[10px]">{PLACEHOLDER_TABLE}</code>
      ,
      {' '}
      <code className="font-mono text-[10px]">{PLACEHOLDER_QUALIFIED_TABLE}</code>
      ,
      {' '}
      <code className="font-mono text-[10px]">{PLACEHOLDER_PK}</code>
      .
    </p>

    {computedFields.map((field) => (
      <div key={field.id} className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Output field">
            <UiInput
              size="sm"
              autoDir={false}
              value={field.outputField}
              onChange={(event) => onChange(
                computedFields.map((item) => (
                  item.id === field.id ? { ...item, outputField: event.target.value } : item
                )),
              )}
            />
          </FormField>
          <FormField label="Kind">
            <UiSelect
              size="sm"
              selectedKey={field.kind}
              onSelectionChange={(key) => {
                if (!key) return;
                onChange(
                  computedFields.map((item) => (
                    item.id === field.id
                      ? { ...item, kind: String(key) as ConfigureDataApiComputedField['kind'] }
                      : item
                  )),
                );
              }}
            >
              {COMPUTED_KIND_OPTIONS.map((option) => (
                <UiSelect.Item key={option.value} id={option.value}>
                  {option.label}
                </UiSelect.Item>
              ))}
            </UiSelect>
          </FormField>
          <FormField label="SQL expression" className="md:col-span-2">
            <UiInput
              size="sm"
              autoDir={false}
              value={field.expression}
              onChange={(event) => onChange(
                computedFields.map((item) => (
                  item.id === field.id ? { ...item, expression: event.target.value } : item
                )),
              )}
            />
          </FormField>
        </div>
        <div className="mt-3 flex justify-end">
          <AppButton
            type="button"
            intent="cancel"
            size="sm"
            onClick={() => onChange(computedFields.filter((item) => item.id !== field.id))}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </AppButton>
        </div>
      </div>
    ))}

    <AppButton
      type="button"
      intent="secondary"
      size="sm"
      className="self-start"
      onClick={() => onChange([...computedFields, createComputedField()])}
    >
      <Plus className="h-3.5 w-3.5" />
      Add computed field
    </AppButton>
  </div>
);
