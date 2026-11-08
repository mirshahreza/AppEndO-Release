import React from 'react';
import { INSPECTOR_TEXT_2XS, INSPECTOR_TEXT_XS } from './inspectorDesignTokens';

/** Official micro-caption class for nested Inspector field labels (Phase 4). */
export const INSPECTOR_MICRO_LABEL_CLASS = `${INSPECTOR_TEXT_2XS} font-semibold text-slate-500 ps-[4px]`;

/** Toggle-chip row shell (Phase 6) — independent boolean options in one wrap line. */
export const INSPECTOR_TOGGLE_CHIP_GROUP_CLASS = 'flex flex-wrap items-center gap-1.5';

/** Inactive chip: gray outline. Active chip: filled primary (indigo from Phase 1 tone map). */
export const INSPECTOR_TOGGLE_CHIP_INACTIVE_CLASS =
  `inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 ${INSPECTOR_TEXT_XS} font-medium text-slate-600 outline-none transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-40`;

export const INSPECTOR_TOGGLE_CHIP_ACTIVE_CLASS =
  `inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-indigo-600 bg-indigo-600 px-2.5 ${INSPECTOR_TEXT_XS} font-medium text-white outline-none transition-colors hover:border-indigo-700 hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-40`;

/**
 * Segmented control shell for exclusive short choices (Phase 6).
 * Visual inspiration from `CANVAS_SEGMENTED_CONTROL_CLASS` (divide-x / outer border) —
 * not a direct reuse (canvas control is icon-square / different interaction).
 */
export const INSPECTOR_SEGMENTED_CONTROL_CLASS =
  'inline-flex h-8 max-w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm divide-x divide-slate-200';

export const INSPECTOR_SEGMENTED_OPTION_INACTIVE_CLASS =
  `inline-flex h-full min-w-[2.75rem] flex-1 items-center justify-center px-2.5 ${INSPECTOR_TEXT_XS} font-medium text-slate-600 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-40`;

export const INSPECTOR_SEGMENTED_OPTION_ACTIVE_CLASS =
  `inline-flex h-full min-w-[2.75rem] flex-1 items-center justify-center bg-indigo-600 px-2.5 ${INSPECTOR_TEXT_XS} font-medium text-white outline-none transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-40`;

/**
 * Webflow-style non-default value cue for collapsed Inspector section headers (Phase 3).
 * Prefer a count badge when a number is meaningful; otherwise a small activity dot.
 */
export const InspectorSectionValueBadge: React.FC<{
  count?: number;
  label?: string;
  active?: boolean;
}> = ({ count, label, active = true }) => {
  if (!active) {
    return null;
  }

  if (typeof count === 'number' || (label && label.length > 0)) {
    return (
      <span
        data-inspector-value-indicator={typeof count === 'number' ? 'count' : 'label'}
        className={`inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 ${INSPECTOR_TEXT_2XS} font-medium text-slate-600`}
      >
        {label ?? `${count}`}
      </span>
    );
  }

  return (
    <span
      data-inspector-value-indicator="dot"
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
      aria-hidden
    />
  );
};

type InspectorMicroLabelProps = {
  children: React.ReactNode;
  /** Optional extra classes (e.g. spacing) — base caption token stays fixed. */
  className?: string;
};

/**
 * Shared micro-caption for nested Inspector controls.
 * Replaces the duplicated `text-[10px] font-semibold text-slate-500` caption pattern.
 */
export const InspectorMicroLabel: React.FC<InspectorMicroLabelProps> = ({
  children,
  className,
}) => (
  <span className={[INSPECTOR_MICRO_LABEL_CLASS, className].filter(Boolean).join(' ')}>
    {children}
  </span>
);

type InspectorFieldGroupProps = {
  title?: string;
  children: React.ReactNode;
  columns?: 1 | 2;
  /** Extra classes on the grid (e.g. border-t, nested-layer ring). */
  className?: string;
};

/**
 * Compact multi-column grid for related short Inspector fields
 * (Figma X/Y/W/H pattern — Phase 4 / audit §3.1).
 */
export const InspectorFieldGroup: React.FC<InspectorFieldGroupProps> = ({
  title,
  children,
  columns = 2,
  className,
}) => {
  const gridClass = columns === 1 ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2';
  return (
    <div className={[gridClass, className].filter(Boolean).join(' ')}>
      {title ? (
        <div className={columns === 2 ? 'col-span-2' : undefined}>
          <InspectorMicroLabel>{title}</InspectorMicroLabel>
        </div>
      ) : null}
      {children}
    </div>
  );
};

export type ToggleChipOption = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

type InspectorToggleChipGroupProps = {
  options: readonly ToggleChipOption[];
  activeKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
  /** Optional accessible name for the group. */
  'aria-label'?: string;
  className?: string;
};

/**
 * Clickable chip row for independent boolean options (Phase 6).
 * Whole chip is the hit target; active = filled primary; inactive = gray outline.
 */
export const InspectorToggleChipGroup: React.FC<InspectorToggleChipGroupProps> = ({
  options,
  activeKeys,
  onToggle,
  'aria-label': ariaLabel,
  className,
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    data-inspector-toggle-chip-group=""
    className={[INSPECTOR_TOGGLE_CHIP_GROUP_CLASS, className].filter(Boolean).join(' ')}
  >
    {options.map((option) => {
      const pressed = activeKeys.has(option.key);
      return (
        <button
          key={option.key}
          type="button"
          role="button"
          aria-pressed={pressed}
          disabled={option.disabled === true}
          data-chip-key={option.key}
          data-chip-active={pressed ? 'true' : 'false'}
          className={pressed ? INSPECTOR_TOGGLE_CHIP_ACTIVE_CLASS : INSPECTOR_TOGGLE_CHIP_INACTIVE_CLASS}
          onClick={() => {
            if (option.disabled) {
              return;
            }
            onToggle(option.key);
          }}
        >
          {option.icon ? <span className="inline-flex shrink-0" aria-hidden>{option.icon}</span> : null}
          <span className="truncate">{option.label}</span>
        </button>
      );
    })}
  </div>
);

export type SegmentedControlOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

type InspectorSegmentedControlProps = {
  options: readonly SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the radiogroup. */
  'aria-label'?: string;
  className?: string;
  /** Optional test/id marker (e.g. "pin"). */
  name?: string;
};

/**
 * Exclusive short-choice control for Inspector forms (Phase 6).
 * Size aligned with HeroUI `size="sm"` (~h-8). Not a reuse of canvas zoom segments.
 */
export const InspectorSegmentedControl: React.FC<InspectorSegmentedControlProps> = ({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
  name,
}) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    data-inspector-segmented-control={name ?? ''}
    className={[INSPECTOR_SEGMENTED_CONTROL_CLASS, className].filter(Boolean).join(' ')}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={option.disabled === true}
          data-segment-value={option.value}
          data-segment-active={selected ? 'true' : 'false'}
          className={selected ? INSPECTOR_SEGMENTED_OPTION_ACTIVE_CLASS : INSPECTOR_SEGMENTED_OPTION_INACTIVE_CLASS}
          onClick={() => {
            if (option.disabled || selected) {
              return;
            }
            onChange(option.value);
          }}
        >
          {option.icon ? <span className="me-1 inline-flex shrink-0" aria-hidden>{option.icon}</span> : null}
          <span className="truncate">{option.label}</span>
        </button>
      );
    })}
  </div>
);
