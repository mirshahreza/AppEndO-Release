// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LiveDesignerToolbar } from '../LiveDesignerToolbar';

const noop = () => undefined;

afterEach(() => {
  cleanup();
});

const toolbarProps = {
  onBack: noop,
  onSave: noop,
};

describe('LiveDesignerToolbar AI toggle', () => {
  it('does not expose a Toolbox header toggle', () => {
    render(<LiveDesignerToolbar {...toolbarProps} />);

    expect(screen.queryByRole('button', { name: 'Toolbox' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Outline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Properties' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Code reference' })).not.toBeInTheDocument();
  });

  it('hides the AI assistant control when AI is disabled', () => {
    render(<LiveDesignerToolbar {...toolbarProps} />);

    expect(screen.queryByRole('button', { name: 'Show AI assistant' })).not.toBeInTheDocument();
  });

  it('toggles the AI assistant like Server Functions', () => {
    const onToggleAi = vi.fn();
    const { rerender } = render(
      <LiveDesignerToolbar
        {...toolbarProps}
        showAi
        aiOpen={false}
        onToggleAi={onToggleAi}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Show AI assistant' });
    fireEvent.click(toggle);
    expect(onToggleAi).toHaveBeenCalledTimes(1);

    rerender(
      <LiveDesignerToolbar
        {...toolbarProps}
        showAi
        aiOpen
        onToggleAi={onToggleAi}
      />,
    );

    expect(screen.getByRole('button', { name: 'Hide AI assistant' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the Save label while busy so the toolbar button does not grow', () => {
    const { rerender } = render(
      <LiveDesignerToolbar {...toolbarProps} canSave isSaving={false} />,
    );
    const idle = screen.getByRole('button', { name: 'Save draft' });
    expect(idle).toHaveTextContent('Save');
    expect(idle).not.toHaveTextContent('Saving');
    const idleWidth = idle.getBoundingClientRect().width;

    rerender(<LiveDesignerToolbar {...toolbarProps} canSave isSaving />);
    const busy = screen.getByRole('button', { name: 'Save draft' });
    expect(busy).toHaveTextContent('Save');
    expect(busy).not.toHaveTextContent('Saving');
    expect(busy.getBoundingClientRect().width).toBe(idleWidth);
  });
});
