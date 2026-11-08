/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminShellNavGroup } from '../../types';
import { ShellChromeUtilityNav } from '../ShellChromeUtilityNav';
import { setDashboardDesignMode } from '../../../../shared/lib/dashboardHomeShortcuts';

vi.mock('../../../../shared/ui/UiTooltip', () => ({
  UiTooltip: ({
    children,
    content,
    placement,
  }: {
    children: React.ReactNode;
    content?: React.ReactNode;
    placement?: string;
  }) => (
    <div data-testid="utility-hint" data-placement={placement}>
      <div data-testid="utility-hint-content">{content}</div>
      {children}
    </div>
  ),
}));

vi.mock('../../../../shared/lib/navigationIcons/NavigationIcon', () => ({
  NavigationIcon: ({ className }: { className?: string }) => (
    <span data-testid="nav-icon" className={className} />
  ),
}));

const navGroups: AdminShellNavGroup[] = [
  {
    heading: 'Ops',
    items: [{ label: 'Help', path: '/us/studio/help', icon: 'tabler:IconHelp' }],
  },
];

afterEach(() => {
  setDashboardDesignMode(false);
  cleanup();
});

describe('ShellChromeUtilityNav', () => {
  it('renders nothing when there are no items', () => {
    const { container } = render(
      <ShellChromeUtilityNav
        items={[]}
        navGroups={navGroups}
        pathname="/us/studio/help"
        onNavigate={vi.fn()}
        placement="header"
      />,
    );
    expect(container.querySelector('[data-shell-nav]')).toBeNull();
  });

  it('renders header utility links and navigates on click', () => {
    const onNavigate = vi.fn();
    render(
      <ShellChromeUtilityNav
        items={[
          {
            label: 'Help',
            description: 'Open studio help and guides.',
            path: '/us/studio/help',
            icon: 'tabler:IconHelp',
            iconColor: 'text-cyan-500',
          },
        ]}
        navGroups={navGroups}
        pathname="/us/studio/help"
        onNavigate={onNavigate}
        placement="header"
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Header utilities' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Help' }).getAttribute('draggable')).toBe('false');
    fireEvent.click(screen.getByRole('link', { name: 'Help' }));
    expect(onNavigate).toHaveBeenCalledWith('/us/studio/help');
    expect(screen.getByTestId('utility-hint').getAttribute('data-placement')).toBe('bottom');
    const hint = screen.getByTestId('utility-hint-content');
    expect(hint.textContent).toContain('Help');
    expect(hint.textContent).toContain('Open studio help and guides.');
    const title = hint.querySelector('span');
    expect(title?.className).toContain('font-bold');
    expect(title?.className).toContain('text-cyan-300');
  });

  it('renders the sidebar footer strip', () => {
    render(
      <ShellChromeUtilityNav
        items={navGroups[0]!.items}
        navGroups={navGroups}
        pathname="/us/studio/other"
        onNavigate={vi.fn()}
        placement="sidebar-footer"
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Sidebar footer' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Sidebar footer' }).className).toContain('pb-6');
    expect(screen.getByTestId('nav-icon').className).toContain('h-4 w-4');
    expect(screen.queryByTestId('page-guide-trigger')).toBeNull();
    expect(screen.getAllByTestId('utility-hint').every((node) => node.getAttribute('data-placement') === 'right')).toBe(true);
  });

  it('renders nothing when the footer has no nav items', () => {
    const { container } = render(
      <ShellChromeUtilityNav
        items={[]}
        navGroups={navGroups}
        pathname="/us/studio/other"
        onNavigate={vi.fn()}
        placement="sidebar-footer"
      />,
    );
    expect(container.querySelector('[data-shell-nav]')).toBeNull();
  });

  it('renders a centered top strip without wrapping labeled Home rows', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <ShellChromeUtilityNav
        items={[
          { label: 'Home', path: '/us/studio', icon: 'Home' },
          { label: 'Theme Designer', path: '/us/studio/appearance', icon: 'Palette' },
          { label: 'Settings', path: '/us/studio/settings', icon: 'Settings' },
        ]}
        navGroups={navGroups}
        pathname="/us/studio/other"
        onNavigate={onNavigate}
        placement="sidebar-top"
      />,
    );

    const strip = container.querySelector('[data-shell-nav="sidebar-top"] > div');
    expect(screen.getByRole('navigation', { name: 'Sidebar shortcuts' })).toBeTruthy();
    expect(strip?.className).toContain('justify-center');
    expect(strip?.className).toContain('flex-nowrap');
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Theme Designer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByTestId('page-guide-trigger')).toBeNull();
    expect(screen.getByRole('link', { name: 'Home' }).className).toContain('h-8');
    expect(screen.getAllByTestId('nav-icon')[0]?.className).toContain('h-5 w-5');
    expect(screen.getAllByTestId('utility-hint').every((node) => node.getAttribute('data-placement') === 'top')).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(onNavigate).toHaveBeenCalledWith('/us/studio');
  });

  it('stacks footer items vertically with larger icons when the sidebar is collapsed', () => {
    const { container } = render(
      <ShellChromeUtilityNav
        items={[
          { label: 'Help', path: '/us/studio/help', icon: 'tabler:IconHelp' },
          { label: 'About', path: '/us/studio/about', icon: 'tabler:IconInfoCircle' },
        ]}
        navGroups={navGroups}
        pathname="/us/studio/other"
        onNavigate={vi.fn()}
        placement="sidebar-footer"
        isSidebarCollapsed
      />,
    );
    const strip = container.querySelector('[data-shell-nav="sidebar-footer"] > div');
    expect(strip?.className).toContain('flex-col');
    expect(screen.getAllByTestId('nav-icon')[0]?.className).toContain('h-5 w-5');
  });
});
