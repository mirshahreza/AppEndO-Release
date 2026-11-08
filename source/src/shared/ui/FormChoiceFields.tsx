import React from 'react';
import { cn } from '../../lib/utils';
import {
  UiCheckbox,
  UiRadioGroup,
  UI_CHOICE_STACK_GAP_CLASS,
  type HeroUiFieldSize,
  type UiRadioOption,
  resolveUiChoiceLabelRowClass,
} from './HeroFieldControls';
import { resolveChoiceBoxShellClass } from './formChoiceLayout';

export type UiCheckboxChoiceProps = {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: HeroUiFieldSize;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Single boxed-list checkbox row — control left, label right. */
export const UiCheckboxChoice: React.FC<UiCheckboxChoiceProps> = ({
  id,
  checked,
  onChange,
  size = 'sm',
  disabled,
  className,
  children,
}) => (
  <UiCheckbox
    id={id}
    size={size}
    checked={checked}
    isDisabled={disabled}
    onChange={(event) => onChange(event.target.checked)}
    className={resolveUiChoiceLabelRowClass(size, className)}
  >
    {children}
  </UiCheckbox>
);

export type UiCheckboxChoiceListOption = {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export type UiCheckboxChoiceListProps = {
  options: UiCheckboxChoiceListOption[];
  size?: HeroUiFieldSize;
  disabled?: boolean;
  className?: string;
  /** Prefix for auto-generated option ids (`${idPrefix}-${option.id}`). */
  idPrefix?: string;
  /** Default `vertical`. */
  orientation?: 'vertical' | 'horizontal';
};

/** Bordered checkbox list for form sections — vertical stack by default; optional horizontal wrap. */
export const UiCheckboxChoiceList: React.FC<UiCheckboxChoiceListProps> = ({
  options,
  size = 'sm',
  disabled,
  className,
  idPrefix = 'checkbox-choice',
  orientation = 'vertical',
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        resolveChoiceBoxShellClass(disabled),
        isHorizontal && '!flex-row !flex-wrap items-center gap-x-5 gap-y-1',
        className,
      )}
      role="group"
    >
      {options.map((option) => (
        <UiCheckboxChoice
          key={option.id}
          id={`${idPrefix}-${option.id}`}
          checked={option.checked}
          onChange={option.onChange}
          size={size}
          disabled={disabled || option.disabled}
          className={isHorizontal ? '!w-auto' : undefined}
        >
          {option.label}
        </UiCheckboxChoice>
      ))}
    </div>
  );
};

export type UiCheckboxChoiceGroupProps = {
  options: UiCheckboxChoiceListOption[];
  size?: HeroUiFieldSize;
  disabled?: boolean;
  className?: string;
  idPrefix?: string;
};

/** Unboxed stacked checkbox list — same rows as `UiCheckboxChoiceList` without the shell. */
export const UiCheckboxChoiceGroup: React.FC<UiCheckboxChoiceGroupProps> = ({
  options,
  size = 'sm',
  disabled,
  className,
  idPrefix = 'checkbox-choice',
}) => (
  <div className={cn('flex flex-col', UI_CHOICE_STACK_GAP_CLASS, className)} role="group">
    {options.map((option) => (
      <UiCheckboxChoice
        key={option.id}
        id={`${idPrefix}-${option.id}`}
        checked={option.checked}
        onChange={option.onChange}
        size={size}
        disabled={disabled || option.disabled}
      >
        {option.label}
      </UiCheckboxChoice>
    ))}
  </div>
);

export type UiRadioChoiceGroupProps = {
  value: string;
  onChange: (value: string) => void;
  options: UiRadioOption[];
  size?: HeroUiFieldSize;
  disabled?: boolean;
  ariaLabel: string;
  name?: string;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
};

/** Unboxed radio list — same rows as `UiRadioChoiceList` without the shell. */
export const UiRadioChoiceGroup: React.FC<UiRadioChoiceGroupProps> = ({
  value,
  onChange,
  options,
  size = 'sm',
  disabled,
  ariaLabel,
  name,
  className,
  orientation = 'vertical',
}) => (
  <UiRadioGroup
    name={name}
    value={value}
    onChange={onChange}
    options={options}
    size={size}
    isDisabled={disabled}
    layout="stack"
    orientation={orientation}
    ariaLabel={ariaLabel}
    className={className}
  />
);

export type UiRadioChoiceListProps = {
  value: string;
  onChange: (value: string) => void;
  options: UiRadioOption[];
  size?: HeroUiFieldSize;
  disabled?: boolean;
  ariaLabel: string;
  name?: string;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
};

/** Bordered radio list for form sections — vertical stack by default; optional horizontal wrap. */
export const UiRadioChoiceList: React.FC<UiRadioChoiceListProps> = ({
  value,
  onChange,
  options,
  size = 'sm',
  disabled,
  ariaLabel,
  name,
  className,
  orientation = 'vertical',
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        resolveChoiceBoxShellClass(disabled),
        isHorizontal && '!flex-row !flex-wrap items-center gap-x-5 gap-y-1',
        className,
      )}
      role="presentation"
    >
      <UiRadioGroup
        name={name}
        value={value}
        onChange={onChange}
        options={options}
        size={size}
        isDisabled={disabled}
        layout={isHorizontal ? 'stack' : 'contents'}
        orientation={orientation}
        optionClassName={isHorizontal ? '!w-auto' : undefined}
        ariaLabel={ariaLabel}
      />
    </div>
  );
};
