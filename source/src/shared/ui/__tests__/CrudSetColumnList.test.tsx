/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrudSetGridColumn } from '../../../domain/component-designer/crudSetSpec';
import { CrudSetColumnList } from '../CrudSetColumnList';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
  useOptionalCulture: () => null,
}));

afterEach(cleanup);

const initialColumns: CrudSetGridColumn[] = [
  { field: 'code', label: 'Code' },
  { field: 'title', label: 'Title' },
];

const ListHarness: React.FC = () => {
  const [columns, setColumns] = React.useState(initialColumns);
  return (
    <CrudSetColumnList
      columns={columns}
      fieldOptions={['code', 'title', 'status']}
      onChange={setColumns}
    />
  );
};

describe('CrudSetColumnList', () => {
  it('shows column names only until Edit opens the details dialog', () => {
    render(<ListHarness />);

    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dataset field for Code')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Code' }));

    expect(screen.getByRole('dialog', { name: 'Edit Code' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dataset field for Code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('offers the same add-column chips as the living sample', () => {
    const onChange = vi.fn();
    render(
      <CrudSetColumnList
        columns={initialColumns}
        suggestedFields={['code', 'title', 'status']}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add column status' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add column code' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add column status' }));
    expect(onChange).toHaveBeenCalledWith([
      ...initialColumns,
      expect.objectContaining({ field: 'status', label: 'Status' }),
    ]);
  });

  it('reorders columns when move up or down is clicked', () => {
    render(<ListHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Move column 2 up' }));

    const labels = screen.getAllByText(/^(Code|Title)$/).map((node) => node.textContent);
    expect(labels).toEqual(['Title', 'Code']);
  });
});
