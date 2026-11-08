import React from 'react';
import { ProgressBar } from '@heroui/react';
import { cn } from '../../lib/utils';

const HeroProgressBar = ProgressBar as any;

export type UiProgressColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';
export type UiProgressSize = 'sm' | 'md' | 'lg';

export type UiProgressProps = {
  value?: number;
  minValue?: number;
  maxValue?: number;
  isIndeterminate?: boolean;
  label?: string;
  /** Shows the percentage/value text next to the bar. Default false. */
  showOutput?: boolean;
  color?: UiProgressColor;
  size?: UiProgressSize;
  className?: string;
};

export const UI_PROGRESS_TRACK_SIZE_CLASS: Record<UiProgressSize, string> = {
  sm: 'h-2 min-h-2',
  md: 'h-2.5 min-h-2.5',
  lg: 'h-3.5 min-h-3.5',
};

export const UI_PROGRESS_TRACK_TONE_CLASS: Record<UiProgressColor, string> = {
  default: 'bg-slate-200',
  accent: 'bg-primary/20',
  success: 'bg-emerald-100',
  warning: 'bg-amber-100',
  danger: 'bg-rose-100',
};

export const UI_PROGRESS_FILL_TONE_CLASS: Record<UiProgressColor, string> = {
  default: 'bg-slate-500',
  accent: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

/** Thin wrapper over HeroUI's `ProgressBar` compound API (`Track`/`Fill`/`Output`). */
export const UiProgress: React.FC<UiProgressProps> = ({
  value,
  minValue,
  maxValue,
  isIndeterminate,
  label,
  showOutput = false,
  color = 'accent',
  size = 'sm',
  className,
}) => {
  const empty = !isIndeterminate && (value ?? 0) <= 0;

  return (
    <HeroProgressBar
      value={value}
      minValue={minValue}
      maxValue={maxValue}
      isIndeterminate={isIndeterminate}
      aria-label={label}
      color={color}
      size={size}
      className={cn('flex w-full min-w-0 flex-col', className)}
    >
      {label ? (
        <span className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-xs font-semibold text-slate-700">{label}</span>
          {showOutput ? (
            <HeroProgressBar.Output className="shrink-0 text-sm font-bold tabular-nums text-slate-900" />
          ) : null}
        </span>
      ) : null}
      <HeroProgressBar.Track
        className={cn(
          'w-full overflow-hidden rounded-full',
          UI_PROGRESS_TRACK_SIZE_CLASS[size],
          UI_PROGRESS_TRACK_TONE_CLASS[color],
        )}
      >
        <HeroProgressBar.Fill
          className={cn(
            'rounded-full',
            UI_PROGRESS_FILL_TONE_CLASS[color],
            empty && 'min-w-0 !w-0',
          )}
        />
      </HeroProgressBar.Track>
    </HeroProgressBar>
  );
};
