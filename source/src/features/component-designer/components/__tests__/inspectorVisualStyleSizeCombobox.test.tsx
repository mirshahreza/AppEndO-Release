// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InspectorVisualStylePanel, normalizeSizeInputToUtility } from '../InspectorVisualStylePanel';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 32,
    right: 160,
    width: 160,
    height: 32,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const StyleHarness: React.FC = () => {
  const [className, setClassName] = React.useState('');
  return (
    <InspectorVisualStylePanel
      className={className}
      breakpoint=""
      onBreakpointChange={() => undefined}
      onClassNameChange={setClassName}
    />
  );
};

const press = (element: HTMLElement) => {
  fireEvent.pointerDown(element);
  fireEvent.pointerUp(element);
  fireEvent.click(element);
};

const openSizeList = async (ariaLabel: 'Width' | 'Height') => {
  const triggers = screen.getAllByRole('button', { name: 'Show suggestions' });
  const index = ariaLabel === 'Width' ? 0 : 1;
  press(triggers[index]!);
  await waitFor(() => {
    expect(screen.getByRole('option', { name: ariaLabel === 'Width' ? 'w-full' : 'h-full' })).toBeInTheDocument();
  });
};

describe('InspectorVisualStylePanel Width/Height combobox', () => {
  it('closes the Width list after picking a preset (does not reopen while focused)', async () => {
    render(<StyleHarness />);

    await openSizeList('Width');
    press(screen.getByRole('option', { name: 'w-full' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('option', { name: 'w-full' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Width' })).toHaveValue('w-full');

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    });
    expect(screen.queryByRole('option', { name: 'w-full' })).not.toBeInTheDocument();

    await openSizeList('Width');
    expect(screen.getByRole('option', { name: 'w-full' })).toBeInTheDocument();
  });

  it('closes the Height list after picking a preset (does not reopen while focused)', async () => {
    render(<StyleHarness />);

    await openSizeList('Height');
    press(screen.getByRole('option', { name: 'h-full' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole('option', { name: 'h-full' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Height' })).toHaveValue('h-full');
  });
});

describe('normalizeSizeInputToUtility', () => {
  const heightPresets = new Set(['', 'h-auto', 'h-full', 'h-8']);

  it('maps 100% to h-full so percentage height uses a real Tailwind class', () => {
    expect(normalizeSizeInputToUtility('100%', 'h', heightPresets)).toBe('h-full');
    expect(normalizeSizeInputToUtility('100 %', 'h', heightPresets)).toBe('h-full');
    expect(normalizeSizeInputToUtility('full', 'h', heightPresets)).toBe('h-full');
  });

  it('still maps a bare number to an arbitrary px utility', () => {
    expect(normalizeSizeInputToUtility('100', 'h', heightPresets)).toBe('h-[100px]');
  });
});

