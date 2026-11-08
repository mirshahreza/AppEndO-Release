import React from 'react';
import { FormField } from './FormSection';
import { UiCheckbox, UiSelect } from './HeroFieldControls';

export type ConfigBoolVariant = 'yes-no' | 'on-off';

export type ConfigBoolFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  fieldClassName?: string;
  selectClassName?: string;
  disabled?: boolean;
  /** Data-entry surfaces (RecordForm) keep checkbox; configurators use select. */
  control?: 'select' | 'checkbox';
  variant?: ConfigBoolVariant;
  ariaLabel?: string;
};

const toSelectValue = (checked: boolean, variant: ConfigBoolVariant) =>
  (variant === 'on-off' ? (checked ? 'on' : 'off') : (checked ? 'yes' : 'no'));

const fromSelectValue = (value: string, variant: ConfigBoolVariant) =>
  (variant === 'on-off' ? value === 'on' : value === 'yes');

/** Labeled boolean for configurators (yes/no select) or forms (checkbox). */
export const ConfigBoolField: React.FC<ConfigBoolFieldProps> = ({
  label,
  checked,
  onChange,
  fieldClassName,
  selectClassName,
  disabled,
  control = 'select',
  variant = 'yes-no',
  ariaLabel,
}) => {
  if (control === 'checkbox') {
    return (
      <div className={fieldClassName}>
        <UiCheckbox
          size="sm"
          checked={checked}
          className="flex w-full min-w-0 items-start gap-2"
          isDisabled={disabled}
          ariaLabel={ariaLabel ?? label}
          onChange={(event) => onChange(event.target.checked)}
        >
          {label}
        </UiCheckbox>
      </div>
    );
  }

  return (
    <FormField label={label} className={fieldClassName} reserveHintSlot={false}>
      <UiSelect
        size="sm"
        className={selectClassName}
        value={toSelectValue(checked, variant)}
        isDisabled={disabled}
        ariaLabel={ariaLabel ?? label}
        onChange={(event) => onChange(fromSelectValue(event.target.value, variant))}
      >
        {variant === 'on-off' ? (
          <>
            <option value="on">on</option>
            <option value="off">off</option>
          </>
        ) : (
          <>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </>
        )}
      </UiSelect>
    </FormField>
  );
};
