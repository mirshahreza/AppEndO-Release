/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CatalogTagsField } from '../CatalogTagsField';
import { DesignerDialogHostContext } from '../designerDialogHostContext';

afterEach(() => {
  cleanup();
});

describe('CatalogTagsField', () => {
  it('creates a tag from typed text on Enter', () => {
    const handleChange = vi.fn();

    render(
      <CatalogTagsField
        value={[]}
        onChange={handleChange}
        suggestions={['billing']}
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.change(input, { target: { value: 'crm' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith(['crm']);
  });

  it('creates a tag from typed text on Enter inside a designer dialog', () => {
    const handleChange = vi.fn();

    render(
      <DesignerDialogHostContext.Provider value>
        <CatalogTagsField
          value={[]}
          onChange={handleChange}
          suggestions={['billing']}
        />
      </DesignerDialogHostContext.Provider>,
    );

    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.change(input, { target: { value: 'crm' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith(['crm']);
  });

  it('does not show previous tags until the operator types', () => {
    render(
      <DesignerDialogHostContext.Provider value>
        <CatalogTagsField
          value={[]}
          onChange={() => undefined}
          suggestions={['billing']}
        />
      </DesignerDialogHostContext.Provider>,
    );

    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.focus(input);
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'bil' } });
    expect(screen.getByRole('option', { name: 'billing' })).toBeInTheDocument();
  });

  it('picks a previous tag from the in-dialog listbox', () => {
    const handleChange = vi.fn();

    render(
      <DesignerDialogHostContext.Provider value>
        <CatalogTagsField
          value={[]}
          onChange={handleChange}
          suggestions={['billing']}
        />
      </DesignerDialogHostContext.Provider>,
    );

    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.focus(input);
    expect(screen.queryByRole('option', { name: 'billing' })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'bil' } });
    fireEvent.click(screen.getByRole('option', { name: 'billing' }));

    expect(handleChange).toHaveBeenCalledWith(['billing']);
  });

  it('keeps focus in the field after creating a tag with Enter', () => {
    const Harness = () => {
      const [tags, setTags] = React.useState<string[]>([]);
      return (
        <DesignerDialogHostContext.Provider value>
          <CatalogTagsField value={tags} onChange={setTags} suggestions={['billing']} />
        </DesignerDialogHostContext.Provider>
      );
    };

    render(<Harness />);

    const input = screen.getByRole('combobox', { name: 'Tags' });
    input.focus();
    fireEvent.change(input, { target: { value: 'crm' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('crm')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Tags' })).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Tags' })).toHaveValue('');
  });
});
