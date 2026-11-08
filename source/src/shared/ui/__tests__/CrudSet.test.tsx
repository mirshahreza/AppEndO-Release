/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrudSet } from '../CrudSet';
import type { CrudSetSpec } from '../../../domain/component-designer/crudSetSpec';
import { PLATFORM_DATA_EXPORT_API_PATH } from '../../../domain/component-designer/designerDataExport';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
  useOptionalCulture: () => null,
}));

afterEach(cleanup);

const rows = [
  { id: '1', code: 'ORD-001', title: 'First order', status: 'Open', locked: false },
  { id: '2', code: 'ORD-002', title: 'Second order', status: 'Approved', locked: true },
];

const baseSpec = (): CrudSetSpec => ({
  name: 'Orders',
  listApi: { endpointId: 'orders.list' },
  listBody: 'grid',
  columns: [
    { field: 'code', label: 'Code' },
    { field: 'title', label: 'Title' },
  ],
  createApis: [],
  patches: [],
  export: { enabled: false },
  pagination: false,
});

describe('CrudSet', () => {
  it('omits create, export, paging, and delete chrome when the spec has no matching APIs', () => {
    render(<CrudSet spec={baseSpec()} rows={rows} />);

    expect(screen.getByTestId('crud-set')).toBeInTheDocument();
    expect(screen.queryByTestId('crud-set-create')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crud-set-export')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crud-set-paging')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('hides the toolbar when filter bar, create, export, and refresh are all off', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          filterBar: { enabled: false, search: true },
          refresh: false,
        }}
        rows={rows}
      />,
    );

    expect(screen.getByTestId('crud-set')).toBeInTheDocument();
    expect(screen.queryByTestId('crud-set-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search list')).not.toBeInTheDocument();
    expect(screen.getByText('First order')).toBeInTheDocument();
  });

  it('hides search when the filter bar is off even if search is on', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          filterBar: { enabled: false, search: true },
          refresh: true,
        }}
        rows={rows}
      />,
    );

    expect(screen.queryByLabelText('Search list')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('shows a create dropdown, export, paging, and delete when those spec pieces are on', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          pagination: true,
          export: { enabled: true, defaultFormat: 'xlsx' },
          createApis: [
            { id: 'add-order', label: 'Add order', endpointId: 'orders.create', acceptedFields: ['title'] },
            { id: 'add-bulk', label: 'Add bulk', endpointId: 'orders.create-bulk', acceptedFields: ['title'] },
          ],
          patches: [],
          deleteApi: { endpointId: 'orders.delete' },
          readOneApi: { endpointId: 'orders.read' },
        }}
        rows={rows}
      />,
    );

    expect(screen.getByTestId('crud-set-create')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByTestId('crud-set-export')).toBeInTheDocument();
    expect(screen.getByTestId('crud-set-paging')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBeGreaterThan(0);
  });

  it('applies paging and sorting chrome on the footer', () => {
    const { rerender } = render(
      <CrudSet spec={{ ...baseSpec(), pagination: true }} rows={rows} />,
    );

    expect(screen.getByText('Showing 1-2 of 2')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Order by').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('List mode').length).toBeGreaterThan(0);

    rerender(
      <CrudSet
        spec={{
          ...baseSpec(),
          pagination: true,
          paging: { summary: false, listModeSwitch: false },
          sorting: { footer: false },
        }}
        rows={rows}
      />,
    );

    expect(screen.queryByText('Showing 1-2 of 2')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Order by')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('List mode')).not.toBeInTheDocument();
  });

  it('renders transforms, stacked fields, and conditional cell class', () => {
    const { container } = render(
      <CrudSet
        spec={{
          ...baseSpec(),
          columns: [
            { field: 'title', label: 'Title', secondaryField: 'code', stack: 'stacked' },
            { field: 'createdAt', label: 'Created', cellKind: 'date', transform: 'date-year' },
            { field: 'active', label: 'Active', transform: 'boolean-yes-no' },
            {
              field: 'status',
              label: 'Status',
              cellKind: 'badge',
              conditionalFormat: [{ when: 'equals', value: 'Open', background: '#F0F9FF' }],
            },
          ],
        }}
        rows={[
          {
            id: '1',
            code: 'ORD-001',
            title: 'First order',
            status: 'Open',
            createdAt: '2026-03-15T14:30:00.000Z',
            active: true,
          },
        ]}
      />,
    );

    expect(screen.getByText('First order')).toBeInTheDocument();
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(container.querySelector('[data-column-id="status"]')).toHaveStyle({ backgroundColor: '#F0F9FF' });
  });

  it('renders each column from its own display properties', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          columns: [
            { field: 'title', label: 'Title', cellKind: 'text' },
            { field: 'status', label: 'Status', cellKind: 'badge' },
            { field: 'locked', label: 'Locked', cellKind: 'lock-status', sortable: false },
          ],
        }}
        rows={rows}
      />,
    );

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByLabelText('Unlocked')).toBeInTheDocument();
    expect(screen.getByLabelText('Locked')).toBeInTheDocument();
  });

  it('filters rows from toolbar filter-bar controls', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          columns: [
            { field: 'title', label: 'Title' },
            { field: 'status', label: 'Status', cellKind: 'badge' },
          ],
          filterBar: {
            search: true,
            filters: [{
              id: 'status',
              field: 'status',
              label: 'Status',
              controlType: 'radio-group',
              options: [
                { value: 'Open', label: 'Open' },
                { value: 'Approved', label: 'Approved' },
              ],
            }],
          },
        }}
        rows={rows}
      />,
    );

    expect(screen.getByText('First order')).toBeInTheDocument();
    expect(screen.getByText('Second order')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Open' }));
    expect(screen.getByText('First order')).toBeInTheDocument();
    expect(screen.queryByText('Second order')).not.toBeInTheDocument();
  });

  it('offers both Excel and CSV in the export dialog', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          export: { enabled: true, formats: ['xlsx', 'csv'], defaultFormat: 'xlsx' },
        }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getByTestId('crud-set-export'));
    const dialog = await screen.findByRole('dialog', { name: 'Export' });
    expect(dialog).toHaveClass('max-w-2xl');
    expect(screen.getByLabelText('Export file name')).toBeInTheDocument();
    expect(screen.getByLabelText('Export format')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Excel (.xlsx)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'CSV (.csv)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Code' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Title' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Code' }).className).toMatch(/emerald/);
    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    expect(screen.getByRole('button', { name: 'Code' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Code' }).className).toMatch(/slate/);
    expect(screen.getByRole('checkbox', { name: 'Include header' })).toBeChecked();
  });

  it('renders hero grid chrome shell when grid.chrome is hero', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          pagination: true,
          grid: { chrome: 'hero' },
        }}
        rows={rows}
      />,
    );

    expect(document.querySelector('[data-table-grid-chrome="hero"]')).toBeInTheDocument();
  });

  it('exports the full queried set via onFetchExportRows, not only the current page', async () => {
    const manyRows = Array.from({ length: 25 }, (_, index) => ({
      id: String(index + 1),
      code: `ORD-${String(index + 1).padStart(3, '0')}`,
      title: `Order ${index + 1}`,
      status: 'Open',
      locked: false,
    }));
    const onFetchExportRows = vi.fn(async () => manyRows);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'attachment; filename="orders.xlsx"' },
      blob: async () => new Blob(['xlsx'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    })) as unknown as typeof fetch;

    const createObjectURL = vi.fn(() => 'blob:export');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        el.click = () => undefined;
      }
      return el;
    });
    vi.stubGlobal('fetch', fetchImpl);

    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          pagination: true,
          paging: { defaultPageSize: 10 },
          export: { enabled: true, formats: ['xlsx'], defaultFormat: 'xlsx' },
        }}
        rows={manyRows.slice(0, 10)}
        onFetchExportRows={onFetchExportRows}
      />,
    );

    expect(screen.getByText('Order 1')).toBeInTheDocument();
    expect(screen.queryByText('Order 11')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('crud-set-export'));
    const dialog = await screen.findByRole('dialog', { name: 'Export' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Export' }));

    await vi.waitFor(() => {
      expect(onFetchExportRows).toHaveBeenCalledTimes(1);
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      PLATFORM_DATA_EXPORT_API_PATH,
      expect.objectContaining({ method: 'POST' }),
    );
    const posted = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      rows: Array<{ code: string }>;
    };
    expect(posted.rows).toHaveLength(25);
    expect(posted.rows[0]?.code).toBe('ORD-001');
    expect(posted.rows.at(-1)?.code).toBe('ORD-025');
  });

  it('groups kanban cards by status', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          listBody: 'kanban',
          refresh: false,
          kanban: {
            statusColumns: [
              { value: 'Open', label: 'Open' },
              { value: 'Approved', label: 'Approved' },
            ],
          },
        }}
        rows={rows}
      />,
    );

    expect(screen.getByTestId('crud-set-kanban')).toBeInTheDocument();
    expect(screen.getByText('First order')).toBeInTheDocument();
    expect(screen.getByText('Second order')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows kanban paging footer and hides the status toolbar filter', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          listBody: 'kanban',
          pagination: true,
          refresh: false,
          kanban: {
            statusColumns: [
              { value: 'Open', label: 'Open' },
              { value: 'Approved', label: 'Approved' },
            ],
          },
          filterBar: {
            enabled: true,
            search: true,
            filters: [{
              id: 'status',
              field: 'status',
              label: 'Status',
              controlType: 'radio-group',
              options: [
                { value: 'Open', label: 'Open' },
                { value: 'Approved', label: 'Approved' },
              ],
            }],
          },
        }}
        rows={rows}
      />,
    );

    expect(screen.getByTestId('crud-set-paging')).toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
  });

  it('aligns stacked title and status cells with their secondary lines', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          refresh: false,
          filterBar: { enabled: false },
          columns: [
            { field: 'title', label: 'Title', secondaryField: 'subtitle', stack: 'stacked' },
            { field: 'status', label: 'Status', cellKind: 'badge', secondaryField: 'approvedBy', stack: 'stacked' },
          ],
        }}
        rows={[{
          id: '1',
          code: 'ORD-001',
          title: 'First order',
          subtitle: 'Customer 1',
          status: 'Open',
          approvedBy: 'Admin',
        }]}
      />,
    );

    expect(screen.getByText('Customer 1').className).toContain('text-start');
    expect(screen.getByText('Admin').className).toContain('text-start');
    expect(screen.getByText('Customer 1').closest('.items-start')).toBeTruthy();
    expect(screen.getByText('Open').closest('.self-start')).toBeTruthy();
  });

  it('opens the content patch from the title column instead of row actions by default', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          refresh: false,
          readOneApi: { endpointId: 'orders.read' },
          patches: [{
            id: 'edit',
            label: 'Edit order',
            endpointId: 'orders.edit',
            kind: 'content',
            acceptedFields: ['title'],
          }],
        }}
        rows={rows}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Edit order' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'First order' }));
    expect(await screen.findByRole('dialog', { name: 'Edit order' })).toBeInTheDocument();
  });

  it('does not ask for a change reason on create', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          createApis: [{
            id: 'add-order',
            label: 'Add order',
            endpointId: 'orders.create',
            acceptedFields: ['title'],
          }],
        }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add order' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add order' });
    expect(within(dialog).queryByLabelText('Change reason')).not.toBeInTheDocument();
  });

  it('opens a change-reason overlay when saving a form patch', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          refresh: false,
          readOneApi: { endpointId: 'orders.read' },
          patches: [{
            id: 'edit',
            label: 'Edit order',
            endpointId: 'orders.edit',
            kind: 'content',
            acceptedFields: ['title'],
          }],
        }}
        changeReasonPolicy={{ reasonAsk: 'optional', reasonCapture: 'both' }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'First order' }));
    const edit = await screen.findByRole('dialog', { name: 'Edit order' });
    expect(within(edit).queryByLabelText('Change reason')).not.toBeInTheDocument();
    fireEvent.click(within(edit).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alertdialog', { name: 'Confirm save' })).toBeInTheDocument();
    expect(screen.getByLabelText('Change reason')).toBeInTheDocument();
    expect(within(screen.getByRole('alertdialog', { name: 'Confirm save' })).getByRole('button', { name: 'Save' }))
      .toHaveClass('bg-primary-600');
  });

  it('uses a primary confirm on toggle-confirm, not delete chrome', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          refresh: false,
          patches: [{
            id: 'lock',
            label: 'Lock',
            endpointId: 'orders.lock',
            kind: 'purpose',
            acceptedFields: ['locked'],
            interaction: 'boolean-toggle',
            toggleConfirm: true,
          }],
        }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Lock' })[0]);
    const overlay = await screen.findByRole('alertdialog', { name: 'Lock' });
    expect(within(overlay).getByRole('button', { name: 'Lock' })).toHaveClass('bg-primary-600');
  });

  it('does not open a change-reason overlay when Ask is omitted', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          refresh: false,
          readOneApi: { endpointId: 'orders.read' },
          patches: [{
            id: 'edit',
            label: 'Edit order',
            endpointId: 'orders.edit',
            kind: 'content',
            acceptedFields: ['title'],
          }],
        }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'First order' }));
    const edit = await screen.findByRole('dialog', { name: 'Edit order' });
    fireEvent.click(within(edit).getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('alertdialog', { name: 'Confirm save' })).not.toBeInTheDocument();
  });

  it('keeps the change-reason overlay open when save fails', async () => {
    const onPatch = vi.fn().mockRejectedValue(new Error('Update failed.'));
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          refresh: false,
          readOneApi: { endpointId: 'orders.read' },
          patches: [{
            id: 'edit',
            label: 'Edit order',
            endpointId: 'orders.edit',
            kind: 'content',
            acceptedFields: ['title'],
          }],
        }}
        changeReasonPolicy={{ reasonAsk: 'optional', reasonCapture: 'both' }}
        rows={rows}
        onPatch={onPatch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'First order' }));
    const edit = await screen.findByRole('dialog', { name: 'Edit order' });
    fireEvent.click(within(edit).getByRole('button', { name: 'Save' }));
    const overlay = await screen.findByRole('alertdialog', { name: 'Confirm save' });
    fireEvent.click(within(overlay).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onPatch).toHaveBeenCalled();
    });
    expect(screen.getByRole('alertdialog', { name: 'Confirm save' })).toBeInTheDocument();
  });

  it('keeps content edit in row actions when openFromColumnId is actions', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          refresh: false,
          readOneApi: { endpointId: 'orders.read' },
          patches: [{
            id: 'edit',
            label: 'Edit order',
            endpointId: 'orders.edit',
            kind: 'content',
            acceptedFields: ['title'],
            openFromColumnId: 'actions',
          }],
        }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit order' })[0]!);
    expect(await screen.findByRole('dialog', { name: 'Edit order' })).toBeInTheDocument();
    expect(screen.getByText('First order').closest('button')).toBeNull();
  });

  it('opens the content patch dialog when a kanban card is clicked', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          listBody: 'kanban',
          refresh: false,
          patches: [{
            id: 'edit',
            label: 'Edit order',
            endpointId: 'orders.edit',
            kind: 'content',
            acceptedFields: ['title'],
          }],
        }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'First order' }));
    expect(await screen.findByRole('dialog', { name: 'Edit order' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('First order');
  });

  it('plots map pins from latitude and longitude', () => {
    render(
      <CrudSet
        spec={{ ...baseSpec(), listBody: 'map', refresh: false }}
        rows={[
          { ...rows[0], latitude: 35.6892, longitude: 51.389 },
          { ...rows[1], latitude: 41.0082, longitude: 28.9784 },
        ]}
      />,
    );

    expect(screen.getByTestId('crud-set-map')).toBeInTheDocument();
    expect(screen.getByText(/First order/)).toBeInTheDocument();
    expect(screen.getByText(/35\.6892/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders custom empty copy and form-dialog size from grid and dialogs chrome', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          grid: { emptyMessage: 'Nothing here.' },
          dialogs: { formSize: 'sm' },
          createApis: [{
            id: 'add-order',
            label: 'Add order',
            endpointId: 'orders.create',
            acceptedFields: [],
          }],
        }}
        rows={[]}
      />,
    );

    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add order' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('This form has no fields.')).toBeInTheDocument();
  });

  it('caps visible row actions from actions.maxVisible', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          actions: { maxVisible: 1 },
          patches: [{
            id: 'approve',
            label: 'Approve',
            endpointId: 'orders.approve',
            kind: 'purpose',
            acceptedFields: ['status'],
          }],
          deleteApi: { endpointId: 'orders.delete' },
          readOneApi: { endpointId: 'orders.get' },
        }}
        rows={rows}
      />,
    );

    expect(screen.getAllByLabelText('More actions').length).toBeGreaterThan(0);
  });

  it('renders select, number, checkbox, chips, and hasMany editors for relation fields', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          refresh: false,
          filterBar: { enabled: false },
          columns: [
            { field: 'code', label: 'Code' },
            { field: 'title', label: 'Title' },
            { field: 'status', label: 'Status', cellKind: 'badge' },
            { field: 'parentTitle', label: 'Parent' },
            { field: 'tags', label: 'Tags', cellKind: 'chips' },
            { field: 'comments', label: 'Comments', cellKind: 'chips' },
            { field: 'detailNote', label: 'Detail note' },
            { field: 'latitude', label: 'Latitude' },
            { field: 'active', label: 'Active', cellKind: 'boolean-icon' },
          ],
          createApis: [{
            id: 'add-order',
            label: 'Add order',
            endpointId: 'orders.create',
            acceptedFields: ['code', 'title', 'status', 'parentTitle', 'tags', 'comments', 'detailNote', 'latitude', 'active'],
          }],
        }}
        rows={[
          { ...rows[0], title: 'First order', tags: ['Urgent'], comments: ['Need follow-up'] },
          { ...rows[1], title: 'Second order', tags: ['VIP'] },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add order' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Parent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Urgent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Detail note')).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toHaveAttribute('type', 'number');
    expect(screen.getByRole('checkbox', { name: 'Active' })).toBeChecked();
    expect(consoleError.mock.calls.flat().join('\n')).not.toMatch(/isInvalid|feedbackPlacement/);
    consoleError.mockRestore();
  });

  it('renders a plus create dropdown when multiple create APIs are configured', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          createLayout: 'adjacent',
          createApis: [
            { id: 'add-order', label: 'Add order', endpointId: 'orders.create', acceptedFields: ['title'] },
            { id: 'add-bulk', label: 'Add bulk', endpointId: 'orders.create-bulk', acceptedFields: ['title'] },
          ],
        }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('menuitem', { name: 'Add order' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Add bulk' })).toBeInTheDocument();
  });

  it('walks create wizard steps when a create API has two or more steps', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          createApis: [{
            id: 'add-order',
            label: 'Add order',
            endpointId: 'orders.create',
            acceptedFields: ['title', 'code'],
            steps: [
              { title: 'Identity', acceptedFields: ['title'] },
              { title: 'Details', acceptedFields: ['code'] },
            ],
          }],
        }}
        rows={rows}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add order' }));
    expect(await screen.findByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code')).not.toBeInTheDocument();
  });

  it('shows a collection confirm and calls onCollectionAction', async () => {
    const onCollectionAction = vi.fn();
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          collectionActions: [{ id: 'clear-all', label: 'Clear all', intent: 'destructive-soft', confirm: true }],
        }}
        rows={rows}
        onCollectionAction={onCollectionAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/queried set/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(onCollectionAction).toHaveBeenCalledTimes(1));
  });

  it('opens a thread view from a row action', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          dialogs: { viewKind: 'thread' },
          rowActions: [{ id: 'view', label: 'View', interaction: 'view' }],
        }}
        rows={[{
          ...rows[0],
          messages: [{ role: 'user', body: 'Please ship order 1.' }],
        }]}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]!);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Please ship order 1.')).toBeInTheDocument();
  });

  it('opens a JSON view from a row action', async () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          dialogs: { viewKind: 'json', jsonField: 'payload' },
          rowActions: [{ id: 'view', label: 'View', interaction: 'view' }],
        }}
        rows={[{ ...rows[0], payload: '{"ok":true}' }]}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]!);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument();
  });

  it('disables delete when deleteDisabledWhen matches has-children', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          deleteApi: { endpointId: 'orders.delete' },
          readOneApi: { endpointId: 'orders.read' },
          deleteDisabledWhen: { rule: 'has-children' },
        }}
        rows={[
          { ...rows[0], hasChildren: true },
          { ...rows[1], hasChildren: false },
        ]}
      />,
    );

    const deletes = screen.getAllByRole('button', { name: 'Delete' });
    expect(deletes[0]).toBeDisabled();
    expect(deletes[1]).not.toBeDisabled();
  });

  it('fills a distinct-rows filter from the current list values', () => {
    render(
      <CrudSet
        spec={{
          ...baseSpec(),
          filterBar: {
            enabled: true,
            search: false,
            filters: [{
              id: 'status',
              field: 'status',
              label: 'Status',
              controlType: 'radio-group',
              options: [],
              optionsFrom: 'distinct-rows',
            }],
          },
        }}
        rows={rows}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Approved' })).toBeInTheDocument();
  });

  it('shows an auto-refresh checkbox when autoRefresh is enabled', () => {
    render(
      <CrudSet
        spec={{ ...baseSpec(), autoRefresh: { enabled: true, seconds: 8 } }}
        rows={rows}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'Auto-refresh (8s)' })).toBeInTheDocument();
  });
});
