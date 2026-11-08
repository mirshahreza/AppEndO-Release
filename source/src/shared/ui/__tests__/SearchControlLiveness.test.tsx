/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSearchBox } from '../AppSearchBox';
import { SidebarMenuSearch } from '../SidebarMenuSearch';
import { ToolbarSearchInput } from '../ToolbarSearchInput';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
}));

describe('search control liveness', () => {
  afterEach(cleanup);

  it('maps panel clear and disabled options to observable input behavior', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AppSearchBox value="workflow" onChange={onChange} ariaLabel="Panel search" showClear />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear Panel search' }));
    expect(onChange).toHaveBeenCalledWith('');

    rerender(
      <AppSearchBox
        value="workflow"
        onChange={onChange}
        ariaLabel="Panel search"
        showClear={false}
        disabled
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Panel search' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Clear Panel search' })).not.toBeInTheDocument();
  });

  it('maps toolbar clear and disabled options without pointer-event CSS simulation', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ToolbarSearchInput value="record" onChange={onChange} ariaLabel="Toolbar search" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear toolbar search' }));
    expect(onChange).toHaveBeenCalledWith('');

    rerender(
      <ToolbarSearchInput value="record" onChange={onChange} ariaLabel="Toolbar search" disabled />,
    );
    expect(screen.getByRole('textbox', { name: 'Toolbar search' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Clear toolbar search' })).not.toBeInTheDocument();
  });

  it('clears the sidebar menu search from the trailing control and Escape', () => {
    const onChange = vi.fn();
    render(
      <SidebarMenuSearch value="users" onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear search menu' }));
    expect(onChange).toHaveBeenCalledWith('');

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search menu' }), { key: 'Escape' });
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
