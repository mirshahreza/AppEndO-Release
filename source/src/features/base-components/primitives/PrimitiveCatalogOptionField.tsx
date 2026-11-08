import React from 'react';
import { FormField, UiInput, UiSelect, UiTextarea } from '../../../shared/ui';
import type { BaseComponentOptionMeta } from '../catalog/baseComponentOptionTypes';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { PrimitiveRepeaterField } from './PrimitiveRepeaterField';

type PrimitiveCatalogOptionFieldProps = {
  option: BaseComponentOptionMeta;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
};

const toSelectValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(String).join(',');
  return String(value);
};

const coerceOptionValue = (raw: string, candidates: readonly unknown[] | undefined): unknown => {
  const match = candidates?.find((candidate) => String(candidate) === raw);
  return match !== undefined ? match : raw;
};

const isLongText = (value: unknown): boolean => {
  const text = String(value ?? '');
  return text.length > 80 || text.startsWith('[') || text.startsWith('{');
};

export const PrimitiveCatalogOptionField: React.FC<PrimitiveCatalogOptionFieldProps> = ({
  option,
  value,
  disabled,
  onChange,
}) => {
  if (option.control === 'repeater' && option.recordFields?.length) {
    return (
      <PrimitiveRepeaterField
        label={option.label}
        itemLabel={option.recordItemLabel ?? 'item'}
        fields={option.recordFields}
        hasId={option.recordHasId !== false}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (option.control === 'checkbox') {
    return (
      <div data-bc-option={option.id}>
      <FormField label={option.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
          value={Boolean(value) ? 'yes' : 'no'}
          isDisabled={disabled}
          ariaLabel={option.label}
          onChange={(event) => onChange(event.target.value === 'yes')}
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </UiSelect>
      </FormField>
      </div>
    );
  }

  if (option.values && ['segmented', 'select', 'combobox', 'number-step'].includes(option.control)) {
    return (
      <div data-bc-option={option.id}>
      <FormField label={option.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
        <UiSelect
          size="sm"
          className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
          value={toSelectValue(value)}
          isDisabled={disabled}
          ariaLabel={option.label}
          onChange={(event) => onChange(coerceOptionValue(event.target.value, option.values))}
        >
          {option.values.map((candidate) => (
            <option key={String(candidate)} value={String(candidate)}>
              {String(candidate)}
            </option>
          ))}
        </UiSelect>
      </FormField>
      </div>
    );
  }

  if (option.control === 'text') {
    const Control = isLongText(value) ? UiTextarea : UiInput;
    return (
      <div data-bc-option={option.id}>
      <FormField label={option.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
        <Control
          size="sm"
          className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
          value={String(value ?? '')}
          isDisabled={disabled}
          ariaLabel={option.label}
          onChange={(event) => onChange(event.target.value)}
        />
      </FormField>
      </div>
    );
  }

  if (option.control === 'number-step' || option.control === 'range') {
    return (
      <div data-bc-option={option.id}>
      <FormField label={option.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
        <UiInput
          size="sm"
          type="number"
          autoDir={false}
          className={BASE_COMPONENTS_CONFIG_SPLIT_INPUT_CLASS}
          value={typeof value === 'number' ? value : ''}
          isDisabled={disabled}
          ariaLabel={option.label}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
        />
      </FormField>
      </div>
    );
  }

  return (
    <div data-bc-option={option.id}>
    <FormField label={option.label} className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
      <p className="text-xs text-slate-500">uses the section-specific {option.control} editor</p>
    </FormField>
    </div>
  );
};
