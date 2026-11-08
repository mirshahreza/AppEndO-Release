import React from 'react';
import { cn } from '../../lib/utils';
import { UiCheckbox, type HeroUiFieldSize } from './HeroFieldControls';

export const FEATURE_TOGGLE_TITLE_CLASS = 'text-sm font-semibold text-slate-800';
export const FEATURE_TOGGLE_TITLE_ACTIVE_CLASS = 'text-sm font-semibold text-slate-900';
export const FEATURE_TOGGLE_DESCRIPTION_CLASS = 'text-xs font-normal leading-relaxed text-slate-500';

export type FeatureToggleFieldProps = {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: React.ReactNode;
  description?: string;
  disabled?: boolean;
  size?: HeroUiFieldSize;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export const FeatureToggleField: React.FC<FeatureToggleFieldProps> = ({
  id,
  checked,
  onChange,
  title,
  description,
  disabled,
  size = 'sm',
  className,
  titleClassName,
  descriptionClassName,
}) => {
  const resolvedTitle = typeof title === 'string' ? (
    <span
      className={cn(
        'text-sm font-semibold',
        titleClassName ?? (checked ? FEATURE_TOGGLE_TITLE_ACTIVE_CLASS : FEATURE_TOGGLE_TITLE_CLASS),
      )}
    >
      {title}
    </span>
  ) : title;

  return (
    <div className={cn('flex flex-col gap-[2px]', className)}>
      <div className="flex items-center gap-2">
        <UiCheckbox
          id={id}
          checked={checked}
          disabled={disabled}
          size={size}
          onChange={(event) => onChange(event.target.checked)}
          className="shrink-0"
        />
        <label
          htmlFor={id}
          className={cn(
            'min-w-0 flex-1 cursor-pointer',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {resolvedTitle}
        </label>
      </div>
      {description ? (
        <p className={cn(FEATURE_TOGGLE_DESCRIPTION_CLASS, descriptionClassName)}>{description}</p>
      ) : null}
    </div>
  );
};
