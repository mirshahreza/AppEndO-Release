/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ToolbarCreateControl } from '../ToolbarCreateControl';

afterEach(() => {
  cleanup();
});

describe('ToolbarCreateControl', () => {
  it('renders icon-only plus for a single create target', () => {
    render(
      <ToolbarCreateControl
        items={[{ id: 'one', label: 'Add role', onClick: vi.fn() }]}
      />,
    );

    const button = screen.getByRole('button', { name: 'Add role' });
    expect(button).toBeInTheDocument();
    expect(button.textContent?.trim()).toBe('');
  });

  it('opens a dropdown with labeled items for multiple create targets', async () => {
    const onIndividual = vi.fn();
    const onCompany = vi.fn();

    render(
      <ToolbarCreateControl
        items={[
          { id: 'individual', label: 'Add Individual', onClick: onIndividual },
          { id: 'company', label: 'Add Company', onClick: onCompany },
        ]}
        triggerAriaLabel="Create user"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create user' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add Company' }));
    });

    expect(onCompany).toHaveBeenCalledTimes(1);
    expect(onIndividual).not.toHaveBeenCalled();
  });
});
