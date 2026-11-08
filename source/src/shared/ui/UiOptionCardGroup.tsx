import React from 'react';
import { cn } from '../../lib/utils';
import { APP_SURFACE_BOX_TONE_CLASS, type AppSurfaceBoxTone } from './surfaceClasses';

export type UiOptionCardIcon = React.ComponentType<{ className?: string }>;

export type UiOptionCardOption = {
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Used in compact density when set; otherwise `description`. */
  shortDescription?: React.ReactNode;
  /** Extra line under the description. Hidden in compact density. */
  meta?: React.ReactNode;
  icon?: UiOptionCardIcon;
  disabled?: boolean;
  /** Per-option hue for border, icon, title, and selected wash. Visible at rest. */
  tone?: AppSurfaceBoxTone;
};

export type UiOptionCardGroupProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly UiOptionCardOption[];
  ariaLabel: string;
  /** Optional label above the card grid (label-over-input). */
  label?: string;
  disabled?: boolean;
  density?: 'default' | 'compact';
  /** Grid columns, or `auto` to wrap chips that hug their title. */
  columns?: 1 | 2 | 3 | 4 | 'auto';
  className?: string;
  /** Selected card border + light fill when the option has no `tone`. */
  accentClassName?: string;
  /** Selected title-icon color when the option has no `tone`. */
  accentIconClassName?: string;
};

const COLUMN_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

const optionToneChrome = (tone: AppSurfaceBoxTone, selected: boolean) => {
  const tokens = APP_SURFACE_BOX_TONE_CLASS[tone];
  return {
    card: selected
      ? tokens.strip
      : cn(tokens.shell, 'bg-white hover:bg-slate-50/70'),
    icon: tokens.title,
    title: tokens.title,
  };
};

/**
 * Exclusive title+description options as separate button boxes — no visible radio.
 * @see docs/standards/ui-core.md §Exclusive option cards
 */
export const UiOptionCardGroup: React.FC<UiOptionCardGroupProps> = ({
  value,
  onChange,
  options,
  ariaLabel,
  label,
  disabled = false,
  density = 'default',
  columns = 2,
  className,
  accentClassName = 'border-indigo-300 bg-indigo-50/50',
  accentIconClassName = 'text-indigo-700',
}) => {
  const isCompact = density === 'compact';
  const showLabel = Boolean(label);
  const isAuto = columns === 'auto';
  const buttonRefs = React.useRef(new Map<string, HTMLButtonElement | null>());
  const enabledValues = options
    .filter((option) => !(disabled || option.disabled))
    .map((option) => option.value);
  const tabStopValue = enabledValues.includes(value) ? value : (enabledValues[0] ?? '');

  const focusOption = (next: string) => {
    onChange(next);
    requestAnimationFrame(() => buttonRefs.current.get(next)?.focus());
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: string) => {
    if (disabled || enabledValues.length === 0) {
      return;
    }
    const index = enabledValues.indexOf(current);
    if (index < 0) {
      return;
    }
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % enabledValues.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + enabledValues.length) % enabledValues.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = enabledValues.length - 1;
    }
    if (nextIndex == null) {
      return;
    }
    const next = enabledValues[nextIndex];
    if (!next) {
      return;
    }
    event.preventDefault();
    focusOption(next);
  };

  return (
    <div className={cn('flex flex-col gap-[2px]', className, disabled && 'opacity-60 pointer-events-none')}>
      {showLabel ? (
        <p className={cn('ps-[4px] font-semibold text-slate-700', isCompact ? 'text-xs' : 'text-sm')}>
          {label}
        </p>
      ) : null}
      <div
        className={cn(
          showLabel ? 'mt-[2px]' : undefined,
          columns === 'auto' ? 'flex flex-wrap' : cn('grid items-stretch', COLUMN_CLASS[columns]),
          isCompact ? 'gap-1.5' : 'gap-2',
        )}
        role="radiogroup"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
      >
        {options.map((option) => {
          const selected = value === option.value;
          const OptionIcon = option.icon;
          const description = isCompact
            ? (option.shortDescription ?? option.description)
            : option.description;
          const optionDisabled = disabled || option.disabled;
          const toneChrome = option.tone ? optionToneChrome(option.tone, selected) : null;

          return (
            <button
              key={option.value}
              ref={(node) => {
                if (node) {
                  buttonRefs.current.set(option.value, node);
                } else {
                  buttonRefs.current.delete(option.value);
                }
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={optionDisabled}
              tabIndex={optionDisabled ? -1 : (option.value === tabStopValue ? 0 : -1)}
              onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
              onClick={() => {
                if (!optionDisabled) onChange(option.value);
              }}
              className={cn(
                'rounded-lg border text-start transition-colors',
                isAuto ? 'w-auto shrink-0' : 'w-full',
                toneChrome
                  ? toneChrome.card
                  : selected
                    ? accentClassName
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
              )}
            >
              <div className={cn('min-w-0', isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2.5')}>
                <div
                  className={cn(
                    'inline-flex min-w-0 items-start gap-1.5 font-semibold',
                    isCompact ? 'text-xs leading-snug' : 'text-sm leading-snug',
                    toneChrome ? toneChrome.title : 'text-slate-800',
                  )}
                >
                  {OptionIcon ? (
                    <OptionIcon
                      className={cn(
                        'mt-0.5 shrink-0',
                        isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4',
                        toneChrome
                          ? toneChrome.icon
                          : selected ? accentIconClassName : 'text-slate-500',
                      )}
                      aria-hidden
                    />
                  ) : null}
                  <span className={cn('min-w-0', isAuto ? 'whitespace-nowrap' : 'whitespace-normal')}>
                    {option.title}
                  </span>
                </div>
                {description ? (
                  <p
                    className={cn(
                      'mt-1 whitespace-pre-line break-words leading-snug text-slate-600',
                      isCompact ? 'text-[10px]' : 'text-xs',
                    )}
                  >
                    {description}
                  </p>
                ) : null}
                {!isCompact && option.meta ? (
                  <p className="mt-[2px] text-[11px] text-slate-400">{option.meta}</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
