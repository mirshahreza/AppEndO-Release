/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminShellNavGroup } from '../../types';
import { MegaMenu } from '../MegaMenu';
import { TopDrawerNav } from '../TopDrawerNav';

const groups: AdminShellNavGroup[] = [
  {
    heading: 'Workspace',
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Reports', path: '/reports' },
    ],
  },
  {
    heading: 'Manage',
    items: [{ label: 'Users', path: '/users' }],
  },
];

const commonProps = {
  groups,
  pathname: '/dashboard',
  isSidebarCollapsed: false,
  isRtl: false,
  expandedGroups: new Set<string>(),
  onExpandedGroupsChange: vi.fn(),
};

afterEach(cleanup);

describe('admin shell production navigation adapters', () => {
  it('adapts MegaMenu to the shared mega disclosure and routes links', () => {
    const onNavigate = vi.fn();
    const { container } = render(<MegaMenu {...commonProps} onNavigate={onNavigate} />);
    expect(container.querySelector('[data-nav-renderer="mega-menu"]')).toBeTruthy();
    expect(container.querySelector('[data-nav-renderer="mega-menu-stub"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));
    const dashboard = screen.getByRole('link', { name: /Dashboard/ });
    expect(dashboard.getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('link', { name: /Reports/ }));
    expect(onNavigate).toHaveBeenCalledWith('/reports');
  });

  it('adapts TopDrawerNav to the shared inline drawer navigation', () => {
    const onNavigate = vi.fn();
    const { container } = render(<TopDrawerNav {...commonProps} onNavigate={onNavigate} />);
    expect(container.querySelector('[data-nav-renderer="top-drawer"]')).toBeTruthy();
    expect(container.querySelector('[data-nav-renderer="top-drawer-stub"]')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: /Reports/ }));
    expect(onNavigate).toHaveBeenCalledWith('/reports');
  });
});
