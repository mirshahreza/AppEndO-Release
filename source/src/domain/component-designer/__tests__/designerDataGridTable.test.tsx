/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { DesignerDataGridTable } from '../DesignerDataGridTable';

type Row = { id: number; name: string };

const COLUMNS: AppTableGridColumnDef<Row>[] = [
  {
    id: 'name',
    label: 'Name',
    sort: { mode: 'client' },
    filter: { mode: 'client', type: 'text' },
    getSortValue: (row) => row.name,
    getFilterValue: (row) => row.name,
    renderCell: (row) => row.name,
  },
];

const ROWS: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
];

describe('DesignerDataGridTable', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the header visible when filtered rows are empty', () => {
    const Harness: React.FC = () => {
      const [query, setQuery] = React.useState({
        sort: null,
        filters: {
          name: { type: 'text' as const, value: 'missing-value' },
        },
      });

      return (
        <DesignerDataGridTable
          columns={COLUMNS}
          rows={ROWS}
          getRowKey={(row) => String(row.id)}
          query={query}
          onQueryChange={setQuery}
          emptyMessage="No matches"
        />
      );
    };

    render(<Harness />);

    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('No matches')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('filters rows on the client when filter is committed', () => {
    render(
      <DesignerDataGridTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={(row) => String(row.id)}
      />,
    );

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /filter name/i }));
    const input = screen.getByRole('textbox', { name: /filter name/i });
    fireEvent.change(input, { target: { value: 'Alpha' } });
    fireEvent.click(screen.getByRole('button', { name: /apply filter/i }));

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
  });
});
