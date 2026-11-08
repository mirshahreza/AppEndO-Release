import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import type { DesignerChartToolbarConfig } from './designerChartToolbarConfig';
import { readChartToolbarStoreValue } from './designerChartToolbarConfig';
import { AppButton } from '../../shared/ui/AppButton';
import { UiInput, UiSelect } from '../../shared/ui';

export type DesignerChartRuntimeToolbarProps = {
  nodeId: string;
  config: DesignerChartToolbarConfig;
  designerStore: Record<string, unknown>;
  onStorePathChange: (storePath: string, value: unknown) => void;
  /** Called after a filter value is committed to the store (for data refresh). */
  onFilterApplied?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  mode?: 'design' | 'runtime';
};

export const DesignerChartRuntimeToolbar: React.FC<DesignerChartRuntimeToolbarProps> = ({
  config,
  designerStore,
  onStorePathChange,
  onFilterApplied,
  onRefresh,
  isLoading = false,
  mode = 'runtime',
}) => {
  const [searchDraft, setSearchDraft] = React.useState('');
  const debounceRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
  }, []);

  React.useEffect(() => {
    if (!config.search?.storePath) {
      return;
    }
    const current = readChartToolbarStoreValue(designerStore, config.search.storePath);
    setSearchDraft(typeof current === 'string' ? current : '');
  }, [config.search?.storePath, designerStore]);

  const commitStorePath = React.useCallback((storePath: string, value: unknown) => {
    onStorePathChange(storePath, value);
    onFilterApplied?.();
  }, [onFilterApplied, onStorePathChange]);

  const handleSearchChange = React.useCallback((value: string) => {
    setSearchDraft(value);
    if (!config.search?.storePath) {
      return;
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      commitStorePath(config.search!.storePath!, value);
    }, config.search?.debounceMs ?? 300);
  }, [commitStorePath, config.search]);

  if (config.enabled !== true) {
    return null;
  }

  const showFilters = mode === 'design' || config.runtimeEnabled !== false;
  if (!showFilters) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-2">
      {config.search?.enabled === true ? (
        <div className="flex min-w-[160px] flex-1 flex-col gap-[2px]">
          <label className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">Search</label>
          <UiInput
            size="sm"
            value={searchDraft}
            placeholder={config.search.placeholder ?? 'chart data…'}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </div>
      ) : null}

      {(config.selectFilters ?? []).map((filter) => {
        const currentValue = String(readChartToolbarStoreValue(designerStore, filter.storePath) ?? '');
        return (
          <div key={filter.id} className="flex min-w-[140px] flex-col gap-[2px]">
            <label className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">{filter.label}</label>
            <UiSelect
              size="sm"
              value={currentValue}
              onChange={(event) => commitStorePath(filter.storePath, event.target.value)}
            >
              <option value="">{filter.placeholder ?? 'All'}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </UiSelect>
          </div>
        );
      })}

      {config.dateRange?.enabled === true ? (
        <>
          <div className="flex min-w-[130px] flex-col gap-[2px]">
            <label className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {config.dateRange.label ?? 'From'}
            </label>
            <UiInput
              size="sm"
              type="date"
              value={String(readChartToolbarStoreValue(designerStore, config.dateRange.fromStorePath ?? '') ?? '')}
              onChange={(event) => {
                if (config.dateRange?.fromStorePath) {
                  commitStorePath(config.dateRange.fromStorePath, event.target.value);
                }
              }}
            />
          </div>
          <div className="flex min-w-[130px] flex-col gap-[2px]">
            <label className="ps-[4px] text-[10px] font-medium uppercase tracking-wide text-slate-500">To</label>
            <UiInput
              size="sm"
              type="date"
              value={String(readChartToolbarStoreValue(designerStore, config.dateRange.toStorePath ?? '') ?? '')}
              onChange={(event) => {
                if (config.dateRange?.toStorePath) {
                  commitStorePath(config.dateRange.toStorePath, event.target.value);
                }
              }}
            />
          </div>
        </>
      ) : null}

      {config.refresh?.enabled === true && onRefresh ? (
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          className="h-8 shrink-0"
          disabled={isLoading}
          onClick={onRefresh}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={2} />
          Refresh
        </AppButton>
      ) : null}
    </div>
  );
};
