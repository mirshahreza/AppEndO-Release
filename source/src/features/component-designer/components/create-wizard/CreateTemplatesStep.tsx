import * as React from 'react';
import { NativeButton } from '../../../../shared/ui/NativeButton';
import { AppButton } from '../../../../shared/ui';
import {
  NEW_LAYOUT_CATEGORY_OPTIONS,
  NEW_LAYOUT_CATEGORY_LABELS,
  countPresetsForCategory,
  filterPresetsByCategory,
  getPresetCategories,
  renderPresetMiniPreview,
  type NewLayoutPreset,
  type NewLayoutPresetCategory,
} from '../../../../domain/component-designer/layout-presets/newLayoutPresets';
import type { NewLayoutPresetId } from '../../../../domain/component-designer/layout-presets/types';

export type CreateTemplatesStepProps = {
  selectedCategory: NewLayoutPresetCategory;
  onCategoryChange: (category: NewLayoutPresetCategory) => void;
  selectedPresetId: NewLayoutPresetId | null;
  onSelectPreset: (presetId: NewLayoutPresetId) => void;
};

export const CreateTemplatesStep: React.FC<CreateTemplatesStepProps> = ({
  selectedCategory,
  onCategoryChange,
  selectedPresetId,
  onSelectPreset,
}) => {
  const filteredPresets = React.useMemo(
    () => filterPresetsByCategory(selectedCategory),
    [selectedCategory],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5">
        <p className="text-[11px] text-slate-700">
          Pick a starter layout. You will name it next.
        </p>
        <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 shadow-sm">
          {filteredPresets.length} templates
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {NEW_LAYOUT_CATEGORY_OPTIONS.map((category) => {
          const isActive = selectedCategory === category.value;
          const count = countPresetsForCategory(category.value);

          return (
            <AppButton
              key={category.value}
              onClick={() => onCategoryChange(category.value)}
              intent={isActive ? 'toggle-on' : 'cancel'}
              className="h-7 px-2.5 text-[10px] font-semibold flex items-center gap-1.5"
            >
              <span>{category.label}</span>
              <span className={`rounded px-1.5 py-[1px] text-[9px] ${isActive ? 'bg-cyan-100/80 text-cyan-800' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </AppButton>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredPresets.map((preset) => (
            <NewLayoutPresetCard
              key={preset.id}
              preset={preset}
              selected={selectedPresetId === preset.id}
              onSelect={onSelectPreset}
            />
          ))}
        </div>
        {filteredPresets.length === 0 ? (
          <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
            No templates in this category.
          </div>
        ) : null}
      </div>
    </div>
  );
};

type NewLayoutPresetCardProps = {
  preset: NewLayoutPreset;
  selected: boolean;
  onSelect: (presetId: NewLayoutPresetId) => void;
};

const NewLayoutPresetCard: React.FC<NewLayoutPresetCardProps> = ({ preset, selected, onSelect }) => {
  const categories = getPresetCategories(preset);
  return (
    <NativeButton
      type="button"
      onClick={() => onSelect(preset.id)}
      aria-pressed={selected}
      className={[
        'group flex h-full flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition',
        selected
          ? 'border-cyan-400 ring-2 ring-cyan-200 hover:border-cyan-400'
          : 'border-slate-200 hover:border-cyan-300 hover:shadow-md',
      ].join(' ')}
    >
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-50">
        {renderPresetMiniPreview(preset.id)}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="truncate text-[11px] font-semibold text-slate-800">{preset.title}</span>
        <span className="line-clamp-2 text-[10px] text-slate-500">{preset.description}</span>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {categories.slice(0, 2).map((category) => (
            <span key={category} className="rounded bg-slate-100 px-1.5 py-px text-[9px] font-semibold text-slate-600">
              {NEW_LAYOUT_CATEGORY_LABELS[category]}
            </span>
          ))}
        </div>
      </div>
    </NativeButton>
  );
};
