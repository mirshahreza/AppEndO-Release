/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DialogHostProvider } from '../dialog/DialogHostContext';
import { UiSelectMenu } from '../UiSelectMenu';

const menuOptions = [
  { id: 'id', textValue: 'id', content: 'id' },
  { id: 'title', textValue: 'title', content: 'title' },
];

describe('UiSelectMenu portaled menu', () => {
  it('renders a body-portaled listbox inside dialog shells', () => {
    render(
      <DialogHostProvider>
        <UiSelectMenu
          ariaLabel="Field"
          selectedKey="id"
          options={menuOptions}
          onSelectionChange={() => {}}
        />
      </DialogHostProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Field' }));

    const listbox = screen.getByRole('listbox', { name: 'Field' });
    expect(listbox.parentElement).toBe(document.body);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('keeps field chrome when triggerClassName adds typography only', () => {
    render(
      <DialogHostProvider>
        <UiSelectMenu
          ariaLabel="Province"
          selectedKey="id"
          options={menuOptions}
          triggerClassName="font-semibold text-slate-900"
          onSelectionChange={() => {}}
        />
      </DialogHostProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Province' });
    expect(trigger.className).toMatch(/!h-8/);
    expect(trigger.className).toMatch(/border/);
    expect(trigger.textContent).toContain('id');
  });
});
