/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BASE_COMPONENTS_PAGE_SCROLL_AREA_PROPS,
  BaseComponentsPageScrollArea,
} from '../BaseComponentsPageScrollArea';

describe('BaseComponentsPageScrollArea', () => {
  afterEach(cleanup);

  it('uses the public nudge chrome for page sections', () => {
    expect(BASE_COMPONENTS_PAGE_SCROLL_AREA_PROPS).toEqual({
      variant: 'nudge',
      axis: 'vertical',
      dir: 'ltr',
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
        <BaseComponentsPageScrollArea className="flex-1" aria-label="Page section">
          <p>Section body</p>
        </BaseComponentsPageScrollArea>
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
    expect(host).not.toHaveAttribute('data-nudge-decrease');
    expect(host).not.toHaveAttribute('data-nudge-increase');
    expect(screen.queryByRole('button', { name: 'Scroll up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll down' })).toBeNull();
    expect(screen.getByLabelText('Page section')).toHaveClass('ui-scroll-area-hide-thumb');
    expect(screen.getByText('Section body')).toBeInTheDocument();
  });
});
