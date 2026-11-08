import React from 'react';
import { cn } from '../../../lib/utils';

export const NAVIGATION_GROUPED_FIELD_SHELL_CLASS =
  'flex h-8 w-full items-stretch overflow-hidden rounded-[6px] border border-slate-300 bg-white shadow-sm transition-[border-color,box-shadow] focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/25';

export const NAVIGATION_GROUPED_SEGMENT_DIVIDER_CLASS = 'border-slate-200';

export const NAVIGATION_GROUPED_FIELD_INPUT_CLASS =
  'h-8 w-full min-w-0 border-0 bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400';

export const NAVIGATION_GROUPED_FIELD_DISPLAY_CLASS =
  'flex h-8 w-full min-w-0 items-center gap-2 px-3 text-sm text-slate-700';

export const NAVIGATION_GROUPED_ACTION_BUTTON_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:bg-slate-50 focus-visible:text-indigo-700';

type TailwindColorSwatchProps = {
  className: string;
  size?: 'sm' | 'md';
};

export const TailwindColorSwatch: React.FC<TailwindColorSwatchProps> = ({
  className,
  size = 'sm',
}) => (
  <span className={cn('inline-flex shrink-0 items-center justify-center', className)} aria-hidden>
    <span
      className={cn(
        'rounded-full bg-current ring-1 ring-inset ring-black/10',
        size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5',
      )}
    />
  </span>
);

export const NAVIGATION_GROUPED_FIELD_DISABLED_CLASS =
  'bg-slate-50 border-slate-200 shadow-none focus-within:border-slate-200 focus-within:ring-0';

type NavigationGroupedFieldProps = {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export const NavigationGroupedField: React.FC<NavigationGroupedFieldProps> = ({
  leading,
  trailing,
  children,
  className,
  disabled = false,
}) => (
  <div
    className={cn(
      NAVIGATION_GROUPED_FIELD_SHELL_CLASS,
      disabled && NAVIGATION_GROUPED_FIELD_DISABLED_CLASS,
      className,
    )}
  >
    {leading ? (
      <div
        className={cn(
          'flex shrink-0 items-stretch border-e',
          NAVIGATION_GROUPED_SEGMENT_DIVIDER_CLASS,
        )}
      >
        {leading}
      </div>
    ) : null}
    <div className="flex min-w-0 flex-1 items-center">{children}</div>
    {trailing ? (
      <div
        className={cn(
          'flex shrink-0 items-stretch border-s',
          NAVIGATION_GROUPED_SEGMENT_DIVIDER_CLASS,
        )}
      >
        {trailing}
      </div>
    ) : null}
  </div>
);

type NavigationGroupedPickerButtonProps = {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
};

export const NavigationGroupedPickerButton: React.FC<NavigationGroupedPickerButtonProps> = ({
  ariaLabel,
  onClick,
  children,
  className,
}) => (
  <button
    type="button"
    tabIndex={-1}
    className={cn(NAVIGATION_GROUPED_ACTION_BUTTON_CLASS, className)}
    aria-label={ariaLabel}
    onClick={onClick}
  >
    {children}
  </button>
);
