import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { FormField, UiCheckboxChoice, UiInput, UiSelect, UiTextarea } from '../../../shared/ui';
import { isAttributeValueItemEditable } from '../../../shared/api/contracts/attributes/editPolicy';
import { isSystemManagedUserAttributeKey } from '../../../shared/api/contracts/attributes/builtInAttributes';
import type { AttributeValueItem } from '../../../shared/api/contracts/attributes/types';
import { getAttributeFieldLabel } from '../../../shared/api/queries/attributeValues';
import { useBaseInfoOptionsQuery } from '../../../shared/api/queries/base-info';
import { useCultureT } from '../../../core/culture/CultureContext';

const toStringValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const toBooleanValue = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  return false;
};

const toJsonValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
};

const resolveBaseInfoRootId = (definition: AttributeValueItem['settingsAttribute']): string | null => {
  if (definition.source_type === 'BASE_INFO') {
    return definition.base_info_root_id;
  }
  return null;
};

type AttributeFieldProps = {
  item: AttributeValueItem;
  value: unknown;
  disabled?: boolean;
  readOnly?: boolean;
  onValueChange: (settingsAttributeId: number, value: unknown) => void;
};

const AttributeField: React.FC<AttributeFieldProps> = ({
  item,
  value,
  disabled = false,
  readOnly = false,
  onValueChange,
}) => {
  const t = useCultureT();
  const definition = item.settingsAttribute;
  const label = getAttributeFieldLabel(item, t);
  const requiredMark = definition.is_required ? ' *' : '';
  const baseInfoRootId = resolveBaseInfoRootId(definition);
  const optionsQuery = useBaseInfoOptionsQuery(baseInfoRootId);
  const options = optionsQuery.data ?? [];
  const fieldDisabled = disabled || readOnly;

  if (baseInfoRootId) {
    if (definition.cardinality === 'multi') {
      const selected = toStringArray(value);
      const max = definition.max_selections;
      const atMax = max !== null && selected.length >= max;
      const maxHint = max !== null ? ` (max ${max})` : '';

      return (
        <FormField label={`${label}${maxHint}`} required={definition.is_required}>
          {optionsQuery.isLoading ? (
            <p className="text-xs text-slate-400 ps-[4px]">Loading options...</p>
          ) : options.length === 0 ? (
            <p className="text-xs text-slate-400 ps-[4px]">No options available.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {options.map((option) => {
                const checked = selected.includes(option.id);
                const optionDisabled = fieldDisabled || (!checked && atMax);
                return (
                  <UiCheckboxChoice
                    key={option.id}
                    checked={checked}
                    disabled={optionDisabled}
                    onChange={(nextChecked) => {
                      const next = nextChecked
                        ? [...selected, option.id]
                        : selected.filter((code) => code !== option.id);
                      onValueChange(definition.id, next);
                    }}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                      checked
                        ? 'bg-violet-50/80 text-violet-800'
                        : 'text-slate-700 hover:bg-slate-50',
                      optionDisabled && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {option.label}
                  </UiCheckboxChoice>
                );
              })}
            </div>
          )}
        </FormField>
      );
    }

    return (
      <FormField label={label} required={definition.is_required}>
        <UiSelect
          size="sm"
          value={toStringValue(value)}
          disabled={fieldDisabled || optionsQuery.isLoading}
          onChange={(e) => onValueChange(definition.id, e.target.value || null)}
        >
          <option value="">{optionsQuery.isLoading ? 'Loading...' : `Select ${label.toLowerCase()}...`}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </UiSelect>
      </FormField>
    );
  }

  if (definition.cardinality === 'multi') {
    const selected = toStringArray(value);
    const max = definition.max_selections;
    const maxHint = max !== null ? ` (max ${max})` : '';

    return (
      <FormField label={`${label}${maxHint}`} required={definition.is_required}>
        <UiTextarea
          size="sm"
          autoDir={false}
          rows={3}
          disabled={fieldDisabled}
          value={selected.join('\n')}
          placeholder="One value per line"
          className="font-mono"
          onChange={(e) => {
            const lines = e.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean);
            if (definition.data_type === 'number') {
              onValueChange(definition.id, lines.map((line) => Number(line)));
              return;
            }
            onValueChange(definition.id, lines);
          }}
        />
      </FormField>
    );
  }

  if (definition.data_type === 'boolean') {
    return (
      <UiCheckboxChoice
        checked={toBooleanValue(value)}
        disabled={fieldDisabled}
        onChange={(checked) => onValueChange(definition.id, checked)}
        className={cn(
          'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
          toBooleanValue(value)
            ? 'bg-emerald-50/80 text-emerald-800'
            : 'text-slate-700 hover:bg-slate-50',
          fieldDisabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {label}{requiredMark}
      </UiCheckboxChoice>
    );
  }

  if (definition.data_type === 'json') {
    return (
      <FormField label={label} required={definition.is_required}>
        <UiTextarea
          size="sm"
          autoDir={false}
          rows={4}
          disabled={fieldDisabled}
          value={toJsonValue(value)}
          placeholder='{"key": "value"}'
          className="font-mono"
          onChange={(e) => onValueChange(definition.id, e.target.value)}
        />
      </FormField>
    );
  }

  return (
    <FormField label={label} required={definition.is_required}>
      <UiInput
        size="sm"
        type={definition.data_type === 'number' ? 'number' : 'text'}
        disabled={fieldDisabled}
        value={toStringValue(value)}
        placeholder={`Enter ${label.toLowerCase()}...`}
        onChange={(e) => {
          const next = e.target.value;
          if (definition.data_type === 'number') {
            onValueChange(definition.id, next === '' ? null : Number(next));
            return;
          }
          onValueChange(definition.id, next);
        }}
      />
    </FormField>
  );
};

export type AttributeValuesFormProps = {
  items: AttributeValueItem[];
  valuesBySettingsAttributeId: Record<number, unknown>;
  onValueChange: (settingsAttributeId: number, value: unknown) => void;
  disabled?: boolean;
};

export const AttributeValuesForm: React.FC<AttributeValuesFormProps> = ({
  items,
  valuesBySettingsAttributeId,
  onValueChange,
  disabled = false,
}) => {
  const sortedItems = useMemo(
    () => [...items]
      .filter((item) => !isSystemManagedUserAttributeKey(item.settingsAttribute.key))
      .sort((a, b) => {
        const orderDiff = a.settingsAttribute.view_order - b.settingsAttribute.view_order;
        if (orderDiff !== 0) return orderDiff;
        return a.settingsAttribute.key.localeCompare(b.settingsAttribute.key);
      }),
    [items],
  );

  if (sortedItems.length === 0) {
    return (
      <p className="text-xs font-medium leading-relaxed text-slate-500 ps-[4px]">
        No active attribute definitions configured in Settings.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {sortedItems.map((item) => (
        <AttributeField
          key={item.settingsAttribute.id}
          item={item}
          value={valuesBySettingsAttributeId[item.settingsAttribute.id] ?? item.value ?? null}
          disabled={disabled}
          readOnly={!isAttributeValueItemEditable(item)}
          onValueChange={onValueChange}
        />
      ))}
    </div>
  );
};
