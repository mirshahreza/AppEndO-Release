import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AppButton, FormField, UiInput, UiSelect, UiTextarea } from '../../../shared/ui';
import type { BaseComponentRecordFieldDef } from '../catalog/baseComponentOptionTypes';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';

type PrimitiveRepeaterFieldProps = {
  label: string;
  itemLabel: string;
  fields: readonly BaseComponentRecordFieldDef[];
  hasId: boolean;
  value: unknown;
  disabled: boolean;
  onChange: (value: Record<string, unknown>[]) => void;
};

const coerceRecords = (raw: unknown): Record<string, unknown>[] => {
  if (Array.isArray(raw)) {
    return raw.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) as Record<string, unknown>[];
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? coerceRecords(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const emptyRecord = (
  fields: readonly BaseComponentRecordFieldDef[],
  hasId: boolean,
  index: number,
): Record<string, unknown> => {
  const record: Record<string, unknown> = {};
  if (hasId) record.id = `item-${Date.now()}-${index}`;
  for (const field of fields) {
    record[field.key] = field.control === 'checkbox' ? false : '';
  }
  return record;
};

export const PrimitiveRepeaterField: React.FC<PrimitiveRepeaterFieldProps> = ({
  label,
  itemLabel,
  fields,
  hasId,
  value,
  disabled,
  onChange,
}) => {
  const records = coerceRecords(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-600">{label}</p>
        <AppButton
          intent="utility"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...records, emptyRecord(fields, hasId, records.length)])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add {itemLabel}
        </AppButton>
      </div>
      {records.length === 0 ? (
        <p className="text-xs text-slate-500">No {itemLabel}s yet.</p>
      ) : null}
      {records.map((record, index) => (
        <div key={String(record.id ?? index)} className="space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-slate-500">
              {itemLabel} {index + 1}
            </p>
            <AppButton
              intent="utility"
              size="sm"
              disabled={disabled}
              aria-label={`Remove ${itemLabel} ${index + 1}`}
              onClick={() => onChange(records.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </AppButton>
          </div>
          {fields.map((field) => {
            const fieldValue = record[field.key];
            if (field.control === 'checkbox') {
              return (
                <FormField key={field.key} label={field.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={fieldValue === true || fieldValue === 'true' ? 'yes' : 'no'}
                    isDisabled={disabled}
                    ariaLabel={field.label}
                    onChange={(event) => {
                      const next = records.map((entry, itemIndex) => (
                        itemIndex === index
                          ? { ...entry, [field.key]: event.target.value === 'yes' }
                          : entry
                      ));
                      onChange(next);
                    }}
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </UiSelect>
                </FormField>
              );
            }
            const Control = field.control === 'textarea' ? UiTextarea : UiInput;
            return (
              <FormField key={field.key} label={field.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                <Control
                  size="sm"
                  className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
                  value={String(fieldValue ?? '')}
                  isDisabled={disabled}
                  placeholder={field.placeholder}
                  ariaLabel={field.label}
                  onChange={(event) => {
                    const next = records.map((entry, itemIndex) => (
                      itemIndex === index
                        ? { ...entry, [field.key]: event.target.value }
                        : entry
                    ));
                    onChange(next);
                  }}
                />
              </FormField>
            );
          })}
        </div>
      ))}
    </div>
  );
};
