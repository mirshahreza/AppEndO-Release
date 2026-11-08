/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Grid2X2, List } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiSegmentedControl } from '../UiSegmentedControl';

vi.mock('@heroui/react', async () => {
  const ReactModule = await import('react');
  const Context = ReactModule.createContext<any>(null);
  const ToggleButtonGroup = ReactModule.forwardRef<HTMLDivElement, any>(
    (
      {
        children,
        selectedKeys,
        onSelectionChange,
        isDisabled,
        selectionMode,
        disallowEmptySelection,
        fullWidth,
        size,
        ...props
      },
      ref,
    ) => (
      <Context.Provider value={{ selectedKeys, onSelectionChange, isDisabled }}>
        <div
          ref={ref}
          role="group"
          aria-disabled={isDisabled || undefined}
          data-selection-mode={selectionMode}
          data-disallow-empty={disallowEmptySelection || undefined}
          data-full-width={fullWidth || undefined}
          data-size={size}
          {...props}
        >
          {children}
        </div>
      </Context.Provider>
    ),
  );
  const ToggleButton = ReactModule.forwardRef<HTMLButtonElement, any>(
    ({ children, id, isDisabled, isIconOnly: _isIconOnly, variant: _variant, ...props }, ref) => {
      const context = ReactModule.useContext(Context);
      const selected = context.selectedKeys.has(id);
      return (
        <button
          ref={ref}
          type="button"
          aria-pressed={selected}
          disabled={context.isDisabled || isDisabled}
          onClick={() => context.onSelectionChange(new Set([id]))}
          {...props}
        >
          {children}
        </button>
      );
    },
  );
  return { ToggleButton, ToggleButtonGroup };
});

const items = [
  { id: 'grid', label: 'Grid', accessibleLabel: 'Grid view', icon: Grid2X2 },
  { id: 'list', label: 'List', accessibleLabel: 'List view', icon: List },
];

describe('UiSegmentedControl', () => {
  afterEach(cleanup);

  it('uses an immediate, non-empty single-select group', () => {
    const onSelectionChange = vi.fn();
    render(
      <UiSegmentedControl
        ariaLabel="Display mode"
        items={items}
        defaultSelectedKey="grid"
        onSelectionChange={onSelectionChange}
      />,
    );

    const group = screen.getByRole('group', { name: 'Display mode' });
    expect(group).toHaveAttribute('data-selection-mode', 'single');
    expect(group).toHaveAttribute('data-disallow-empty', 'true');
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(onSelectionChange).toHaveBeenCalledWith('list');
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('supports controlled selection, equal width, and disabled items', () => {
    render(
      <UiSegmentedControl
        ariaLabel="Display mode"
        items={[items[0], { ...items[1], disabled: true }]}
        selectedKey="grid"
        width="equal"
        orientation="vertical"
      />,
    );

    expect(screen.getByRole('group')).toHaveAttribute('data-full-width', 'true');
    expect(screen.getByRole('group')).toHaveAttribute('data-width', 'equal');
    expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'vertical');
    expect(screen.getByRole('group')).toHaveClass('flex-col');
    expect(screen.getByRole('button', { name: 'List' })).toBeDisabled();
  });

  it('gives icon-only segments accessible names and tooltips', () => {
    render(
      <UiSegmentedControl
        ariaLabel="Display mode"
        items={items}
        visualMode="icon-only"
      />,
    );

    expect(screen.getByRole('button', { name: 'Grid view' })).toBeTruthy();
    expect(screen.getByRole('tooltip', { name: 'Grid view' })).toBeTruthy();
    expect(screen.getByRole('tooltip', { name: 'List view' })).toBeTruthy();
  });
});
