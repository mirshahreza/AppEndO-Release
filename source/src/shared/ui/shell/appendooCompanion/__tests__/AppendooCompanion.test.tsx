// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppendooCompanion } from '../AppendooCompanion';
import { APPENDOO_COMPANION_POSITION_STORAGE_KEY } from '../appendooCompanion.types';

describe('AppendooCompanion', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  it('toggles the AppEndoo panel on pointer click', () => {
    const onOpenChange = vi.fn();

    render(
      <AppendooCompanion
        isOpen={false}
        onOpenChange={onOpenChange}
        openAriaLabel="Open AppEndoo"
        closeAriaLabel="Close AppEndoo"
        untuckAriaLabel="Show AppEndoo"
      />,
    );

    const companion = screen.getByTestId('appendoo-companion');
    fireEvent.pointerDown(companion, { button: 0, pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(companion, { button: 0, pointerId: 1, clientX: 40, clientY: 40 });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(window.localStorage.getItem(APPENDOO_COMPANION_POSITION_STORAGE_KEY)).toBeNull();
  });
});
