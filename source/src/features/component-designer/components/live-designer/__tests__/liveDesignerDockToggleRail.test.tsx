// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LIVE_DESIGNER_DOCK_TOGGLE_RAIL_LABEL_CLASS } from '../../../../../shared/ui/surfaceClasses';
import { LiveDesignerDockToggleRail } from '../LiveDesignerDockToggleRail';

afterEach(() => {
  cleanup();
});

describe('LiveDesignerDockToggleRail', () => {
  it('toggles with vertical label text', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <LiveDesignerDockToggleRail
        label="Outline"
        hint="Shows the tree of controls on this layout so you can select nested nodes."
        open={false}
        onToggle={onToggle}
        side="start"
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Show Outline' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle.querySelector('span')).toHaveClass(
      ...LIVE_DESIGNER_DOCK_TOGGLE_RAIL_LABEL_CLASS.split(' '),
    );
    expect(toggle.querySelector('span')).toHaveClass('rotate-180');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <LiveDesignerDockToggleRail
        label="Outline"
        hint="Shows the tree of controls on this layout so you can select nested nodes."
        open
        onToggle={onToggle}
        side="start"
      />,
    );

    expect(screen.getByRole('button', { name: 'Hide Outline' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fills the workspace height instead of sharing a split column', () => {
    render(
      <div className="flex h-[400px]">
        <LiveDesignerDockToggleRail
          label="Properties"
          hint="Shows the selected node’s properties beside the canvas."
          open={false}
          onToggle={() => undefined}
          side="end"
        />
        <LiveDesignerDockToggleRail
          label="Code"
          hint="Shows the generated source for this layout as a read-only reference."
          open={false}
          onToggle={() => undefined}
          side="end"
        />
      </div>,
    );

    const properties = screen.getByRole('button', { name: 'Show Properties' });
    const code = screen.getByRole('button', { name: 'Show Code' });
    expect(properties).toHaveClass('h-full', 'self-stretch');
    expect(code).toHaveClass('h-full', 'self-stretch');
    expect(properties).not.toHaveClass('flex-1');
    expect(code).not.toHaveClass('flex-1');
  });
});
