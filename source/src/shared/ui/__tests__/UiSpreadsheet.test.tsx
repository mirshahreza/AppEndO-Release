/**
 * @vitest-environment jsdom
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  applySpreadsheetGridLines,
  applySpreadsheetMinimumGrid,
  createDemoSpreadsheetSheets,
  isBrowserSpreadsheetAvailable,
  isSpreadsheetRtlRowGutter,
  isSpreadsheetScrollNearEnd,
  resolveSpreadsheetHeightStyle,
  resolveSpreadsheetHostStyle,
  resolveSpreadsheetLastIndex,
  resolveUiSpreadsheetHostStatBar,
  resolveUiSpreadsheetDirection,
  resolveUiSpreadsheetWorkbookSettings,
  spreadsheetDataToCelldata,
  spreadsheetSheetsSignature,
  summarizeSpreadsheetSheets,
  toPersistedSpreadsheetSheets,
  UiSpreadsheet,
  type UiSpreadsheetHandle,
} from '../UiSpreadsheet';

describe('UiSpreadsheet', () => {
  it('builds a demo workbook with sales formulas and a notes sheet', () => {
    const sheets = createDemoSpreadsheetSheets();
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Sales', 'Notes']);
    expect(sheets[0]?.celldata?.some((cell) => cell.v.f === '=SUM(B2:D2)')).toBe(true);
    expect(summarizeSpreadsheetSheets(sheets).some((line) => line.includes('Sales A1: Product'))).toBe(true);
  });

  it('treats jsdom as unavailable and shows a cell summary fallback', () => {
    expect(isBrowserSpreadsheetAvailable()).toBe(false);
    const { container } = render(<UiSpreadsheet height={320} />);
    expect(screen.getByText('Spreadsheet')).toBeInTheDocument();
    expect(screen.getByText(/Sales A1: Product/)).toBeInTheDocument();
    expect(container.querySelector('[data-spreadsheet-fallback="true"]')).toBeTruthy();
    expect(container.querySelector('[data-ui-spreadsheet]')?.getAttribute('dir')).toBe('ltr');
    expect(container.querySelector('[data-spreadsheet-direction="ltr"]')).toBeTruthy();
  });

  it('marks sheet chrome as rtl without changing FortuneSheet settings', () => {
    const { container } = render(<UiSpreadsheet height={320} direction="rtl" />);
    const host = container.querySelector('[data-ui-spreadsheet]');
    expect(host?.getAttribute('dir')).toBe('rtl');
    expect(host?.getAttribute('data-spreadsheet-direction')).toBe('rtl');
  });

  it('exposes a no-op action handle while the workbook runtime is unavailable', () => {
    const ref = React.createRef<UiSpreadsheetHandle>();
    render(<UiSpreadsheet ref={ref} height={320} />);
    expect(ref.current?.getSheets()).toEqual([]);
    expect(ref.current?.getCellValue(0, 0)).toBeUndefined();
    ref.current?.setCellValue(0, 0, 'AppEndO');
    ref.current?.addSheet();
    expect(ref.current?.getSheets()).toEqual([]);
  });

  it('maps full height to 100% of the parent by default', () => {
    expect(resolveSpreadsheetHeightStyle('full')).toMatchObject({
      className: 'h-full min-h-0 flex-1',
      style: { height: '100%', minHeight: 0 },
    });
    expect(resolveSpreadsheetHostStyle('full')).toMatchObject({
      height: '100%',
      minHeight: 320,
    });
    render(<UiSpreadsheet />);
    expect(document.querySelector('[data-spreadsheet-height="full"]')).toBeTruthy();
  });

  it('does not stretch FortuneSheet workarea to 100% height', () => {
    const css = fs.readFileSync(path.join(__dirname, '../uiSpreadsheetHost.css'), 'utf8');
    expect(css).not.toMatch(/fortune-workarea[\s\S]{0,120}height:\s*100%/);
    expect(css).toMatch(/fortune-container/);
    expect(css).toMatch(/\[data-spreadsheet-stat="tabs"\] \.fortune-stat-area/);
    expect(css).toMatch(/\[data-spreadsheet-stat="hidden"\] \.fortune-stat-area/);
    expect(css).toMatch(/\[data-spreadsheet-direction="rtl"\] \.fortune-workarea/);
    expect(css).toMatch(/\[data-spreadsheet-direction="rtl"\] \.luckysheet-scrollbar-y/);
    expect(css).toMatch(/ui-spreadsheet-rtl-row-gutter/);
    expect(css).not.toMatch(/\[data-ui-spreadsheet\] \.fortune-stat-area\s*\{\s*display:\s*none/);
  });

  it('resolves FortuneSheet settings presets, headers, currency, and grid lines', () => {
    const compact = resolveUiSpreadsheetWorkbookSettings({
      showToolbar: true,
      toolbarPreset: 'compact',
      currency: 'EUR',
      showRowHeader: false,
      cellMenuPreset: 'edit',
      sheetTabMenuPreset: 'none',
    });
    expect(compact.currency).toBe('€');
    expect(compact.rowHeaderWidth).toBe(0);
    expect(compact.toolbarItems).toEqual(expect.arrayContaining(['undo', 'bold', 'search']));
    expect(compact.toolbarItems).not.toContain('screenshot');
    expect(compact.cellContextMenu).toEqual(expect.arrayContaining(['copy', 'clear']));
    expect(compact.cellContextMenu).not.toContain('chart');
    expect(compact.sheetTabContextMenu).toEqual([]);

    const hiddenToolbar = resolveUiSpreadsheetWorkbookSettings({
      showToolbar: true,
      toolbarPreset: 'none',
    });
    expect(hiddenToolbar.showToolbar).toBe(false);
    expect(hiddenToolbar.toolbarItems).toEqual([]);
    expect(compact.devicePixelRatio).toBeUndefined();

    const retina = resolveUiSpreadsheetWorkbookSettings({ devicePixelRatio: 2 });
    expect(retina.devicePixelRatio).toBe(2);

    expect(applySpreadsheetGridLines(createDemoSpreadsheetSheets(), false)[0]?.showGridLines).toBe(0);
  });

  it('defaults FortuneSheet grid to 200 rows, 50 columns, and hidden add-rows bar', () => {
    const defaults = resolveUiSpreadsheetWorkbookSettings({});
    expect(defaults).toMatchObject({
      row: 200,
      column: 50,
      addRows: 0,
      addColumns: 50,
      showAddColumns: true,
      statBar: 'tabs',
    });
    expect(resolveUiSpreadsheetHostStatBar('tabs', true)).toBe('tabs');
    expect(resolveUiSpreadsheetHostStatBar('tabs', false)).toBe('hidden');
    expect(resolveUiSpreadsheetHostStatBar('footer', false)).toBe('footer');
    expect(resolveUiSpreadsheetDirection()).toBe('ltr');
    expect(resolveUiSpreadsheetDirection('rtl')).toBe('rtl');
    expect(isSpreadsheetRtlRowGutter('rtl', 46)).toBe(true);
    expect(isSpreadsheetRtlRowGutter('ltr', 46)).toBe(false);
    expect(isSpreadsheetRtlRowGutter('rtl', 0)).toBe(false);
    const padded = applySpreadsheetMinimumGrid([{ name: 'Sheet1', row: 36, column: 12 }], 200, 50);
    expect(padded[0]).toMatchObject({ row: 200, column: 50 });
    expect(isSpreadsheetScrollNearEnd(0, 200, 200)).toBe(false);
    expect(isSpreadsheetScrollNearEnd(700, 200, 800, 96)).toBe(true);
    expect(resolveSpreadsheetLastIndex(200)).toBe(199);
  });

  it('persists FortuneSheet data matrix as celldata', () => {
    expect(spreadsheetDataToCelldata([
      [null, { v: 'B1', m: 'B1' }],
      [{ v: 'A2', m: 'A2' }, null],
    ])).toEqual([
      { r: 0, c: 1, v: { v: 'B1', m: 'B1' } },
      { r: 1, c: 0, v: { v: 'A2', m: 'A2' } },
    ]);
    const persisted = toPersistedSpreadsheetSheets([{
      id: 'sheet-1',
      name: 'Sheet1',
      order: 0,
      status: 1,
      row: 2,
      column: 2,
      data: [[{ v: 'Hello', m: 'Hello' }, null]],
    }]);
    expect(persisted[0]).toEqual({
      id: 'sheet-1',
      name: 'Sheet1',
      order: 0,
      status: 1,
      row: 2,
      column: 2,
      celldata: [{ r: 0, c: 0, v: { v: 'Hello', m: 'Hello' } }],
    });
    expect(spreadsheetSheetsSignature(persisted)).toBe(spreadsheetSheetsSignature([{
      id: 'sheet-1',
      name: 'Sheet1',
      order: 0,
      status: 1,
      row: 2,
      column: 2,
      celldata: [{ r: 0, c: 0, v: { v: 'Hello', m: 'Hello' } }],
    }]));
  });

  it('keeps loaded celldata when FortuneSheet emits an empty data matrix', () => {
    const persisted = toPersistedSpreadsheetSheets([{
      id: 'sheet-1',
      name: 'Sheet1',
      celldata: [{ r: 0, c: 0, v: { v: 'Keep', m: 'Keep' } }],
      data: [[null, {}], [{}, null]],
    }]);
    expect(persisted[0]?.celldata).toEqual([{ r: 0, c: 0, v: { v: 'Keep', m: 'Keep' } }]);
  });
});
