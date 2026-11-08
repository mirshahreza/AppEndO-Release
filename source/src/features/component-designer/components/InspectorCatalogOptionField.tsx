import React from 'react';
import type { InspectorFieldSchema } from '../../../domain/component-designer/inspectorRegistry';
import { FormField, UiColorPicker, UiInput, UiSelect } from '../../../shared/ui';

type InspectorCatalogOptionFieldProps = {
  field: InspectorFieldSchema;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
};

const toSelectValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(String).join(',');
  return String(value);
};

/**
 * Thin adapter over the same Base Components catalog widgets
 * (`FormField` + `UiSelect` / `UiInput` / `UiColorPicker`) — not a parallel inspector kit.
 */
export const InspectorCatalogOptionField: React.FC<InspectorCatalogOptionFieldProps> = ({
  field,
  value,
  disabled = false,
  onChange,
}) => {
  const control = field.catalogControl;

  if (control === 'checkbox' || field.type === 'boolean') {
    return (
      <FormField label={field.label} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          value={value === true || value === 'true' ? 'yes' : 'no'}
          isDisabled={disabled}
          ariaLabel={field.label}
          onChange={(event) => onChange(event.target.value === 'yes')}
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </UiSelect>
      </FormField>
    );
  }

  if (field.options && (control === 'segmented' || control === 'select' || control === 'combobox' || field.type === 'select')) {
    return (
      <FormField label={field.label} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          value={toSelectValue(value)}
          isDisabled={disabled}
          ariaLabel={field.label}
          onChange={(event) => {
            const match = field.options?.find((option) => option.value === event.target.value);
            if (!match) {
              onChange(event.target.value);
              return;
            }
            if (match.value === 'true') onChange(true);
            else if (match.value === 'false') onChange(false);
            else if (/^-?\d+(\.\d+)?$/.test(match.value)) onChange(Number(match.value));
            else onChange(match.value);
          }}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </FormField>
    );
  }

  if (control === 'multi-select' && field.options) {
    const selected = Array.isArray(value)
      ? value.map(String)
      : toSelectValue(value).split(',').map((entry) => entry.trim()).filter(Boolean);
    return (
      <FormField label={field.label} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          multiple
          value={selected.join(',')}
          isDisabled={disabled}
          ariaLabel={field.label}
          placeholder="Select…"
          onChange={(event) => {
            const next = event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean);
            const matched = next.map((entry) => {
              if (entry === 'true') return true;
              if (entry === 'false') return false;
              if (/^-?\d+(\.\d+)?$/.test(entry)) return Number(entry);
              return entry;
            });
            onChange(matched);
          }}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </FormField>
    );
  }

  if (control === 'color') {
    return (
      <UiColorPicker
        size="sm"
        label={field.label}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        ariaLabel={field.label}
        onChange={onChange}
      />
    );
  }

  if (control === 'number-step' || control === 'range' || field.type === 'number') {
    return (
      <UiInput
        size="sm"
        type="number"
        autoDir={false}
        label={field.label}
        value={typeof value === 'number' ? value : ''}
        isDisabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    );
  }

  return (
    <UiInput
      size="sm"
      label={field.label}
      value={value === undefined || value === null ? '' : String(value)}
      isDisabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};
