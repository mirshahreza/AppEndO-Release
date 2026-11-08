/**
 * @vitest-environment jsdom
 *
 * Bug found (gap-analysis §19.4 / phase 36): grids could not group rows, show subtotals/grand totals,
 * or pivot aggregated values across Canvas/Preview/Export.
 * Fixed in designerGridAggregation.ts, DesignerRuntimeAppTableGrid.tsx, bindingGridEngine.ts,
 * bindingCodegen.ts, inspectorPaletteFields.ts, InspectorGridAggregationField.tsx.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { CultureProvider } from '../../../core/culture/CultureContext';
import {
  aggregateFieldValues,
  applyGridAggregation,
  applyGridPivot,
  buildGridAggregationQueryParams,
  formatAggregationValue,
  GRID_ROW_KIND_KEY,
  isGridAggregationEnabled,
  parseGridAggregationConfig,
  parseServerAggregationResponse,
  resolveGridAggregationRowClassName,
  serializeGridAggregationConfig,
  type GridAggregationConfig,
} from '../designerGridAggregation';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';

const withCulture = (ui: React.ReactElement) => render(
  <CultureProvider cultureId="us">{ui}</CultureProvider>,
);

afterEach(() => {
  cleanup();
});

const sampleRows = [
  { region: 'North', product: 'A', amount: 100 },
  { region: 'North', product: 'B', amount: 50 },
  { region: 'South', product: 'A', amount: 200 },
  { region: 'South', product: 'B', amount: 25 },
];

const groupConfig: GridAggregationConfig = {
  groupByFields: ['region'],
  aggregations: [{ field: 'amount', fn: 'sum', label: 'Total', format: 'number' }],
  showSubtotalPerGroup: true,
  showGrandTotal: true,
};

describe('36.1 — applyGridAggregation pure unit tests', () => {
  it('returns rows unchanged when config is absent or disabled', () => {
    expect(applyGridAggregation(sampleRows, null)).toEqual(sampleRows);
    expect(applyGridAggregation(sampleRows, { aggregations: [], groupByFields: [] })).toEqual(sampleRows);
    expect(isGridAggregationEnabled(null)).toBe(false);
  });

  it('groups by one field with subtotal and grand total rows', () => {
    const result = applyGridAggregation(sampleRows, groupConfig);
    const subtotals = result.filter((row) => row[GRID_ROW_KIND_KEY] === 'subtotal');
    const grandTotal = result.find((row) => row[GRID_ROW_KIND_KEY] === 'grand-total');

    expect(subtotals).toHaveLength(2);
    expect(subtotals.find((row) => row.region === 'Subtotal' && row.amount === 150)).toBeTruthy();
    expect(subtotals.find((row) => row.region === 'Subtotal' && row.amount === 225)).toBeTruthy();
    expect(grandTotal?.amount).toBe(375);
  });

  it('supports multi-level groupBy nesting', () => {
    const nestedConfig: GridAggregationConfig = {
      groupByFields: ['region', 'product'],
      aggregations: [{ field: 'amount', fn: 'sum', label: 'Total' }],
      showSubtotalPerGroup: true,
    };
    const result = applyGridAggregation(sampleRows, nestedConfig);
    const headers = result.filter((row) => row[GRID_ROW_KIND_KEY] === 'group-header');
    expect(headers.length).toBeGreaterThanOrEqual(4);
  });

  it('pivots row×column×value with optional grand total', () => {
    const pivotConfig: GridAggregationConfig = {
      aggregations: [{ field: 'amount', fn: 'sum', label: 'Total' }],
      pivotMode: {
        rowField: 'region',
        columnField: 'product',
        valueField: 'amount',
        aggFn: 'sum',
      },
      showGrandTotal: true,
    };
    const pivoted = applyGridPivot(sampleRows, pivotConfig) as unknown as Record<string, unknown>[];
    const north = pivoted.find((row) => row.region === 'North');
    expect(north?.pivot_A).toBe(100);
    expect(north?.pivot_B).toBe(50);
    expect(pivoted.some((row) => row[GRID_ROW_KIND_KEY] === 'grand-total')).toBe(true);
  });

  it('aggregates numeric series with aggregateFieldValues', () => {
    expect(aggregateFieldValues('sum', [10, 20, 5])).toBe(35);
    expect(aggregateFieldValues('avg', [10, 20])).toBe(15);
    expect(aggregateFieldValues('count', [1, 2, 3])).toBe(3);
    expect(aggregateFieldValues('min', [3, 1, 2])).toBe(1);
    expect(aggregateFieldValues('max', [3, 1, 2])).toBe(3);
    expect(formatAggregationValue(1250.5, 'currency')).toContain('1');
  });

  it('round-trips aggregation config through parse/serialize', () => {
    const serialized = serializeGridAggregationConfig(groupConfig);
    const parsed = parseGridAggregationConfig(serialized);
    expect(parsed).toEqual(groupConfig);
  });

  it('builds server query params for group and pivot modes', () => {
    expect(buildGridAggregationQueryParams(groupConfig)).toMatchObject({
      groupBy: 'region',
      showSubtotal: 'true',
      showGrandTotal: 'true',
    });
    expect(buildGridAggregationQueryParams({
      aggregations: [],
      pivotMode: { rowField: 'region', columnField: 'product', valueField: 'amount', aggFn: 'sum' },
    })).toMatchObject({
      pivotRowField: 'region',
      pivotColumnField: 'product',
      pivotValueField: 'amount',
      pivotAggFn: 'sum',
    });
  });

  it('parses server groups payload into display rows', () => {
    const parsed = parseServerAggregationResponse({
      groups: [
        {
          key: 'North',
          field: 'region',
          rows: [{ region: 'North', product: 'A', amount: 100 }],
          subtotal: { region: 'Subtotal', amount: 100 },
        },
      ],
      grandTotal: { region: 'Grand Total', amount: 100 },
    }, groupConfig);
    expect(parsed?.some((row) => row[GRID_ROW_KIND_KEY] === 'group-header')).toBe(true);
    expect(parsed?.some((row) => row[GRID_ROW_KIND_KEY] === 'grand-total')).toBe(true);
  });
});

describe('36.2 — subtotal/grand-total rows render in AppTableGrid DOM', () => {
  it('renders subtotal and grand total text from aggregated rows', () => {
    const aggregated = applyGridAggregation(sampleRows, groupConfig);
    const columns: AppTableGridColumnDef<Record<string, unknown>>[] = [
      {
        id: 'region',
        label: 'Region',
        renderCell: (row) => String(row.region ?? ''),
      },
      {
        id: 'amount',
        label: 'Amount',
        renderCell: (row) => String(row.amount ?? ''),
      },
    ];

    withCulture(
      <AppTableGrid
        columns={columns}
        rows={aggregated}
        getRowKey={(row) => `${String(row[GRID_ROW_KIND_KEY] ?? 'data')}-${String(row.region ?? '')}-${String(row.amount ?? '')}-${String(row.product ?? '')}`}
        getRowClassName={(row) => resolveGridAggregationRowClassName(row) ?? ''}
        isEmpty={aggregated.length === 0}
        emptyMessage="No rows"
      />,
    );

    expect(screen.getAllByText('Subtotal').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Grand Total')).toBeTruthy();
    expect(screen.getByText('150')).toBeTruthy();
    expect(screen.getByText('375')).toBeTruthy();
  });
});

describe('36.3 — export codegen applies aggregation', () => {
  it('emits applyGridAggregation and server aggregation query params in exported TSX', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridId,
      key: 'gridAggregationConfig',
      value: serializeGridAggregationConfig(groupConfig),
    });
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('applyGridAggregation');
    expect(tsx).toContain('gridAggregatedRows_');
    expect(tsx).toContain('"groupByFields":["region"]');
  });
});
