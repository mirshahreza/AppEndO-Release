/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UI_SCROLL_AREA_POINTER_NUDGE_PROPS } from '../UiScrollArea';
import { SidebarMenuScrollArea } from '../SidebarMenuScrollArea';

describe('SidebarMenuScrollArea', () => {
  afterEach(cleanup);

  it('uses the pointer-reveal nudge chrome from Base Components Scroll Area', () => {
    expect(UI_SCROLL_AREA_POINTER_NUDGE_PROPS).toMatchObject({
      variant: 'nudge',
      axis: 'vertical',
      drag: true,
      stepPx: 72,
      nudgeReveal: 'pointer',
      nudgePlacement: 'overlay',
      nudgeSlot: 'band',
      nudgeIconSize: 18,
      nudgeMark: 'button',
      nudgeMarkShape: 'circle',
      nudgeOpacity: 1,
    });

    const { container } = render(
      <div style={{ height: 240 }}>
        <SidebarMenuScrollArea className="flex-1" dir="ltr">
          <p>Studio pages</p>
        </SidebarMenuScrollArea>
      </div>,
    );

    const host = container.querySelector('[data-ui-scroll-area]');
    expect(host).toHaveAttribute('data-variant', 'nudge');
    expect(host).toHaveAttribute('data-axis', 'vertical');
    expect(host).toHaveAttribute('dir', 'ltr');
    expect(host).toHaveAttribute('data-nudge-placement', 'overlay');
    expect(host).not.toHaveAttribute('data-nudge-visible');
    expect(host).toHaveAttribute('data-nudge-reveal', 'pointer');
    expect(host).toHaveAttribute('data-nudge-slot', 'band');
    expect(host).toHaveAttribute('data-nudge-icon-size', '18');
    expect(host).toHaveAttribute('data-nudge-mark', 'button');
    expect(host).toHaveAttribute('data-nudge-shape', 'circle');
    expect(screen.queryByRole('button', { name: 'Scroll up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll down' })).toBeNull();
    expect(screen.getByLabelText('Navigation')).toHaveClass('ui-scroll-area-hide-thumb');
    expect(screen.getByLabelText('Navigation')).toHaveClass('cursor-default');
    expect(screen.getByLabelText('Navigation')).not.toHaveClass('cursor-grab');
    expect(screen.getByText('Studio pages')).toBeInTheDocument();
  });
});
