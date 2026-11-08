/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ShellFoundation from '..';
import {
  ShellAccentControl,
  ShellAside,
  ShellBackToTop,
  ShellContentHost,
  ShellFrame,
  ShellHeader,
  ShellMotionControl,
  ShellRegion,
  ShellResponsiveDrawer,
  ShellResponsivePopover,
  ShellSidebar,
} from '..';

it('publishes the frozen 17-component inventory', () => {
  const names = [
    'ShellFrame', 'ShellRegion', 'ShellHeader', 'ShellSidebar', 'ShellContentHost',
    'ShellAside', 'ShellHero', 'ShellFooter', 'ShellSurface', 'ShellLogoRegion',
    'ShellHeaderContext', 'ShellHeaderActions', 'ShellResponsiveDrawer',
    'ShellResponsivePopover', 'ShellAccentControl', 'ShellMotionControl', 'ShellBackToTop',
  ] as const;
  expect(names.every((name) => typeof ShellFoundation[name] === 'object' || typeof ShellFoundation[name] === 'function')).toBe(true);
});

describe('shell foundation structure', () => {
  afterEach(cleanup);

  it('wraps bounded chrome in a full-bleed frame with an outset edge', () => {
    const { container } = render(
      <ShellFrame layoutWidth="bounded" header={<ShellHeader>Header</ShellHeader>}>
        <ShellContentHost>Content</ShellContentHost>
      </ShellFrame>,
    );
    const frame = container.querySelector('[data-shell-frame]');
    expect(frame).toHaveAttribute('data-shell-layout-width', 'bounded');
    expect(frame?.querySelector('[data-shell-bounded-chrome]')).toBeTruthy();
    expect(frame?.className).not.toContain('bg-background');
    expect(frame?.querySelector('[data-shell-bounded-chrome]')?.className).toContain('max-w-7xl');
  });

  it('renders semantic landmarks and preserves RTL direction', () => {
    render(
      <ShellFrame
        direction="rtl"
        header={<ShellHeader>Header</ShellHeader>}
        sidebar={<ShellSidebar aria-label="Primary">Navigation</ShellSidebar>}
        footer={<footer>Footer</footer>}
      >
        <ShellContentHost>Content</ShellContentHost>
      </ShellFrame>,
    );

    expect(screen.getByText('Content').closest('[data-shell-frame]')?.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('omits hidden regions and marks content-host scroll ownership', () => {
    const { container } = render(
      <>
        <ShellRegion regionId="hero" presence="hidden">Hidden</ShellRegion>
        <ShellContentHost scrollOwner="content-host">Scrollable</ShellContentHost>
      </>,
    );
    expect(screen.queryByText('Hidden')).toBeNull();
    expect(container.querySelector('[data-scroll-owner="content-host"]')?.getAttribute('tabindex')).toBe('0');
  });
});

describe('controlled shell controls', () => {
  it('reports aside, accent, and motion changes without owning state', () => {
    const onCollapsedChange = vi.fn();
    const onAccentChange = vi.fn();
    const onPausedChange = vi.fn();
    render(
      <>
        <ShellAside behavior="collapsible" collapsed={false} onCollapsedChange={onCollapsedChange}>Aside</ShellAside>
        <ShellAccentControl
          value="indigo"
          onValueChange={onAccentChange}
          options={[
            { value: 'indigo', label: 'Indigo', swatchClassName: 'bg-primary' },
            { value: 'green', label: 'Green', swatchClassName: 'bg-success' },
          ]}
        />
        <ShellMotionControl paused={false} onPausedChange={onPausedChange} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Collapse aside' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Green' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause decorative motion' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(onAccentChange).toHaveBeenCalledWith('green');
    expect(onPausedChange).toHaveBeenCalledWith(true);
  });
});

describe('responsive disclosures', () => {
  it('closes a drawer on Escape and returns focus', () => {
    const onOpenChange = vi.fn();
    const opener = document.createElement('button');
    opener.textContent = 'Open';
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <ShellResponsiveDrawer open onOpenChange={onOpenChange} title="Menu">
        <button type="button">First item</button>
      </ShellResponsiveDrawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('uses controlled popover disclosure semantics', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ShellResponsivePopover open={false} onOpenChange={onOpenChange} trigger={<button type="button">Toggle</button>}>
        Options
      </ShellResponsivePopover>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    rerender(
      <ShellResponsivePopover open onOpenChange={onOpenChange} trigger={<button type="button">Toggle</button>}>
        Options
      </ShellResponsivePopover>,
    );
    expect(screen.getByRole('dialog', { name: 'Popover' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe('ShellBackToTop', () => {
  it('scrolls the active owner and honors reduced motion', () => {
    const owner = document.createElement('div');
    Object.defineProperty(owner, 'clientHeight', { value: 100 });
    Object.defineProperty(owner, 'scrollTop', { value: 150, writable: true });
    owner.scrollTo = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    render(<ShellBackToTop scrollOwner={owner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(owner.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
