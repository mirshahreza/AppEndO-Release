import React from 'react';
import type { ComponentViewportVisibility } from '../lib/viewportVisibility';
import { useComponentViewportVisible } from '../lib/useComponentViewportVisible';
import { cn } from '../../lib/utils';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import {
  getLocalizedFilterMatchLogicOption,
  resolveFilterMatchLogicOptions,
  type FilterMatchLogic,
} from '../lib/filterMatchLogic';
import { UiSelect } from './HeroFieldControls';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import { UiSegmentedControl } from './UiSegmentedControl';
import {
  TOOLBAR_FILTER_SELECT_MULTIPLE_HOST_CLASS,
  TOOLBAR_FILTER_SELECT_SINGLE_HOST_CLASS,
} from './surfaceClasses';

const TOOLBAR_FILTER_EMPTY_KEY = '__toolbar_filter_all__';

export type ToolbarFilterSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type ToolbarFilterSelectProps = {
  /** Selected value — single key, or comma-separated keys when `multiple`. */
  value: string;
  options: ReadonlyArray<ToolbarFilterSelectOption>;
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Page-guide hint. Defaults to the shared list-filter sentence. */
  hint?: string;
  allLabel?: string;
  /** When false, default option text is `allLabel` only (no `ariaLabel:` prefix). */
  allOptionPrefixWithAriaLabel?: boolean;
  className?: string;
  onDropdownOpen?: () => void;
  /** When true, allows selecting several options; `value` / `onChange` use CSV. */
  multiple?: boolean;
  /** AND/OR match group rendered inside the open menu, not beside the trigger. */
  matchLogic?: FilterMatchLogic;
  onMatchLogicChange?: (value: FilterMatchLogic) => void;
  matchLogicAriaLabel?: string;
  /** Default `always` — set per filter when compact tiers should omit a redundant control. */
  visibility?: ComponentViewportVisibility;
};

const MatchLogicPopoverGroup: React.FC<{
  value: FilterMatchLogic;
  onChange: (value: FilterMatchLogic) => void;
  ariaLabel: string;
}> = ({ value, onChange, ariaLabel }) => {
  const t = useOptionalCultureT();
  const matchLogicOptions = resolveFilterMatchLogicOptions(t);
  const selected = getLocalizedFilterMatchLogicOption(value, t);
  const matchLogicHint = t('pageGuide.page.matchLogic.hint', { missing: 'silent' });
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-col gap-1"
      {...pageGuideLocalProps(
        ariaLabel,
        matchLogicHint !== 'pageGuide.page.matchLogic.hint'
          ? matchLogicHint
          : PAGE_GUIDE_EN['pageGuide.page.matchLogic.hint'],
        21,
      )}
    >
      <UiSegmentedControl
        ariaLabel={ariaLabel}
        width="equal"
        selectedKey={value}
        onSelectionChange={(key) => {
          if (key === 'or' || key === 'and') {
            onChange(key);
          }
        }}
        items={matchLogicOptions.map((option) => ({
          id: option.value,
          label: option.label,
        }))}
      />
      <p className="px-0.5 text-[10px] leading-tight text-slate-500">{selected.description}</p>
    </div>
  );
};

/**
 * Toolbar-sized select filter. Multi-select is the same `UiSelect multiple`
 * contract used on Form Fields / Base Components — not a parallel control.
 */
export const ToolbarFilterSelect: React.FC<ToolbarFilterSelectProps> = ({
  value,
  options,
  onChange,
  ariaLabel = 'Filter',
  hint,
  allLabel = 'All',
  allOptionPrefixWithAriaLabel = true,
  className,
  onDropdownOpen,
  multiple = false,
  matchLogic,
  onMatchLogicChange,
  matchLogicAriaLabel,
  visibility = 'always',
}) => {
  const visible = useComponentViewportVisible(visibility);
  if (!visible) {
    return null;
  }

  const normalizedAllLabel = String(allLabel ?? '').trim();
  const normalizedValue = String(value ?? '').trim();
  const allOptionLabel = normalizedAllLabel.length > 0
    ? (allOptionPrefixWithAriaLabel ? `${ariaLabel}: ${normalizedAllLabel}` : normalizedAllLabel)
    : ariaLabel;
  const selectValue = multiple
    ? value
    : (normalizedValue.length > 0 ? normalizedValue : TOOLBAR_FILTER_EMPTY_KEY);
  const matchLogicHeader = multiple && matchLogic && onMatchLogicChange
    ? (
      <MatchLogicPopoverGroup
        value={matchLogic}
        onChange={onMatchLogicChange}
        ariaLabel={matchLogicAriaLabel ?? `${ariaLabel} match logic`}
      />
    )
    : undefined;

  return (
    <div
      className={cn(
        multiple ? TOOLBAR_FILTER_SELECT_MULTIPLE_HOST_CLASS : TOOLBAR_FILTER_SELECT_SINGLE_HOST_CLASS,
        className,
      )}
      {...pageGuideLocalProps(
        ariaLabel,
        String(hint ?? '').trim() || PAGE_GUIDE_EN['pageGuide.page.filter.hint'],
        20,
      )}
    >
      <UiSelect
        size="sm"
        multiple={multiple}
        clipSafePopover
        popoverPlacement="bottom"
        shouldFlip
        value={selectValue}
        ariaLabel={ariaLabel}
        placeholder={allOptionLabel}
        className="shrink-0 font-medium text-slate-700"
        popoverHeader={matchLogicHeader}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            onDropdownOpen?.();
          }
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (multiple) {
            onChange(next);
            return;
          }
          onChange(next === TOOLBAR_FILTER_EMPTY_KEY ? '' : next);
        }}
      >
        {multiple ? null : (
          <option value={TOOLBAR_FILTER_EMPTY_KEY}>{allOptionLabel}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled === true}>
            {option.label}
          </option>
        ))}
      </UiSelect>
    </div>
  );
};
