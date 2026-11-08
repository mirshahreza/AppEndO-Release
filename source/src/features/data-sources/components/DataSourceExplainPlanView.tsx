import React, { useMemo, useState } from 'react';
import { List, PieChart, Waypoints } from 'lucide-react';
import {
  buildExplainPlanCostSlices,
  type ExplainPlanListItem,
} from '../../../shared/lib/formatDataSourceExplainPlan';
import {
  UiPieChart,
  UiSegmentedControl,
  UI_CHART_SERIES_COLORS,
} from '../../../shared/ui';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { DataSourceExplainPlanFlow } from './DataSourceExplainPlanFlow';

type ExplainPlanViewMode = 'plan' | 'chart' | 'list';

const VIEW_ITEMS = [
  { id: 'plan', label: 'Plan', icon: Waypoints, accessibleLabel: 'Execution plan' },
  { id: 'chart', label: 'Chart', icon: PieChart, accessibleLabel: 'Cost chart' },
  { id: 'list', label: 'List', icon: List, accessibleLabel: 'Operator list' },
] as const;

const formatSlicePercent = (value: number, total: number): string => {
  if (!(total > 0)) {
    return '0%';
  }
  const percent = (value / total) * 100;
  if (percent >= 10) {
    return `${percent.toFixed(0)}%`;
  }
  if (percent >= 1) {
    return `${percent.toFixed(1)}%`;
  }
  return '<1%';
};

const formatSliceCost = (value: number): string => {
  if (value >= 10 || Number.isInteger(value)) {
    return String(Math.round(value * 100) / 100);
  }
  return value.toPrecision(4).replace(/\.?0+$/, '');
};

const ExplainPlanList: React.FC<{ items: ExplainPlanListItem[] }> = ({ items }) => (
  <ol className="m-0 min-h-0 flex-1 list-none overflow-auto px-3 py-2">
    {items.map((item, index) => (
      <li
        key={`${item.depth}-${item.title}-${index}`}
        className="border-s-2 border-cyan-200 py-1.5 ps-3"
        style={{ marginInlineStart: item.depth * 14 }}
      >
        <div className="text-[12px] font-medium leading-snug text-slate-800">{item.title}</div>
        {item.detail ? (
          <div className="mt-0.5 font-mono text-[11px] leading-relaxed text-slate-500">{item.detail}</div>
        ) : null}
      </li>
    ))}
  </ol>
);

export const DataSourceExplainPlanView: React.FC<{
  items: ExplainPlanListItem[];
  truncated?: boolean;
}> = ({ items, truncated = false }) => {
  const [mode, setMode] = useState<ExplainPlanViewMode>('plan');
  const slices = useMemo(() => buildExplainPlanCostSlices(items), [items]);
  const chartRows = useMemo(
    () => slices.map((slice) => ({ label: slice.label, value: slice.value })),
    [slices],
  );
  const sliceTotal = useMemo(
    () => slices.reduce((sum, slice) => sum + slice.value, 0),
    [slices],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {truncated ? (
        <p className="shrink-0 px-3 py-1.5 text-[10px] text-amber-600">Results were truncated to the platform row/size limit.</p>
      ) : null}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-700">
          Query plan
        </p>
        <div
          {...pageGuideLocalProps(
            'Plan view',
            'Plan is the operator graph. Chart is cost share. List is the step-by-step text.',
            24,
          )}
        >
          <UiSegmentedControl
            ariaLabel="Query plan view"
            items={[...VIEW_ITEMS]}
            selectedKey={mode}
            onSelectionChange={(key) => setMode(key as ExplainPlanViewMode)}
            visualMode="icon-label"
            width="fit"
          />
        </div>
      </div>

      {mode === 'plan' ? (
        <div className="min-h-0 flex-1">
          <DataSourceExplainPlanFlow items={items} />
        </div>
      ) : null}

      {mode === 'chart' ? (
        slices.length === 0 ? (
          <p className="p-3 text-[11px] text-slate-500">
            This plan has no cost figures to plot. Switch to List for the operator steps.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            <ul className="m-0 min-h-0 w-full shrink-0 list-none overflow-auto border-b border-slate-100 px-3 py-2 lg:w-56 lg:border-b-0 lg:border-e">
              {slices.map((slice, index) => (
                <li key={slice.label} className="flex items-start gap-2 py-1.5">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: UI_CHART_SERIES_COLORS[index % UI_CHART_SERIES_COLORS.length] }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium leading-snug text-slate-800">
                      {slice.label}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {formatSlicePercent(slice.value, sliceTotal)} · cost {formatSliceCost(slice.value)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex min-h-[240px] min-w-0 flex-1 items-stretch p-2">
              <UiPieChart
                data={chartRows}
                seriesKeys={['value']}
                valueKey="value"
                xAxisKey="label"
                variant="donut"
                showLegend={false}
                showLabels
                palette="categorical"
                height={280}
                className="!h-full !min-h-[240px]"
              />
            </div>
          </div>
        )
      ) : null}

      {mode === 'list' ? <ExplainPlanList items={items} /> : null}
    </div>
  );
};
