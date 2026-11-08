import React, { useMemo } from 'react';
import { ToolbarFilterSelect } from '../ToolbarFilterSelect';
import type { QueryPresetChipItem } from './QueryPresetChips';

export type QueryPresetPickerProps = {
  presets: readonly QueryPresetChipItem[];
  selectedIds: readonly string[];
  onChange: (nextIds: string[]) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
};

/**
 * Optional multi-select dropdown of predefined query presets for grids / CRUD toolbars.
 * Pair with server `presets` query param bindings.
 */
export const QueryPresetPicker: React.FC<QueryPresetPickerProps> = ({
  presets,
  selectedIds,
  onChange,
  ariaLabel = 'Query presets',
  placeholder = 'Add filter…',
  className,
}) => {
  const selectable = useMemo(
    () => presets.filter((preset) => preset.application !== 'mandatory'),
    [presets],
  );

  const options = useMemo(
    () => selectable.map((preset) => ({
      value: preset.id,
      label: preset.label,
    })),
    [selectable],
  );

  const value = selectedIds.filter((id) => selectable.some((preset) => preset.id === id)).join(',');

  if (selectable.length === 0) {
    return null;
  }

  return (
    <ToolbarFilterSelect
      className={className}
      value={value}
      options={options}
      multiple
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      onChange={(next) => {
        const ids = next.split(',').map((entry) => entry.trim()).filter(Boolean);
        const locked = presets
          .filter((preset) => preset.application === 'mandatory')
          .map((preset) => preset.id);
        onChange([...new Set([...locked, ...ids])]);
      }}
    />
  );
};
