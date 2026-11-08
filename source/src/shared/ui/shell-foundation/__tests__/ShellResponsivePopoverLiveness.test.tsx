/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellResponsivePopover } from '../ShellResponsivePopover';

describe('ShellResponsivePopover dismissal liveness', () => {
  afterEach(cleanup);

  it('honors outside and Escape dismissal independently', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ShellResponsivePopover
        open
        onOpenChange={onOpenChange}
        trigger={<button type="button">Open</button>}
        dismissOnOutside={false}
        dismissOnEscape
      >
        Guidance
      </ShellResponsivePopover>,
    );

    fireEvent.pointerDown(document.body);
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    rerender(
      <ShellResponsivePopover
        open
        onOpenChange={onOpenChange}
        trigger={<button type="button">Open</button>}
        dismissOnOutside
        dismissOnEscape={false}
      >
        Guidance
      </ShellResponsivePopover>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('exposes resolved placement for collision-aware previews', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.tagName === 'BUTTON') {
        return {
          x: 480, y: 360, top: 360, bottom: 392, left: 480, right: 560, width: 80, height: 32, toJSON() { return {}; },
        };
      }
      return {
        x: 380, y: 180, top: 180, bottom: 340, left: 380, right: 560, width: 180, height: 160, toJSON() { return {}; },
      };
    });

    render(
      <ShellResponsivePopover
        open
        onOpenChange={() => undefined}
        trigger={<button type="button">Open</button>}
        placement="top-end"
        fallbackPlacement="bottom-start"
      >
        Guidance
      </ShellResponsivePopover>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('data-placement', 'top-end');
    expect(screen.getByRole('dialog')).toHaveAttribute('data-fallback-placement', 'bottom-start');
  });
});
