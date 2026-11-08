import React from 'react';
import { Switch } from '@heroui/react';
import { cn } from '../../lib/utils';

const HeroSwitch = Switch as React.FC<{
  isSelected?: boolean;
  isDisabled?: boolean;
  'aria-label'?: string;
  className?: string;
  onChange?: (selected: boolean) => void;
  children?: React.ReactNode;
}> & {
  Content: React.FC<{ children?: React.ReactNode; className?: string }>;
  Control: React.FC<{ children?: React.ReactNode }>;
  Thumb: React.FC;
};

export type UiSwitchProps = {
  isSelected?: boolean;
  isDisabled?: boolean;
  onChange?: (selected: boolean) => void;
  /** Visible label rendered beside the switch control. */
  label?: React.ReactNode;
  labelClassName?: string;
  className?: string;
  'aria-label'?: string;
};

/** Thin wrapper over HeroUI's `Switch` compound API (`Content`/`Control`/`Thumb`). */
export const UiSwitch: React.FC<UiSwitchProps> = ({
  isSelected,
  isDisabled,
  onChange,
  label,
  labelClassName,
  className,
  'aria-label': ariaLabel,
}) => (
  <HeroSwitch
    aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
    isSelected={isSelected}
    isDisabled={isDisabled}
    onChange={onChange}
    className={className}
  >
    <HeroSwitch.Content className={cn('inline-flex items-center', label ? 'gap-2' : 'gap-0')}>
      <HeroSwitch.Control>
        <HeroSwitch.Thumb />
      </HeroSwitch.Control>
      {label ? (
        <span className={cn('text-xs font-semibold text-slate-700', labelClassName)}>{label}</span>
      ) : null}
    </HeroSwitch.Content>
  </HeroSwitch>
);
