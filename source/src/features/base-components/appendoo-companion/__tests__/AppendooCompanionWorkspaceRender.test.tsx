// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccentThemeProvider } from '../../../../contexts/AccentThemeContext';
import { BaseComponentsPageHeaderProvider } from '../../components/BaseComponentsPageHeaderContext';
import { AppendooCompanionBaseComponentsWorkspace } from '../AppendooCompanionBaseComponentsWorkspace';

describe('AppendooCompanionBaseComponentsWorkspace', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  it('renders the playground without throwing', () => {
    expect(() => {
      render(
        <AccentThemeProvider>
          <BaseComponentsPageHeaderProvider>
            <AppendooCompanionBaseComponentsWorkspace />
          </BaseComponentsPageHeaderProvider>
        </AccentThemeProvider>,
      );
    }).not.toThrow();
    expect(screen.getByTestId('appendoo-companion-stage')).toBeTruthy();
    expect(screen.getByTestId('appendoo-companion-stage').getAttribute('data-wonk')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Wonk 10' }));
    expect(screen.getByTestId('appendoo-companion-stage').getAttribute('data-wonk')).toBe('10');
    expect(screen.getByTestId('appendoo-companion-stage').getAttribute('data-wonk-scatter')).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: 'Scatter' }));
    expect(screen.getByTestId('appendoo-companion-stage').getAttribute('data-wonk-scatter')).toBe('on');
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }));
    expect(screen.getByTestId('appendoo-companion-stage').getAttribute('data-wonk-seed')).toBe('2');
    expect(screen.getByTestId('appendoo-companion-stage').getAttribute('data-lean')).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Lean Right' }));
    expect(screen.getByTestId('appendoo-companion-stage').getAttribute('data-lean')).toBe('right');
    fireEvent.click(screen.getByRole('button', { name: 'Lean Both' }));
    expect(screen.getByTestId('appendoo-companion-stage').getAttribute('data-lean')).toBe('both');
  });
});
