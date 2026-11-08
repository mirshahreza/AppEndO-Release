/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { AppTableGrid } from '../AppTableGrid';
import {
  syncSplitHeaderScrollbarGutter,
  syncSplitHeaderTableWidth,
} from '../AppTableGridSplitTableLayout';
import {
  APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CLASS,
  APP_TABLE_GRID_SCROLL_OVERLAY_CLASS,
} from '../surfaceClasses';
import { CultureProvider } from '../../../core/culture/CultureContext';
import {
  LIST_PREFERENCES_STORAGE_PREFIX,
  patchStoredListPreferences,
} from '../../lib/listPreferencesStorage';

const PERSIST_LIST_KEY = 'test-grid-column-layout';

const withCulture = (ui: React.ReactElement) => render(
  <CultureProvider cultureId="us">{ui}</CultureProvider>,
);

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(`${LIST_PREFERENCES_STORAGE_PREFIX}${PERSIST_LIST_KEY}`);
});

describe('AppTableGrid Hero-parity shell', () => {
  it('applies scroll owner, margin, border, aria label, and row header', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="People"
        scrollOwner="panel"
        margin={8}
        borderWidth={2}
        fillHeight
        columns={[
          {
            id: 'name',
            label: 'Name',
            isRowHeader: true,
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    expect(screen.getByRole('table', { name: 'People' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Alpha' })).toBeTruthy();
    expect(document.querySelector('[data-table-grid-margin="8"]')).toBeTruthy();
    expect(document.querySelector('[data-table-grid-border-width="2"]')).toBeTruthy();
    expect(document.querySelector('[data-table-grid-cell-px="5"]')).toBeTruthy();
    expect(document.querySelector('[data-table-grid-scroll-owner="panel"]')).toBeTruthy();
  });

  it('merges per-row getCellClassName onto the cell', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="People"
        columns={[
          {
            id: 'name',
            label: 'Name',
            cellClassName: 'font-medium',
            getCellClassName: (row: { name: string }) => (
              row.name === 'Alpha' ? 'text-sky-700' : undefined
            ),
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    expect(screen.getByRole('cell', { name: 'Alpha' }).className).toContain('text-sky-700');
    expect(screen.getByRole('cell', { name: 'Alpha' }).className).toContain('font-medium');
  });

  it('centers clipped cell content when the column is text-center', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Centered cells"
        columns={[
          {
            id: 'status',
            label: 'Status',
            headerClassName: 'text-center',
            cellClassName: 'text-center',
            renderCell: (row: { status: string }) => row.status,
          },
        ]}
        rows={[{ status: 'Open' }]}
        getRowKey={(row) => row.status}
      />,
    );

    const header = screen.getByRole('columnheader', { name: 'Status' });
    expect(header.className).toContain('text-center');
    expect(header.querySelector(':scope > div')?.className).toContain('justify-center');
    const cell = screen.getByRole('cell', { name: 'Open' });
    expect(cell.className).toContain('text-center');
    expect(cell.querySelector(':scope > div')?.className).toContain('text-center');
  });

  it('applies textDirection on start-aligned columns', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Start cells"
        columns={[
          {
            id: 'title',
            label: 'Title',
            textDirection: 'opposite',
            renderCell: (row: { title: string }) => row.title,
          },
        ]}
        rows={[{ title: 'Hello' }]}
        getRowKey={(row) => row.title}
      />,
    );

    const header = screen.getByRole('columnheader', { name: 'Title' });
    expect(header).toHaveAttribute('dir', 'rtl');
    expect(header.className).toContain('text-start');
    const cell = screen.getByRole('cell', { name: 'Hello' });
    expect(cell).toHaveAttribute('dir', 'rtl');
  });

  it('gives leftover table-fixed width to the unconstrained title column, not a spacer before actions', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Contents"
        columns={[
          {
            id: 'title',
            label: 'Title',
            renderCell: (row: { title: string }) => row.title,
          },
          {
            id: 'type',
            label: 'Type',
            width: 120,
            renderCell: () => 'Article',
          },
          {
            id: 'actions',
            label: '',
            width: 55,
            card: { role: 'actions' },
            renderCell: () => 'go',
          },
        ]}
        rows={[{ title: 'Demo Item 1' }]}
        getRowKey={(row) => row.title}
      />,
    );

    expect(document.querySelectorAll('[data-column-id="__filler__"]').length).toBe(0);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent?.trim())).toEqual(['Title', 'Type', '']);
    expect(headers[0]).not.toHaveStyle({ width: '120px' });
    expect(headers[1]).toHaveStyle({ width: '120px' });
    expect(headers[2]).toHaveStyle({ width: '55px' });
  });

  it('merges per-row getCellStyle onto the cell', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="People"
        columns={[
          {
            id: 'name',
            label: 'Name',
            getCellStyle: (row: { name: string }) => (
              row.name === 'Alpha' ? { backgroundColor: '#F0F9FF' } : undefined
            ),
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    expect(screen.getByRole('cell', { name: 'Alpha' })).toHaveStyle({ backgroundColor: '#F0F9FF' });
  });

  it('applies joined-card chrome on the same AppTableGrid without swapping components', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Hero chrome people"
        chrome="hero"
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    expect(screen.getByRole('table', { name: 'Hero chrome people' })).toBeTruthy();
    expect(document.querySelector('[data-table-grid-split-scroll="true"]')).toBeTruthy();
    expect(document.querySelector('[data-table-grid-chrome="hero"]')).toBeTruthy();
    expect(document.querySelector('[data-table-grid-margin="4"]')).toBeTruthy();
    expect(document.querySelector('[data-table-grid-border-width="5"]')).toBeTruthy();
  });

  it('aligns header label flex with headerClassName', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Centered"
        columns={[
          {
            id: 'qty',
            label: 'Qty',
            headerClassName: 'text-center',
            cellClassName: 'text-center',
            renderCell: (row: { qty: number }) => row.qty,
          },
        ]}
        rows={[{ qty: 3 }]}
        getRowKey={(row) => String(row.qty)}
      />,
    );

    const header = screen.getByRole('columnheader', { name: 'Qty' });
    expect(header.className).toContain('text-center');
    expect(header.querySelector(':scope > div')?.className).toContain('justify-center');
    expect(header.querySelector(':scope > div > span')?.className).toContain('text-center');
    expect(header.querySelector(':scope > div > span')?.className).not.toContain('flex-1');
  });

  it('applies cellPaddingX as a CSS variable on the grid shell', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Padded cells"
        cellPaddingX={8}
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const host = document.querySelector('[data-table-grid-cell-px="8"]');
    expect(host).toBeTruthy();
    expect((host as HTMLElement).style.getPropertyValue('--app-table-grid-cell-px')).toBe('8px');
  });

  it('clips overflowing body cell values at the column edge', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Clip overflow"
        columns={[
          {
            id: 'objectName',
            label: 'Object',
            width: 80,
            renderCell: (row: { objectName: string }) => row.objectName,
          },
        ]}
        rows={[{ objectName: 'base_workflow_webhook_bindings' }]}
        getRowKey={(row) => row.objectName}
      />,
    );

    const cell = screen.getByRole('cell', { name: 'base_workflow_webhook_bindings' });
    expect(cell.className).toContain('overflow-hidden');
    expect(cell.querySelector(':scope > div')?.className).toContain('truncate');
    for (const table of screen.getAllByRole('table')) {
      expect(table.className).toContain('table-fixed');
    }
  });

  it('wraps long body cell values when wrap is set on the column', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Wrap overflow"
        columns={[
          {
            id: 'question',
            label: 'Question',
            wrap: true,
            renderCell: (row: { question: string }) => row.question,
          },
        ]}
        rows={[{ question: 'What does this long column actually store for the operator?' }]}
        getRowKey={(row) => row.question}
      />,
    );

    const cell = screen.getByRole('cell', { name: 'What does this long column actually store for the operator?' });
    const clip = cell.querySelector(':scope > div');
    expect(clip?.className).toContain('whitespace-pre-wrap');
    expect(clip?.className).toContain('break-words');
    expect(clip?.className).not.toContain('truncate');
  });

  it('inverts resize drag delta when the header cell is rtl', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Rtl resize"
        columns={[
          {
            id: 'name',
            label: 'Name',
            textDirection: 'rtl',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const header = screen.getByRole('columnheader', { name: 'Name' });
    expect(header).toHaveAttribute('dir', 'rtl');

    const resizeHandle = screen.getByTitle(/resize/i);
    resizeHandle.setPointerCapture = vi.fn();
    resizeHandle.releasePointerCapture = vi.fn();
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(resizeHandle, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 120 });

    const col = document.querySelector('col');
    expect(col?.getAttribute('style') ?? '').toMatch(/180px/);
  });

  it('renders column resize handles by default', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Resizable"
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    expect(screen.getByTitle(/resize/i)).toBeTruthy();
  });

  it('restores persisted column widths', () => {
    patchStoredListPreferences(PERSIST_LIST_KEY, {
      columnLayout: { order: ['name'], hidden: [], widths: { name: 240 } },
    });

    withCulture(
      <AppTableGrid
        ariaLabel="Persisted widths"
        persistListKey={PERSIST_LIST_KEY}
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const col = document.querySelector('col');
    expect(col?.getAttribute('style') ?? '').toMatch(/240px/);
  });

  it('does not render a resize handle when the column locks layout.resizable', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Locked"
        columns={[
          {
            id: 'name',
            label: 'Name',
            layout: { resizable: false },
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    expect(screen.queryByTitle(/resize/i)).toBeNull();
  });

  it('defaults header label flex to start when headerClassName is omitted', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Start aligned"
        columns={[
          {
            id: 'code',
            label: 'Code',
            renderCell: (row: { code: string }) => row.code,
          },
        ]}
        rows={[{ code: 'ORD-001' }]}
        getRowKey={(row) => row.code}
      />,
    );

    const header = screen.getByRole('columnheader', { name: 'Code' });
    expect(header.querySelector(':scope > div')?.className).toContain('justify-start');
  });

  it('portals the column filter popover outside the split header band', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Filter portal"
        columns={[
          {
            id: 'name',
            label: 'Name',
            filter: { type: 'text' },
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    expect(document.querySelector('[data-table-grid-split-scroll="true"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Filter (client-side)' }));

    const popover = screen.getByRole('dialog', { name: 'Filter (client-side)' });
    expect(popover.className).toContain('fixed');
    expect(popover.closest('[data-table-grid-header-band]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply filter' })).toBeTruthy();
  });

  it('flips the column filter popover when the last column has no room toward the end', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });

    withCulture(
      <AppTableGrid
        ariaLabel="Filter flip"
        columns={[
          {
            id: 'name',
            label: 'Name',
            filter: { type: 'text' },
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Filter (client-side)' }).parentElement as HTMLElement;
    trigger.getBoundingClientRect = () => ({
      x: 980,
      y: 40,
      top: 40,
      right: 1004,
      bottom: 64,
      left: 980,
      width: 24,
      height: 24,
      toJSON() {
        return this;
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filter (client-side)' }));

    const popover = screen.getByRole('dialog', { name: 'Filter (client-side)' });
    expect(popover.style.right).toBe('20px');
    expect(popover.style.left).toBe('');
  });

  it('portals the column layout menu outside the split header band', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Layout portal"
        enableColumnLayout
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    fireEvent.mouseEnter(document.querySelector('[data-table-grid-split-scroll="true"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Column settings' }));

    const panel = screen.getByRole('dialog', { name: 'Columns' });
    expect(panel.className).toContain('fixed');
    expect(panel.closest('[data-table-grid-header-band]')).toBeNull();
  });

  it('keeps split header mounted while loading', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Loading split"
        isLoading
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[]}
        getRowKey={(row) => row.name}
      />,
    );

    expect(document.querySelector('[data-table-grid-split-scroll="true"]')).toBeTruthy();
    expect(document.querySelector('[data-table-grid-header-band="true"]')).toBeTruthy();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('adds last-column overlay inset on the table when scrollGutter is overlay', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Last column inset"
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const table = document.querySelector('table[aria-label="Last column inset"]');
    expect(table?.className).toContain(APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CLASS.split(' ')[0]!);
    const lastCell = table?.querySelector('tbody tr td:last-child');
    expect(lastCell?.className).toContain('!ps-[calc(var(--app-table-grid-cell-px,5px)+var(--app-table-grid-last-column-overlay-inset,13px))]');
  });

  it('applies last-column overlay inset on cells even when column uses !px override', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Last column inset override"
        columns={[
          {
            id: 'left',
            label: 'Left',
            renderCell: (row: { id: string }) => row.id,
          },
          {
            id: 'action',
            label: 'Action',
            cellClassName: '!px-0.5 text-center',
            renderCell: () => 'Go',
          },
        ]}
        rows={[{ id: '1' }]}
        getRowKey={(row) => row.id}
      />,
    );

    const lastCell = document.querySelector('table[aria-label="Last column inset override"] tbody tr td:last-child');
    expect(lastCell?.className).toContain('!pe-[calc(var(--app-table-grid-cell-px,5px)+var(--app-table-grid-last-column-overlay-inset,13px))]');
  });

  it('uses overlay scroll on the grid body by default', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Overlay scroll"
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const scrollHost = document.querySelector('[data-table-grid-scroll-owner="self"]');
    expect(scrollHost?.className).toContain(APP_TABLE_GRID_SCROLL_OVERLAY_CLASS);
  });

  it('omits overlay scroll when scrollGutter is native', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Native scroll"
        scrollGutter="native"
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const scrollHost = document.querySelector('[data-table-grid-scroll-owner="self"]');
    expect(scrollHost?.className).not.toContain(APP_TABLE_GRID_SCROLL_OVERLAY_CLASS);
    expect(document.querySelector('[data-table-grid-overlay-scrollbar]')).toBeNull();
  });

  it('syncs split header table width to the body table width', () => {
    const body = document.createElement('div');
    const headerTable = document.createElement('table');
    const bodyTable = document.createElement('table');
    Object.defineProperty(body, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(bodyTable, 'scrollWidth', { configurable: true, value: 640 });
    bodyTable.getBoundingClientRect = () => ({ width: 640 } as DOMRect);
    body.appendChild(bodyTable);

    syncSplitHeaderTableWidth(body, headerTable);
    expect(headerTable.style.width).toBe('640px');
    expect(headerTable.style.minWidth).toBe('640px');
    expect(bodyTable.style.width).toBe('');
    expect(bodyTable.style.minWidth).toBe('100%');
  });

  it('pads the split header band by the body vertical scrollbar gutter when scrollGutter is native', () => {
    const body = document.createElement('div');
    const headerBand = document.createElement('div');
    Object.defineProperty(body, 'offsetWidth', { configurable: true, value: 215 });
    Object.defineProperty(body, 'clientWidth', { configurable: true, value: 200 });

    syncSplitHeaderScrollbarGutter(body, headerBand);
    expect(headerBand.style.paddingInlineEnd).toBe('15px');

    Object.defineProperty(body, 'offsetWidth', { configurable: true, value: 200 });
    syncSplitHeaderScrollbarGutter(body, headerBand);
    expect(headerBand.style.paddingInlineEnd).toBe('');
  });

  it('paints the split header band with the header fill so the scrollbar gutter is not a white break', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Header gutter"
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const headerBand = document.querySelector('[data-table-grid-header-band="true"]');
    expect(headerBand?.className).toContain('bg-slate-100');
    expect(headerBand?.className).toContain('after:bg-slate-300');
    expect(headerBand?.querySelector('thead')?.className ?? '').not.toContain('bg-slate-100');
  });

  it('matches pinned split-header cell fill to the header band', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Pinned header band"
        columns={[
          {
            id: 'name',
            label: 'Name',
            renderCell: (row: { name: string }) => row.name,
          },
          {
            id: 'actions',
            label: '',
            width: 30,
            layout: { pinned: 'right', resizable: false, hideable: false, reorderable: false },
            renderCell: () => '…',
          },
        ]}
        rows={[{ name: 'Alpha' }]}
        getRowKey={(row) => row.name}
      />,
    );

    const headerBand = document.querySelector('[data-table-grid-header-band="true"]');
    expect(headerBand?.className).toContain('[--app-table-grid-pin-bg:theme(colors.slate.100)]');
    const nameHeader = headerBand?.querySelector('th[data-column-id="name"]') as HTMLElement | null;
    expect(nameHeader?.className).toBeTruthy();
    expect(headerBand?.className).toContain('[&_th]:bg-[var(--app-table-grid-pin-bg');
    const pinnedHeader = headerBand?.querySelector('th[data-column-id="actions"]') as HTMLElement | null;
    expect(pinnedHeader?.getAttribute('data-pinned')).toBe('right');
    expect(headerBand?.className).toContain('after:z-[25]');
    expect(pinnedHeader?.style.background).toMatch(/var\(--app-table-grid-pin-bg/);
    const bodyPin = document.querySelector('td[data-column-id="actions"]') as HTMLElement | null;
    expect(bodyPin?.style.background).toMatch(/var\(--app-table-grid-pin-bg|255,\s*255,\s*255/);
  });

  it('renders colgroup and w-max table for table-scroll without split scroll host', () => {
    withCulture(
      <AppTableGrid
        ariaLabel="Phone width"
        presentation="table-scroll"
        scrollOwner="panel"
        fillHeight={false}
        stickyHeader={false}
        columns={[
          {
            id: 'phone',
            label: 'Phone',
            width: 200,
            minWidth: 200,
            renderCell: (row: { phone: string }) => row.phone,
          },
        ]}
        rows={[{ phone: '07701234567' }]}
        getRowKey={(row) => row.phone}
      />,
    );

    const table = screen.getByRole('table', { name: 'Phone width' });
    expect(table.querySelector('colgroup col')).toBeTruthy();
    expect(table.className).toContain('w-max');
    const col = table.querySelector('colgroup col') as HTMLElement;
    expect(col.style.width).toBe('200px');
  });
});
