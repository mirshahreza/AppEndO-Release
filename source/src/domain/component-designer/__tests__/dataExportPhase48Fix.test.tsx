/**
 * @vitest-environment jsdom
 *
 * Bug found (gap analysis #5 / Phase 48): no `exportData` Dynamic Action and no grid toolbar
 * Export control — grids/dashboards could not download CSV/Excel/PDF of the live filtered view.
 * Fixed in designerDataExport.ts / designerGridToolbarConfig.ts / bindingDynamicActions* /
 * DesignerRuntimeAppTableGrid.tsx / exportDataFiles.ts / component-designer export route:
 * CSV/xlsx/pdf POST the queried row set to `/api/component-designer/export`;
 * xlsx is a real ExcelJS workbook.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Workbook } from 'exceljs';
import {
  buildDesignerCsvContent,
  downloadDesignerCsv,
  exportDesignerData,
  registerDesignerExportSource,
  requestDesignerServerExport,
  resolveRegisteredDesignerExportPayload,
  DESIGNER_EXPORT_API_PATH,
} from '../designerDataExport';
import {
  createDynamicAction,
  resolveDynamicActions,
} from '../bindingDynamicActionsEngine';
import { executeDynamicAction } from '../bindingDynamicActionsRuntime';
import {
  normalizeDesignerGridToolbarConfig,
  parseDesignerGridToolbarConfig,
  serializeDesignerGridToolbarConfig,
  applyDesignerGridToolbarClientFilters,
} from '../designerGridToolbarConfig';
import { DesignerGridPageToolbar } from '../designerGridPageToolbar';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  GRID_LIST_RESOURCE_BINDING_KEY,
  createGridListResourceBindingDefinition,
} from '../bindingGridEngine';
import { serializeDesignerDataGridColumns } from '../designerDataGridColumns';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import {
  buildDesignerExportFile,
  buildDesignerPdfBuffer,
  buildDesignerXlsxBuffer,
  parseDesignerExportRequestBody,
} from '../../../server/domain/component-designer/export/exportDataFiles';
import type { DesignerNode } from '../types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SAMPLE_ROWS = [
  { id: 1, name: 'Alice', role: 'ADMIN' },
  { id: 2, name: 'Bob', role: 'USER' },
  { id: 3, name: 'Carol', role: 'ADMIN' },
] as const;

describe('Phase 48 — CSV client-side export (filtered/sorted view)', () => {
  it('buildDesignerCsvContent emits BOM + header + rows', () => {
    const csv = buildDesignerCsvContent(SAMPLE_ROWS, [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('ID,Name');
    expect(csv).toContain('1,Alice');
    expect(csv).toContain('2,Bob');
    expect(csv).not.toContain('role');
  });

  it('neutralizes CSV/formula-injection payloads (OWASP CSV injection) in exported cells', () => {
    const maliciousRows = [
      { id: '1', name: '=HYPERLINK("http://evil.example","click")' },
      { id: '2', name: '+cmd|\'/c calc\'!A1' },
      { id: '3', name: '-1+1' },
      { id: '4', name: '@SUM(1,1)' },
      { id: '5', name: 'safe, normal name' },
    ] as const;
    const csv = buildDesignerCsvContent(maliciousRows, [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
    ]);
    // Every formula-trigger-prefixed value must be neutralized with a leading single quote
    // so spreadsheet apps render it as literal text instead of evaluating it as a formula.
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'-1+1");
    expect(csv).toContain("'@SUM");
    expect(csv).not.toMatch(/[,\n]=HYPERLINK/);
    expect(csv).not.toMatch(/[,\n]\+cmd/);
    // Ordinary values (no leading =/+/-/@) are left untouched.
    expect(csv).toContain('safe, normal name'.includes(',') ? '"safe, normal name"' : 'safe, normal name');
  });

  it('omits the header row when includeHeader is false', () => {
    const csv = buildDesignerCsvContent(SAMPLE_ROWS, [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
    ], { includeHeader: false });
    expect(csv).not.toContain('ID,Name');
    expect(csv).toContain('1,Alice');
  });

  it('toolbar Export downloads exactly the client-filtered rows (not the raw set)', async () => {
    const createObjectURL = vi.fn(() => 'blob:export-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = clickSpy;
      }
      return el;
    });

    const filtered = applyDesignerGridToolbarClientFilters([...SAMPLE_ROWS], {
      searchText: 'a',
    });
    expect(filtered.map((row) => row.id)).toEqual([1, 3]);

    const node = {
      id: 'grid_1',
      type: 'element',
      props: {},
      children: [],
      binding: {},
    } as unknown as DesignerNode;

    const onExport = vi.fn((format: 'csv' | 'xlsx' | 'pdf') => {
      if (format === 'csv') {
        downloadDesignerCsv(filtered, { filename: 'users' });
      }
    });

    render(
      <DesignerGridPageToolbar
        node={node}
        config={normalizeDesignerGridToolbarConfig({
          enabled: true,
          showExportButton: true,
          export: { enabled: true, defaultFormat: 'csv' },
        })}
        mode="runtime"
        searchInput=""
        onSearchInputChange={() => undefined}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getByTestId('designer-grid-toolbar-export'));
    expect(onExport).toHaveBeenCalledWith('csv');
    expect(clickSpy).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    const blobArg = createObjectURL.mock.calls.at(0)?.at(0);
    expect(blobArg).toBeInstanceOf(Blob);
    const text = await (blobArg as Blob).text();
    expect(text).toContain('Alice');
    expect(text).toContain('Carol');
    expect(text).not.toContain('Bob');
  });

  it('parse/normalize accepts showExportButton alias and export.enabled', () => {
    const fromAlias = parseDesignerGridToolbarConfig({ enabled: true, showExportButton: true });
    expect(fromAlias?.export?.enabled).toBe(true);
    expect(fromAlias?.showExportButton).toBe(true);

    const normalized = normalizeDesignerGridToolbarConfig({
      enabled: true,
      export: { enabled: true, defaultFormat: 'xlsx' },
    });
    expect(normalized.export).toEqual({ enabled: true, defaultFormat: 'xlsx' });
    expect(normalized.showExportButton).toBe(true);

    const roundTrip = parseDesignerGridToolbarConfig(serializeDesignerGridToolbarConfig(normalized));
    expect(roundTrip?.export?.defaultFormat).toBe('xlsx');
  });
});

describe('Phase 48 — Dynamic Action exportData + registry', () => {
  it('resolves filtered rows from the live registry (not raw dataset)', async () => {
    const filtered = SAMPLE_ROWS.filter((row) => row.role === 'ADMIN');
    const unregister = registerDesignerExportSource('gridListResource', 'grid_a', () => ({
      rows: filtered,
      filename: 'admins',
    }));

    expect(resolveRegisteredDesignerExportPayload('gridListResource')?.rows).toEqual(filtered);

    const createObjectURL = vi.fn(() => 'blob:da-export');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = () => undefined;
      }
      return el;
    });

    const action = createDynamicAction('exportData');
    action.exportFormat = 'csv';
    action.exportSource = 'gridListResource';
    action.exportFilename = 'admins';
    const resolved = resolveDynamicActions(
      { sourceType: 'static', bindingRole: 'event', targetEvent: 'onClick', trueActions: [action] },
      createInitialDesignerState().bindingDefinitions,
    );
    expect(resolved[0]?.type).toBe('exportData');

    const fetchImpl = vi.fn();

    await executeDynamicAction(resolved[0]!, {
      designerStore: {},
      patchStore: () => undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();

    unregister();
  });
});

describe('Phase 48 — Excel/PDF endpoint contract', () => {
  it('requestDesignerServerExport POSTs filtered rows to the export API', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(DESIGNER_EXPORT_API_PATH);
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        format?: string;
        rows?: Array<Record<string, unknown>>;
        filename?: string;
      };
      expect(body.format).toBe('xlsx');
      expect(body.rows).toEqual([{ id: 1, name: 'Alice' }]);
      expect(body.filename).toMatch(/\.xlsx$/);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-disposition'
            ? 'attachment; filename="export.xlsx"'
            : null),
        },
        blob: async () => new Blob([new Uint8Array([1, 2, 3])], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      };
    }) as unknown as typeof fetch;

    const createObjectURL = vi.fn(() => 'blob:xlsx');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = () => undefined;
      }
      return el;
    });

    await requestDesignerServerExport({
      format: 'xlsx',
      rows: [{ id: 1, name: 'Alice' }],
      filename: 'export',
    }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('exportDesignerData downloads csv and pdf in the browser without calling the API', async () => {
    const fetchImpl = vi.fn();

    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = () => undefined;
      }
      return el;
    });

    await exportDesignerData({
      format: 'csv',
      rows: [{ a: 1 }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const csvBlob = createObjectURL.mock.calls[0]?.at(0);
    expect(csvBlob).toBeInstanceOf(Blob);
    expect(await (csvBlob as Blob).text()).toContain('a');

    createObjectURL.mockClear();

    await exportDesignerData({
      format: 'pdf',
      rows: [{ a: 1 }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('server builders produce non-empty xlsx/csv/pdf buffers from posted rows', async () => {
    const parsed = parseDesignerExportRequestBody({
      format: 'xlsx',
      rows: SAMPLE_ROWS,
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
      ],
      filename: 'people.xlsx',
    });
    const xlsx = await buildDesignerExportFile(parsed);
    expect(xlsx.contentType).toContain('spreadsheetml');
    expect(xlsx.buffer.byteLength).toBeGreaterThan(100);
    expect(xlsx.filename).toBe('people.xlsx');
    expect(xlsx.buffer.subarray(0, 2).toString('utf8')).toBe('PK');

    const csv = await buildDesignerExportFile({
      format: 'csv',
      rows: SAMPLE_ROWS,
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
      ],
      filename: 'people.csv',
    });
    expect(csv.contentType).toContain('text/csv');
    expect(csv.buffer.toString('utf8')).toContain('ID,Name');
    expect(csv.buffer.toString('utf8')).toContain('1,Alice');

    const pdf = buildDesignerPdfBuffer(SAMPLE_ROWS);
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect((await buildDesignerXlsxBuffer(SAMPLE_ROWS)).byteLength).toBeGreaterThan(100);
  });

  it('ExcelJS workbook preserves numbers and neutralizes formula cells', async () => {
    const buffer = await buildDesignerXlsxBuffer(
      [{ id: 1, name: '=HYPERLINK("http://evil.example","click")' }],
      [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
      ],
    );
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).getCell(1).value).toBe('ID');
    expect(sheet.getRow(2).getCell(1).value).toBe(1);
    expect(String(sheet.getRow(2).getCell(2).value)).toContain("'=HYPERLINK");
  });
});

describe('Phase 48 — Export codegen wires toolbar Export + helpers', () => {
  it('emits exportDesignerData + filteredRows for showExportButton toolbars', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'users',
      dataSource: {
        id: 'users',
        name: 'Users',
        endpoint: '/api/users',
        fields: ['id', 'name'],
        primaryKey: 'id',
      },
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.app-table-grid',
      parentId: state.document.rootNodeId,
    });
    const gridId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridId,
      key: 'columns',
      value: serializeDesignerDataGridColumns([
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
      ]),
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridId,
      key: 'toolbarConfig',
      value: serializeDesignerGridToolbarConfig({
        enabled: true,
        showExportButton: true,
        export: { enabled: true, defaultFormat: 'csv' },
      }),
    });
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('users'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('phase48-export-toolbar', tsx);
    expect(tsx).toContain('exportDesignerData');
    expect(tsx).toContain('registerDesignerExportSource');
    expect(tsx).toContain('designer-grid-toolbar-export');
    expect(tsx).toMatch(/rows:\s*gridFilteredRows_\w+/);
  });
});
