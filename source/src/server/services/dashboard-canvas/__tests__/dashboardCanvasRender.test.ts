import { describe, expect, it } from 'vitest';
import { renderPivotSnapshotPng, renderPivotSnapshotText } from '../dashboardCanvasRender';
import type { PivotResult } from '../../../../shared/api/contracts/data-api';

const result: PivotResult = {
  rowAxis: { fields: ['region'], members: [{ key: 'west', labels: ['west'] }] },
  colAxis: { fields: [], members: [{ key: '__all__', labels: [] }] },
  measures: [{ field: 'amount', aggregation: 'sum' }],
  cells: [{ rowKey: 'west', colKey: '__all__', values: [12] }],
};

describe('dashboard canvas snapshot render', () => {
  it('writes the same snapshot text into a PNG via the shared render path', async () => {
    const input = { title: 'Sales', takenAt: '2026-09-11T00:00:00.000Z', results: [{ widgetId: 'w1', result }] };
    const text = renderPivotSnapshotText(input);
    expect(text).toContain('Snapshot taken at 2026-09-11');
    const png = await renderPivotSnapshotPng(input);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
