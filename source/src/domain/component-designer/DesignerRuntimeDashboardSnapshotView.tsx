import * as React from 'react';
import {
  parseFrozenDashboardSnapshotPayload,
  pivotResultToChartRows,
  type FrozenDashboardSnapshotWidget,
} from '../../shared/lib/dashboardCanvas';
import { AppTableGrid } from '../../shared/ui';

export type DesignerRuntimeDashboardSnapshotViewProps = {
  banner: string;
  payload: unknown;
};

const FrozenSnapshotWidgetTable: React.FC<{ item: FrozenDashboardSnapshotWidget }> = ({ item }) => {
  const chartRows = pivotResultToChartRows(item.result);
  const measureColumns = item.result.measures.map((measure, index) => ({
    id: `${measure.field}_${measure.aggregation}_${index}`,
    label: `${measure.field} (${measure.aggregation})`,
    renderCell: (row: Record<string, unknown>) => {
      const key = `${measure.field}_${measure.aggregation}`;
      const value = index === 0 ? (row.value ?? row[key]) : row[key];
      return value == null ? '—' : String(value);
    },
  }));
  const columns = [
    {
      id: 'label',
      label: 'Member',
      renderCell: (row: Record<string, unknown>) => String(row.label ?? ''),
      isRowHeader: true,
    },
    ...measureColumns,
  ];

  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {item.kind ? `${item.kind} · ${item.widgetId}` : item.widgetId}
      </header>
      <div className="p-2">
        <AppTableGrid
          chrome="hero"
          fillHeight={false}
          scrollOwner="panel"
          columns={columns}
          rows={chartRows}
          getRowKey={(row) => `${item.widgetId}-${String(row.label ?? '')}`}
          ariaLabel={`Frozen snapshot for ${item.widgetId}`}
        />
      </div>
    </section>
  );
};

export const DesignerRuntimeDashboardSnapshotView: React.FC<DesignerRuntimeDashboardSnapshotViewProps> = ({
  banner,
  payload,
}) => {
  const widgets = parseFrozenDashboardSnapshotPayload(payload);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4" data-testid="dashboard-snapshot-view">
      <div
        className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
        role="status"
      >
        {banner}
      </div>
      {widgets.length === 0 ? (
        <p className="text-sm text-slate-600">This snapshot has no frozen widget results.</p>
      ) : widgets.map((item) => (
        <FrozenSnapshotWidgetTable key={item.widgetId} item={item} />
      ))}
    </div>
  );
};

export const frozenSnapshotBanner = (createdAt: string): string => `Snapshot taken at ${createdAt}`;
