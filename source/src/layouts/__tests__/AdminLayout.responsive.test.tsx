// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DesktopOnlyGate } from '../adminShell/DesktopOnlyGate';
import { filterAdminShellNavByViewport } from '../../shared/lib/filterAdminShellNavByViewport';
import { isBindingAllowedForViewport } from '../../shared/lib/resolveBindingMinViewport';
import {
  ADMIN_SHELL_CONTENT_HOST_CLASS,
  ADMIN_SHELL_HAMBURGER_BUTTON_CLASS,
  ADMIN_SHELL_HEADER_ACTION_SLOT_CLASS,
  ADMIN_SHELL_HEADER_ACTIONS_CLUSTER_CLASS,
  ADMIN_SHELL_HEADER_UTILITY_CLUSTER_CLASS,
  ADMIN_SHELL_HEADER_CLASS,
  ADMIN_SHELL_HEADER_INNER_CLASS,
  ADMIN_SHELL_HEADER_SUBTITLE_CLASS,
  ADMIN_SHELL_HEADER_TITLE_CLASS,
  ADMIN_SHELL_HEADER_TITLE_ROW_CLASS,
  ADMIN_SHELL_MOBILE_BACKDROP_CLASS,
  ADMIN_SHELL_SIDEBAR_CLASS,
  ADMIN_SHELL_SIDEBAR_OVERLAY_CLASS,
} from '../../shared/ui/surfaceClasses';
import type { PlatformRouteBinding } from '../../shared/api/contracts/platform/types';

describe('AdminLayout responsive contracts', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps studio workspaces in phone navigation', () => {
    const groups = filterAdminShellNavByViewport([
      {
        heading: 'Development',
        items: [
          { label: 'Users', path: '/studio/users', pageKey: 'users' },
          { label: 'Server Functions', path: '/studio/server-functions', pageKey: 'server-functions' },
          { label: 'Git', path: '/studio/git', pageKey: 'git' },
          { label: 'File Manager', path: '/studio/file-manager', pageKey: 'file-manager' },
          { label: 'Data Studio', path: '/studio/data-studio', pageKey: 'data-studio' },
          { label: 'SSH', path: '/studio/ssh', pageKey: 'ssh-hub' },
          { label: 'RDP', path: '/studio/rdp', pageKey: 'rdp-hub' },
          { label: 'Sftp', path: '/studio/sftp', pageKey: 'file-hub' },
          { label: 'Client Components', path: '/studio/client-components', pageKey: 'client-components' },
        ],
      },
    ], 'phone');

    expect(groups.flatMap((group) => group.items.map((item) => item.label))).toEqual([
      'Users',
      'Server Functions',
      'Git',
      'File Manager',
      'Data Studio',
      'SSH',
      'RDP',
      'Sftp',
      'Client Components',
    ]);
  });

  it('hides nav items that opt into minViewport desktop on phone', () => {
    const groups = filterAdminShellNavByViewport([
      {
        heading: 'Development',
        items: [
          { label: 'Users', path: '/studio/users', pageKey: 'users' },
          { label: 'Custom Desktop Page', path: '/studio/custom', pageKey: 'custom', minViewport: 'desktop' },
        ],
      },
    ], 'phone');

    expect(groups.flatMap((group) => group.items.map((item) => item.label))).toEqual(['Users']);
  });

  it('allows studio bindings on phone and tablet', () => {
    const gitBinding: PlatformRouteBinding = {
      id: 1,
      mountId: 'studio',
      routePattern: 'git',
      pageKey: 'git',
      enabled: true,
      nav: { label: 'Git', icon: 'GitBranch' },
    };

    expect(isBindingAllowedForViewport(gitBinding, 'phone')).toBe(true);
    expect(isBindingAllowedForViewport(gitBinding, 'tablet')).toBe(true);
    expect(isBindingAllowedForViewport(gitBinding, 'desktop')).toBe(true);

    const serverFunctionsBinding: PlatformRouteBinding = {
      id: 2,
      mountId: 'studio',
      routePattern: 'server-functions',
      pageKey: 'server-functions',
      enabled: true,
      nav: { label: 'Server Functions' },
    };
    expect(isBindingAllowedForViewport(serverFunctionsBinding, 'phone')).toBe(true);
    expect(isBindingAllowedForViewport(serverFunctionsBinding, 'tablet')).toBe(true);

    const optedInBinding: PlatformRouteBinding = {
      id: 9,
      mountId: 'studio',
      routePattern: 'custom',
      pageKey: 'custom',
      enabled: true,
      nav: { label: 'Custom Desktop Page', minViewport: 'desktop' },
    };
    expect(isBindingAllowedForViewport(optedInBinding, 'phone')).toBe(false);
    expect(isBindingAllowedForViewport(optedInBinding, 'tablet')).toBe(false);
    expect(isBindingAllowedForViewport(optedInBinding, 'desktop')).toBe(true);
  });

  it('renders DesktopOnlyGate with recovery action', () => {
    render(
      <MemoryRouter>
        <DesktopOnlyGate homeTo="/studio/users" homeLabel="Back to Users" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Desktop only' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Users' })).toBeInTheDocument();
  });

  it('keeps overlay hamburger below lg and docks the rail from desktop', () => {
    expect(ADMIN_SHELL_SIDEBAR_CLASS).toContain('lg:translate-x-0');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).toContain('lg:relative');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).not.toMatch(/(?:^|\s)relative(?:\s|$)/);
    expect(ADMIN_SHELL_SIDEBAR_CLASS).not.toContain('md:translate-x-0');
    expect(ADMIN_SHELL_SIDEBAR_CLASS).not.toContain('min-[400px]:translate-x-0');
    expect(ADMIN_SHELL_SIDEBAR_OVERLAY_CLASS).toContain('admin-shell-sidebar-overlay');
    expect(ADMIN_SHELL_SIDEBAR_OVERLAY_CLASS).toContain('fixed');
    expect(ADMIN_SHELL_SIDEBAR_OVERLAY_CLASS).toContain('z-[60]');
    expect(ADMIN_SHELL_HAMBURGER_BUTTON_CLASS).toContain('lg:hidden');
    expect(ADMIN_SHELL_HAMBURGER_BUTTON_CLASS).not.toContain('min-[400px]:hidden');
    expect(ADMIN_SHELL_MOBILE_BACKDROP_CLASS).toContain('z-[55]');
    expect(ADMIN_SHELL_HEADER_CLASS).toContain('lg:h-[59px]');
    expect(ADMIN_SHELL_HEADER_CLASS).not.toContain('md:h-[59px]');
    expect(ADMIN_SHELL_HEADER_CLASS).toContain('h-[calc(52px+env(safe-area-inset-top))]');
    expect(ADMIN_SHELL_HEADER_CLASS).toContain('items-center');
    expect(ADMIN_SHELL_HEADER_CLASS).toContain('max-lg:pt-[env(safe-area-inset-top)]');
    expect(ADMIN_SHELL_HEADER_CLASS).toContain('max-sm:h-auto');
    expect(ADMIN_SHELL_HEADER_CLASS).not.toContain('py-1.5');
    expect(ADMIN_SHELL_HEADER_CLASS).not.toContain('min-h-[52px]');
    expect(ADMIN_SHELL_HEADER_INNER_CLASS).toContain('h-full');
    expect(ADMIN_SHELL_HEADER_INNER_CLASS).toContain('items-center');
    expect(ADMIN_SHELL_HEADER_INNER_CLASS).toContain('max-sm:flex-wrap');
    expect(ADMIN_SHELL_HEADER_TITLE_ROW_CLASS).toContain('max-sm:flex');
    expect(ADMIN_SHELL_HEADER_TITLE_ROW_CLASS).toContain('justify-center');
    expect(ADMIN_SHELL_HEADER_TITLE_ROW_CLASS).toContain('hidden');
    expect(ADMIN_SHELL_HEADER_TITLE_CLASS).toContain('text-sm');
    expect(ADMIN_SHELL_HEADER_TITLE_CLASS).toContain('font-bold');
    expect(ADMIN_SHELL_HEADER_TITLE_CLASS).not.toContain('lg:text-lg');
    expect(ADMIN_SHELL_HEADER_SUBTITLE_CLASS).toContain('text-slate-500');
    expect(ADMIN_SHELL_HEADER_ACTION_SLOT_CLASS).toContain('ms-5');
    expect(ADMIN_SHELL_HEADER_ACTION_SLOT_CLASS).toContain('ps-5');
    expect(ADMIN_SHELL_HEADER_ACTIONS_CLUSTER_CLASS).toContain('gap-2');
    expect(ADMIN_SHELL_HEADER_UTILITY_CLUSTER_CLASS).toContain('gap-1');
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).toContain('lg:border-s');
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).not.toMatch(/(?:^|\s)border-s(?:\s|$)/);
    expect(ADMIN_SHELL_CONTENT_HOST_CLASS).not.toContain('min-[400px]:border-s');
  });
});
