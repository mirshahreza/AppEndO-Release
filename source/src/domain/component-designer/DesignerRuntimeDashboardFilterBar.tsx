import * as React from 'react';
import type { DashboardFilterDeclaration } from '../../shared/api/contracts/dashboard-canvas';
import {
  buildFilterMembersPivotSpec,
  pivotResultMemberLabels,
} from '../../shared/lib/dashboardCanvas';
import {
  AppButton,
  DesignerDatePickerField,
  PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ToolbarFilterSelect,
  UiInput,
} from '../../shared/ui';
import { cn } from '../../lib/utils';
import { requestDashboardCanvasPivot } from './DesignerRuntimeDashboardUserWidget';

const TOOLBAR_DATE_RANGE_LABEL_CLASS =
  'text-xs font-semibold text-slate-700 whitespace-nowrap';

type DesignerRuntimeDashboardFilterBarProps = {
  pageId: string;
  filters: DashboardFilterDeclaration[];
  values: Record<string, string>;
  crossFilter?: Record<string, string>;
  onChange: (filterId: string, value: string) => void;
  onClearCrossFilter: () => void;
};

const FilterControl: React.FC<{
  pageId: string;
  filter: DashboardFilterDeclaration;
  value: string;
  onChange: (value: string) => void;
}> = ({ pageId, filter, value, onChange }) => {
  const [options, setOptions] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!pageId || (filter.controlType !== 'select' && filter.controlType !== 'multiSelect')) {
      return;
    }
    let cancelled = false;
    void requestDashboardCanvasPivot(
      pageId,
      filter.domainEntryId,
      buildFilterMembersPivotSpec(filter.field),
      filter.id,
    ).then((result) => {
      if (cancelled || !result) return;
      setOptions(pivotResultMemberLabels(result));
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pageId, filter.domainEntryId, filter.field, filter.controlType, filter.id]);

  const selectOptions = [...new Set([
    ...value.split(',').map((item) => item.trim()).filter(Boolean),
    ...options,
  ])];

  if (filter.controlType === 'dateRange') {
    const [start, end] = value.split('..');
    return (
      <div className={PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS}>
        <span className={TOOLBAR_DATE_RANGE_LABEL_CLASS}>{filter.label}</span>
        <DesignerDatePickerField
          ariaLabel={`${filter.label} start`}
          className="min-w-0 w-[8.75rem] shrink-0 md:w-[9.5rem]"
          value={start ?? ''}
          onChange={(next) => onChange(`${next}..${end ?? ''}`)}
        />
        <span className="text-xs text-slate-400" aria-hidden="true">–</span>
        <DesignerDatePickerField
          ariaLabel={`${filter.label} end`}
          className="min-w-0 w-[8.75rem] shrink-0 md:w-[9.5rem]"
          value={end ?? ''}
          onChange={(next) => onChange(`${start ?? ''}..${next}`)}
        />
      </div>
    );
  }

  if (filter.controlType === 'numericRange') {
    const [start, end] = value.split('..');
    return (
      <div className={PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS}>
        <span className={TOOLBAR_DATE_RANGE_LABEL_CLASS}>{filter.label}</span>
        <UiInput
          size="sm"
          className="w-[5.5rem] shrink-0"
          value={start ?? ''}
          onChange={(event) => onChange(`${event.target.value}..${end ?? ''}`)}
          ariaLabel={`${filter.label} start`}
        />
        <span className="text-xs text-slate-400" aria-hidden="true">–</span>
        <UiInput
          size="sm"
          className="w-[5.5rem] shrink-0"
          value={end ?? ''}
          onChange={(event) => onChange(`${start ?? ''}..${event.target.value}`)}
          ariaLabel={`${filter.label} end`}
        />
      </div>
    );
  }

  if (filter.controlType === 'select' || filter.controlType === 'multiSelect') {
    return (
      <ToolbarFilterSelect
        ariaLabel={filter.label}
        allLabel="All"
        className="w-[11rem] min-w-[9rem] max-w-[12rem]"
        multiple={filter.controlType === 'multiSelect'}
        value={value}
        options={selectOptions.map((option) => ({ value: option, label: option }))}
        onChange={onChange}
      />
    );
  }

  return (
    <UiInput size="sm" value={value} onChange={(event) => onChange(event.target.value)} ariaLabel={filter.label} />
  );
};

export const DesignerRuntimeDashboardFilterBar: React.FC<DesignerRuntimeDashboardFilterBarProps> = ({
  pageId,
  filters,
  values,
  crossFilter,
  onChange,
  onClearCrossFilter,
}) => {
  if (filters.length === 0 && !(crossFilter && Object.keys(crossFilter).length > 0)) {
    return null;
  }
  return (
    <div className={cn(PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS, 'lg:flex-wrap')}>
      {filters.map((filter) => (
        <FilterControl
          key={filter.id}
          pageId={pageId}
          filter={filter}
          value={values[filter.id] ?? (filter.defaultValue == null ? '' : String(filter.defaultValue))}
          onChange={(next) => onChange(filter.id, next)}
        />
      ))}
      {crossFilter && Object.keys(crossFilter).length > 0 ? (
        <AppButton intent="secondary" size="sm" onClick={onClearCrossFilter}>
          Clear cross-filter {Object.entries(crossFilter).map(([field, item]) => `${field}=${item}`).join(', ')}
        </AppButton>
      ) : null}
    </div>
  );
};
