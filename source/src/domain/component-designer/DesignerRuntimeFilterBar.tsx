import * as React from 'react';
import { Filter } from 'lucide-react';
import type { DesignerDashboardFilterBarConfig } from './designerDashboardFilterBarConfig';
import { readNestedContextValue } from './bindingResourceModel';
import { UiInput, UiSelect } from '../../shared/ui';

export type DesignerRuntimeFilterBarProps = {
  config: DesignerDashboardFilterBarConfig;
  designerStore: Record<string, unknown>;
  onStorePathChange: (storePath: string, value: unknown) => void;
  onFilterApplied?: () => void;
  mode?: 'design' | 'runtime';
};

export const DesignerRuntimeFilterBar: React.FC<DesignerRuntimeFilterBarProps> = ({
  config,
  designerStore,
  onStorePathChange,
  onFilterApplied,
  mode = 'runtime',
}) => {
  const commitStorePath = React.useCallback((storePath: string, value: unknown) => {
    onStorePathChange(storePath, value);
    onFilterApplied?.();
  }, [onFilterApplied, onStorePathChange]);

  if (config.filters.length === 0) {
    return mode === 'design' ? (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-3 py-4 text-center text-xs text-slate-500">
        Dashboard Filter Bar — add filters in the Inspector
      </div>
    ) : null;
  }

  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex w-full items-center gap-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Filter className="h-3.5 w-3.5" strokeWidth={2} />
        Dashboard filters
      </div>

      {config.filters.map((filter) => {
        if (filter.type === 'dateRange') {
          const fromPath = filter.fromStorePath ?? '';
          const toPath = filter.toStorePath ?? '';
          const fromValue = String(readNestedContextValue(designerStore, fromPath) ?? '');
          const toValue = String(readNestedContextValue(designerStore, toPath) ?? '');
          return (
            <div key={filter.id} className="flex min-w-[220px] flex-col gap-[2px]">
              <label className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">{filter.label}</label>
              <div className="flex items-center gap-1.5">
                <UiInput
                  size="sm"
                  type="date"
                  value={fromValue}
                  onChange={(event) => commitStorePath(fromPath, event.target.value)}
                />
                <span className="text-[10px] text-slate-400">to</span>
                <UiInput
                  size="sm"
                  type="date"
                  value={toValue}
                  onChange={(event) => commitStorePath(toPath, event.target.value)}
                />
              </div>
            </div>
          );
        }

        if (filter.type === 'select') {
          const storePath = filter.storePath ?? '';
          const currentValue = String(readNestedContextValue(designerStore, storePath) ?? '');
          return (
            <div key={filter.id} className="flex min-w-[140px] flex-col gap-[2px]">
              <label className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">{filter.label}</label>
              <UiSelect
                size="sm"
                value={currentValue}
                onChange={(event) => commitStorePath(storePath, event.target.value)}
              >
                <option value="">{filter.placeholder ?? 'All'}</option>
                {(filter.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </UiSelect>
            </div>
          );
        }

        const storePath = filter.storePath ?? '';
        const currentValue = String(readNestedContextValue(designerStore, storePath) ?? '');
        return (
          <div key={filter.id} className="flex min-w-[160px] flex-1 flex-col gap-[2px]">
            <label className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">{filter.label}</label>
            <UiInput
              size="sm"
              value={currentValue}
              placeholder={filter.placeholder ?? filter.label}
              onChange={(event) => commitStorePath(storePath, event.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
};
