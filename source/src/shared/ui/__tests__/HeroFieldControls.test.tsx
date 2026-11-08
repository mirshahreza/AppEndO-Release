/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignerDialogHostContext } from '../designerDialogHostContext';
import { UiInput, UiSelect, UiTextarea } from '../HeroFieldControls';

describe('UiInput adornments', () => {
  it('renders plain text adornments without icon ref syntax', () => {
    render(
      <UiInput
        ariaLabel="Search field"
        startContent="Search"
        endContent="@"
      />,
    );

    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByText('@')).toBeTruthy();
    expect(screen.queryByText('lucide:Settings')).toBeNull();
  });

  it('renders icon picker refs as icons instead of raw labels', () => {
    const { container } = render(
      <UiInput
        ariaLabel="Title field"
        startContent="lucide:Settings"
        endContent="lucide:Search"
      />,
    );

    expect(screen.queryByText('lucide:Settings')).toBeNull();
    expect(screen.queryByText('lucide:Search')).toBeNull();
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
  });
});

describe('text field auto direction', () => {
  it('detects an asynchronously loaded input default value before paint', () => {
    const { rerender } = render(
      <UiInput ariaLabel="Localized title" defaultValue="" />,
    );

    rerender(<UiInput ariaLabel="Localized title" defaultValue="عنوان فارسی" />);

    expect(screen.getByRole('textbox', { name: 'Localized title' }).getAttribute('dir')).toBe('rtl');
  });

  it('detects an asynchronously loaded textarea default value before paint', () => {
    const { rerender } = render(
      <UiTextarea ariaLabel="Localized notes" defaultValue="" />,
    );

    rerender(<UiTextarea ariaLabel="Localized notes" defaultValue="یادداشت فارسی" />);

    expect(screen.getByRole('textbox', { name: 'Localized notes' }).getAttribute('dir')).toBe('rtl');
  });
});

describe('UiSelect option parsing', () => {
  it('renders native select options when children are wrapped in a Fragment', () => {
    render(
      <DesignerDialogHostContext.Provider value>
        <UiSelect value="title" ariaLabel="Record field">
          <>
            <option value="title">title</option>
            <option value="short_name">short_name</option>
          </>
        </UiSelect>
      </DesignerDialogHostContext.Provider>,
    );

    const select = screen.getByRole('combobox', { name: 'Record field' }) as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.options[0]?.value).toBe('title');
    expect(select.options[1]?.value).toBe('short_name');
  });
});
