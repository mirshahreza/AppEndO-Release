// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeTokenEditor } from '../ThemeTokenEditor';
import { deriveThemeTokensFromBase } from '../../../../shared/theme/themePresetUtils';

describe('ThemeTokenEditor chrome finish', () => {
  it('exposes sidebar fill and chrome texture sliders', () => {
    const tokens = deriveThemeTokensFromBase('#038387', 'fluent');
    const onTokenChange = vi.fn();

    render(
      <ThemeTokenEditor
        tokens={tokens}
        onTokenChange={onTokenChange}
        onRegenerateFromBase={() => undefined}
        onUndo={() => undefined}
        onRedo={() => undefined}
      />,
    );

    const sidebarFill = screen.getByLabelText('Sidebar fill');
    expect(sidebarFill).toBeTruthy();
    expect(screen.getByLabelText('Header fill')).toBeTruthy();
    expect(screen.getByLabelText('Menu texture')).toBeTruthy();
    expect(screen.getByLabelText('Header texture')).toBeTruthy();

    fireEvent.change(sidebarFill, { target: { value: '40' } });
    expect(onTokenChange).toHaveBeenCalledWith('--app-sidebar-fill-opacity', '40%');
  });

  it('enables undo control when canUndo is true', () => {
    const tokens = deriveThemeTokensFromBase('#038387', 'fluent');
    render(
      <ThemeTokenEditor
        tokens={tokens}
        onTokenChange={() => undefined}
        onRegenerateFromBase={() => undefined}
        onUndo={() => undefined}
        onRedo={() => undefined}
        canUndo
      />,
    );

    const undoButtons = screen.getAllByRole('button', { name: 'Undo' });
    expect(undoButtons.some((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
  });
});
