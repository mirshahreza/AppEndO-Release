/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrudSetGridColumn } from '../../../domain/component-designer/crudSetSpec';
import { RECORD_FORM_DOCKED_DIALOG_CHROME, RecordForm } from '../RecordForm';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
  useOptionalCulture: () => null,
}));

afterEach(cleanup);

const columns: CrudSetGridColumn[] = [
  { field: 'code', label: 'Code', formPlacement: 'main' },
  { field: 'title', label: 'Title', formPlacement: 'main' },
  { field: 'active', label: 'Active', cellKind: 'boolean-icon', formPlacement: 'side' },
  { field: 'locked', label: 'Locked', cellKind: 'lock-status', formPlacement: 'side' },
];

describe('RecordForm', () => {
  it('puts checkboxes in the side panel with the control before the label', () => {
    render(
      <RecordForm
        mode="edit"
        columns={columns}
        fields={columns.map((column) => column.field)}
        values={{ code: 'REG-1', title: 'Northwind', active: true, locked: false }}
        sidePanelTitle="Flags"
      />,
    );

    expect(screen.getByTestId('record-form')).toHaveAttribute('data-docked', 'true');
    expect(screen.getByTestId('record-form-side')).toHaveTextContent('Flags');
    expect(screen.getByTestId('record-form-side')).toHaveAttribute('data-docked', 'true');
    expect(screen.getByTestId('record-form-side')).toHaveClass('border-s');
    expect(screen.getByTestId('record-form-side').className).not.toMatch(/rounded-lg/);
    expect(screen.getByTestId('record-form-main')).toHaveClass('p-[15px]');
    expect(screen.getByTestId('record-form-side')).toHaveAttribute('data-placement', 'end');
    expect(screen.getByTestId('record-form-side')).toHaveAttribute('data-background', 'theme');
    expect(screen.getByTestId('record-form-side')).toHaveStyle({ backgroundColor: 'var(--app-inspector-rail-bg)' });
    expect(screen.queryByTestId('record-form-side-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('record-form-side-pin')).not.toBeInTheDocument();
    expect(screen.getByTestId('record-form-side-split')).toBeInTheDocument();
    const splitter = screen.getByRole('separator', { name: 'Drag to resize' });
    expect(splitter.className).toContain('!bg-transparent');
    expect(splitter.querySelector('.rounded-full')).toBeNull();
    const active = screen.getByLabelText('Active');
    const row = active.closest('label');
    expect(row).toBeTruthy();
    expect(row!.firstElementChild).toContainElement(active);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByLabelText('Locked')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getAllByText('Locked')).toHaveLength(1);
  });

  it('renders view as read-only with disabled checkboxes and no text inputs', () => {
    render(
      <RecordForm
        mode="view"
        columns={columns}
        fields={columns.map((column) => column.field)}
        values={{ code: 'REG-1', title: 'Northwind', active: true, locked: false }}
        sidePanelTitle="Flags"
      />,
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const active = screen.getByLabelText('Active');
    const locked = screen.getByLabelText('Locked');
    expect(active).toBeDisabled();
    expect(locked).toBeDisabled();
    expect(active).toBeChecked();
    expect(locked).not.toBeChecked();
    expect(screen.getByText('REG-1')).toBeInTheDocument();
  });

  it('hides a field until visibleWhen matches', () => {
    render(
      <RecordForm
        mode="edit"
        columns={[
          { field: 'personType', label: 'Person type' },
          {
            field: 'companyName',
            label: 'Company',
            visibleWhen: { field: 'personType', equals: 'company' },
          },
        ]}
        fields={['personType', 'companyName']}
        values={{ personType: 'individual', companyName: '' }}
        sidePanelTitle="Flags"
      />,
    );

    expect(screen.getByLabelText('Person type')).toBeInTheDocument();
    expect(screen.queryByLabelText('Company')).not.toBeInTheDocument();
  });

  it('renders password and color controls', () => {
    render(
      <RecordForm
        mode="edit"
        columns={[
          { field: 'secret', label: 'Secret', formControl: 'password' },
          { field: 'accent', label: 'Accent', formControl: 'color' },
        ]}
        fields={['secret', 'accent']}
        values={{ secret: 'hidden', accent: '#0EA5E9' }}
        sidePanelTitle="Flags"
      />,
    );

    expect(screen.getByLabelText('Secret')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Accent')).toBeInTheDocument();
  });

  it('places the side panel on the physical left and puts the title in a header band', () => {
    render(
      <RecordForm
        mode="edit"
        columns={columns}
        fields={columns.map((column) => column.field)}
        values={{ code: 'REG-1', title: 'Northwind', active: true, locked: false }}
        sidePanelTitle="Flags"
        sidePanelPlacement="left"
        sidePanelTitleInHeader
      />,
    );

    const side = screen.getByTestId('record-form-side');
    expect(side).toHaveAttribute('data-placement', 'left');
    expect(side).toHaveClass('border-e');
    expect(side).toHaveAttribute('data-title-in-header', 'true');
    expect(screen.getByTestId('record-form-side-header')).toHaveTextContent('Flags');
    expect(screen.getByTestId('record-form-main').compareDocumentPosition(side) & Node.DOCUMENT_POSITION_PRECEDING)
      .toBeTruthy();
  });

  it('hides the side-panel title and collapses on pin', () => {
    render(
      <RecordForm
        mode="edit"
        columns={columns}
        fields={columns.map((column) => column.field)}
        values={{ code: 'REG-1', title: 'Northwind', active: true, locked: false }}
        sidePanelTitle="Flags"
        sidePanelShowTitle={false}
        sidePanelPinnable
        sidePanelSplitter
      />,
    );

    expect(screen.getByTestId('record-form-side')).not.toHaveTextContent('Flags');
    expect(screen.getByTestId('record-form-side-split')).toBeInTheDocument();
    const splitter = screen.getByRole('separator', { name: 'Drag to resize' });
    expect(splitter.className).toContain('!bg-transparent');
    expect(splitter.querySelector('.rounded-full')).toBeNull();
    fireEvent.click(screen.getByTestId('record-form-side-pin'));
    expect(screen.getByTestId('record-form-side')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.queryByLabelText('Active')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('record-form-side-pin'));
    expect(screen.getByLabelText('Active')).toBeInTheDocument();
  });

  it('fills the side panel from a specific color when background is custom', () => {
    render(
      <RecordForm
        mode="edit"
        columns={columns}
        fields={columns.map((column) => column.field)}
        values={{ code: 'REG-1', title: 'Northwind', active: true, locked: false }}
        sidePanelTitle="Flags"
        sidePanelBackground="custom"
        sidePanelBackgroundColor="#FFF7ED"
      />,
    );

    const side = screen.getByTestId('record-form-side');
    expect(side).toHaveAttribute('data-background', 'custom');
    expect(side).toHaveStyle({ backgroundColor: '#FFF7ED' });
  });

  it('keeps locked fields read-only in edit mode', () => {
    render(
      <RecordForm
        mode="edit"
        columns={columns}
        fields={columns.map((column) => column.field)}
        values={{ code: 'REG-1', title: 'Northwind', active: true, locked: false }}
        sidePanelTitle="Flags"
        lockedFields={['code']}
      />,
    );

    expect(screen.queryByLabelText('Code')).not.toBeInTheDocument();
    expect(screen.getByText('REG-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('shows History on tracked edit fields and hides it on create', () => {
    const onOpenFieldHistory = vi.fn();

    const { rerender } = render(
      <RecordForm
        mode="edit"
        columns={columns}
        fields={['code', 'title']}
        values={{ code: 'REG-1', title: 'Northwind' }}
        historyTrackedFields={['title']}
        onOpenFieldHistory={onOpenFieldHistory}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(onOpenFieldHistory).toHaveBeenCalledWith('title');
    expect(screen.queryByText(/Last changed/)).not.toBeInTheDocument();

    rerender(
      <RecordForm
        mode="create"
        columns={columns}
        fields={['code', 'title']}
        values={{ code: '', title: '' }}
        historyTrackedFields={['title']}
        onOpenFieldHistory={onOpenFieldHistory}
      />,
    );
    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument();
  });

  it('docks the side rail with a full-height stretch and a flush footer', () => {
    expect(RECORD_FORM_DOCKED_DIALOG_CHROME.bodyClassName).toContain('flex-1');
    expect(RECORD_FORM_DOCKED_DIALOG_CHROME.bodyClassName).toContain('!p-0');
    expect(RECORD_FORM_DOCKED_DIALOG_CHROME.bodyOuterClassName).toContain('flex-col');
    expect(RECORD_FORM_DOCKED_DIALOG_CHROME.footerClassName).toBe('!mt-0');

    render(
      <RecordForm
        mode="edit"
        columns={columns}
        fields={columns.map((column) => column.field)}
        values={{ code: 'REG-1', title: 'Northwind', active: true, locked: false }}
        sidePanelTitle="Flags"
      />,
    );

    expect(screen.getByTestId('record-form-side')).toHaveClass('self-stretch');
    expect(screen.getByTestId('record-form-side').className).not.toMatch(/\bh-full\b/);
    expect(screen.getByTestId('record-form')).toHaveClass('self-stretch', 'flex-1');
  });
});
