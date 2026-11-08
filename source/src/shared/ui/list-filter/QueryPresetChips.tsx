import React from 'react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';

export type QueryPresetChipItem = {
  id: string;
  label: string;
  application: 'mandatory' | 'optional' | 'default-on';
  defaultSelected?: boolean;
};

export type QueryPresetChipsProps = {
  presets: readonly QueryPresetChipItem[];
  selectedIds: readonly string[];
  onChange: (next: string[]) => void;
  className?: string;
};

export const QueryPresetChips: React.FC<QueryPresetChipsProps> = ({
  presets,
  selectedIds,
  onChange,
  className,
}) => {
  if (presets.length === 0) {
    return null;
  }
  const selected = new Set(selectedIds);
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {presets.map((preset) => {
        const locked = preset.application === 'mandatory';
        const active = locked || selected.has(preset.id);
        return (
          <AppButton
            key={preset.id}
            type="button"
            size="sm"
            intent={active ? 'primary' : 'outline'}
            disabled={locked}
            onClick={() => {
              if (locked) {
                return;
              }
              const next = new Set(selectedIds);
              if (next.has(preset.id)) {
                next.delete(preset.id);
              } else {
                next.add(preset.id);
              }
              onChange([...next]);
            }}
          >
            {preset.label}
          </AppButton>
        );
      })}
    </div>
  );
};
