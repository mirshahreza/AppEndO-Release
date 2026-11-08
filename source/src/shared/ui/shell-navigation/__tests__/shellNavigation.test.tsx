/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ShellNavigation from '..';
import {
  ShellMobileDrawerNavigation,
  ShellMobilePopoverNavigation,
  ShellNavigationSearch,
  ShellNavLink,
  ShellSidebarMegaNavigation,
  ShellSidebarNavigation,
  ShellTopMegaNavigation,
  ShellTopNavigation,
  ShellTopNavigationOverflow,
  filterShellNavigationGroups,
  getShellNavigationItemHref,
  type ShellNavigationGroup,
} from '..';

const groups: ShellNavigationGroup[] = [
  {
    heading: 'Workspace',
    items: [
      { label: 'Dashboard', path: '/dashboard', description: 'Workspace overview' },
      { label: 'Reports', path: '/reports', presentation: { badge: 'New' } },
    ],
  },
  {
    heading: 'Manage',
    items: [
      { label: 'Users', path: '/users', description: 'Manage users' },
      { label: 'Roles', path: '/roles' },
    ],
  },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('uses absolute paths as hrefs and ignores relative route patterns', () => {
  expect(getShellNavigationItemHref({ label: 'Users', path: '/us/studio/users' })).toBe('/us/studio/users');
  expect(getShellNavigationItemHref({ label: 'Users', routePattern: 'users' })).toBeUndefined();
});

it('publishes the frozen navigation inventory', () => {
  const names = [
    'ShellNavRoot', 'ShellNavList', 'ShellNavGroup', 'ShellNavItem', 'ShellNavLink',
    'ShellNavTrigger', 'ShellNavIcon', 'ShellNavBadge', 'ShellNavDescription',
    'ShellNavDivider', 'ShellSidebarNavigation', 'ShellSidebarRailNavigation',
    'ShellSidebarMegaNavigation', 'ShellTopNavigation', 'ShellTopNavigationOverflow',
    'ShellTopMegaNavigation', 'ShellMegaMenuPanel', 'ShellMegaMenuGroup',
    'ShellMegaMenuFeatured', 'ShellMobileDrawerNavigation',
    'ShellMobilePopoverNavigation', 'ShellFooterNavigation', 'ShellContextNavigation',
    'ShellNavigationSearch', 'ShellNavigationUtilities',
  ] as const;
  expect(names.every((name) => typeof ShellNavigation[name] === 'object' || typeof ShellNavigation[name] === 'function')).toBe(true);
});

describe('semantic primitives and disclosure navigation', () => {
  it('marks active links and preserves modified-click browser behavior', () => {
    const onNavigate = vi.fn();
    render(<ShellNavLink href="/dashboard" active onNavigate={onNavigate}>Dashboard</ShellNavLink>);
    const link = screen.getByRole('link', { name: 'Dashboard' });
    expect(link.getAttribute('aria-current')).toBe('page');
    fireEvent.click(link, { ctrlKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('uses a button disclosure with an associated list panel', () => {
    render(<ShellSidebarNavigation groups={groups} defaultExpandedGroups={['Workspace']} />);
    const trigger = screen.getByRole('button', { name: 'Workspace' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(trigger.getAttribute('aria-controls')!)).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: /Dashboard/ })).toBeNull();
  });
});

describe('mega and drawer interaction', () => {
  it('closes a mega panel on Escape and returns focus to its trigger', () => {
    render(<ShellSidebarMegaNavigation groups={groups} />);
    const trigger = screen.getByRole('button', { name: 'Workspace' });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes a mega panel on outside pointer press', () => {
    render(
      <>
        <ShellSidebarMegaNavigation groups={groups} />
        <button type="button">Outside</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Workspace' });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the controlled drawer after route activation and uses logical placement', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ShellMobileDrawerNavigation
        groups={groups}
        open
        onOpenChange={onOpenChange}
        currentPath="/dashboard"
        side="end"
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-side')).toBe('end');
    expect(dialog.className).toContain('end-0');
    rerender(
      <ShellMobileDrawerNavigation
        groups={groups}
        open
        onOpenChange={onOpenChange}
        currentPath="/reports"
        side="end"
      />,
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes a popover on route change', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ShellMobilePopoverNavigation
        groups={groups}
        open
        onOpenChange={onOpenChange}
        currentPath="/dashboard"
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Navigation popover' })).toBeTruthy();
    rerender(
      <ShellMobilePopoverNavigation
        groups={groups}
        open
        onOpenChange={onOpenChange}
        currentPath="/reports"
      />,
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('returns focus when the overflow disclosure closes on Escape', () => {
    const previousResizeObserver = globalThis.ResizeObserver;
    class ResizeObserverMock {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([], this as unknown as ResizeObserver);
      }
      disconnect() {}
      unobserve() {}
    }
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    try {
      render(<ShellTopNavigationOverflow groups={groups} itemEstimatePx={100} />);
      const trigger = screen.getByRole('button', { name: /More/ });
      fireEvent.click(trigger);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    } finally {
      globalThis.ResizeObserver = previousResizeObserver;
    }
  });
});

describe('navigation search', () => {
  it('matches labels and descriptions without changing the source groups', () => {
    const result = filterShellNavigationGroups(groups, 'overview');
    expect(result[0]?.items.map((item) => item.label)).toEqual(['Dashboard']);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('is thresholded and reports debounced authorized results', () => {
    vi.useFakeTimers();
    const onFilteredGroupsChange = vi.fn();
    render(
      <ShellNavigationSearch
        groups={groups}
        minimumItemCount={1}
        onFilteredGroupsChange={onFilteredGroupsChange}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Search navigation' }), {
      target: { value: 'users' },
    });
    act(() => vi.advanceTimersByTime(150));
    expect(onFilteredGroupsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        heading: 'Manage',
        items: [expect.objectContaining({ label: 'Users' })],
      }),
    ]);
  });
});

describe('recipe-backed navigation presentation', () => {
  it('changes density, alignment, labels, indicators, badges, and group styling', () => {
    const { container } = render(
      <>
        <ShellTopNavigation
          groups={groups}
          density="relaxed"
          alignment="end"
          presentation={{
            showIcons: false,
            labelMode: 'label',
            activeIndicator: 'underline',
            showBadges: false,
          }}
          currentPath="/dashboard"
        />
        <ShellSidebarNavigation
          groups={groups}
          presentation={{
            groupDefault: 'expanded-all',
            groupExpansion: 'accordion',
            groupStyle: 'cards',
          }}
        />
      </>,
    );
    const top = screen.getByRole('navigation', { name: 'Top navigation' });
    expect(top.className).toContain('justify-end');
    expect(screen.getAllByRole('link', { name: /Dashboard/ })[0]?.className).toContain('border-b-2');
    expect(screen.getAllByRole('link', { name: /Dashboard/ })[0]?.className).toContain('py-2.5');
    expect(top.textContent).not.toContain('New');
    expect(container.querySelector('[data-shell-nav-group]')?.className).toContain('rounded-lg');
    expect(screen.getByRole('button', { name: 'Workspace' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(screen.getByRole('button', { name: 'Workspace' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('changes mega columns, width, group cards, descriptions, and hover behavior', () => {
    const { container } = render(
      <ShellTopMegaNavigation
        groups={groups}
        featuredArea="none"
        openBehavior="hover-and-click"
        mega={{
          columns: 4,
          panelWidth: 'full',
          groupStyle: 'cards',
          showDescriptions: false,
          showGroupIcons: true,
        }}
      />,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Workspace' }).closest('[data-shell-nav-group]')!);
    const panel = container.querySelector('.grid-cols-4');
    expect(panel).toBeTruthy();
    expect(panel?.className).toContain('w-[calc(100vw-2rem)]');
    expect(panel?.className).toContain('[&_[data-shell-nav-description]]:hidden');
  });
});
