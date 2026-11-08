// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { HOME_SHELL_KEY, STUDIO_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';

vi.mock('../PlatformConfigProvider', () => ({
  usePlatformConfig: vi.fn(),
  useOptionalPlatformConfig: vi.fn(() => null),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { role: 'ADMIN', roles: ['ADMIN'] },
  }),
}));

vi.mock('../resolvers', () => {
  const React = require('react');
  const { Outlet } = require('react-router-dom');
  return {
    resolveShellComponent: (entry: string) => {
      const trimmed = entry.trim();
      if (trimmed.startsWith('designer:portal-layouts/')) {
        const shellKey = trimmed.slice('designer:portal-layouts/'.length);
        return () => React.createElement(
          'div',
          { 'data-testid': 'designer-published-shell', 'data-shell-key': shellKey },
          React.createElement(Outlet),
        );
      }
      if (entry === 'core:AdminLayout') {
        return () => React.createElement('div', { 'data-testid': 'admin-shell' }, React.createElement(Outlet));
      }
      if (entry === 'core:DesignerShell') {
        return () => React.createElement('div', { 'data-testid': 'designer-shell' }, React.createElement(Outlet));
      }
      return null;
    },
    resolvePageModule: () => null,
  };
});

vi.mock('../DesignerPublishedShell', () => {
  const { Outlet } = require('react-router-dom');
  return {
    createDesignerPublishedShellComponent: (shellKey: string) => {
      const Shell: React.FC = () => (
        <div data-testid="designer-published-shell" data-shell-key={shellKey}>
          <Outlet />
        </div>
      );
      return Shell;
    },
  };
});

import { PortalHost } from '../PortalHost';
import { usePlatformConfig } from '../PlatformConfigProvider';

const mockedUsePlatformConfig = vi.mocked(usePlatformConfig);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const runtimeConfig: PlatformRuntimeConfig = {
  version: 'application-host-v1',
  mounts: [],
  shells: [
    {
      shellKey: HOME_SHELL_KEY,
      name: 'Home',
      entry: 'designer:portal-layouts/site-shell',
      surface: 'home',
      enabled: true,
      entryMode: 'shell',
    },
    {
      shellKey: STUDIO_PORTAL_SEGMENT,
      name: 'Studio',
      entry: 'core:AdminLayout',
      surface: 'studio',
      enabled: true,
    },
    {
      shellKey: 'designer',
      name: 'Designer Shell',
      entry: 'core:DesignerShell',
      surface: 'designer',
      enabled: true,
    },
  ],
  shellRules: [],
  pageModules: [],
  bindings: [
    {
      id: 1,
      mountId: 'studio',
      routePattern: 'users',
      pageKey: 'users',
      enabled: true,
    },
  ],
  navigations: [],
};

const renderPortalHostAt = (initialPath: string) => {
  mockedUsePlatformConfig.mockReturnValue({
    config: runtimeConfig,
    version: runtimeConfig.version,
    refetch: async () => undefined,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<PortalHost />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PortalHost', () => {
  afterEach(() => {
    cleanup();
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('renders AdminLayout for canonical /us/studio/users path', () => {
    bootstrapCultureRegistry(['us', 'ir']);
    renderPortalHostAt('/us/studio/users');
    expect(screen.getByTestId('admin-shell')).toBeInTheDocument();
  });

  it('renders AdminLayout when portal segment is omitted', () => {
    bootstrapCultureRegistry(['us']);
    renderPortalHostAt('/us/users');
    expect(screen.getByTestId('admin-shell')).toBeInTheDocument();
  });

  it('renders the public site shell for CMS page slugs', () => {
    bootstrapCultureRegistry(['us']);
    renderPortalHostAt('/us/about');
    const publishedShell = screen.getByTestId('designer-published-shell');
    expect(publishedShell).toBeInTheDocument();
    expect(publishedShell).toHaveAttribute('data-shell-key', 'site-shell');
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument();
  });

  it('renders designer shell when URL portal segment matches designer shellKey', () => {
    bootstrapCultureRegistry(['us']);
    renderPortalHostAt('/us/designer/client-components');
    expect(screen.getByTestId('designer-shell')).toBeInTheDocument();
  });

  it('renders designer shell when shell rule overrides legacy studio components path', () => {
    bootstrapCultureRegistry(['us']);
    const config: PlatformRuntimeConfig = {
      ...runtimeConfig,
      shellRules: [
        {
          id: 1,
          mountId: 'studio',
          pathPrefix: '/studio',
          shellKey: STUDIO_PORTAL_SEGMENT,
          priority: 0,
          enabled: true,
        },
        {
          id: 2,
          mountId: 'studio',
          pathPrefix: '/studio/client-components',
          shellKey: 'designer',
          priority: 10,
          enabled: true,
        },
      ],
    };

    mockedUsePlatformConfig.mockReturnValue({
      config,
      version: config.version,
      refetch: async () => undefined,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/studio/client-components']}>
          <Routes>
            <Route path="*" element={<PortalHost />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('designer-shell')).toBeInTheDocument();
  });

  it('shows missing-shell state when shellKey is not configured', () => {
    bootstrapCultureRegistry(['us']);
    mockedUsePlatformConfig.mockReturnValue({
      config: { ...runtimeConfig, shells: [] },
      version: runtimeConfig.version,
      refetch: async () => undefined,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/us/studio/users']}>
          <Routes>
            <Route path="*" element={<PortalHost />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/No shell is configured for portal/)).toBeInTheDocument();
    expect(screen.getByText('studio')).toBeInTheDocument();
  });

  it('renders designer-published shell when entry matches designer schema', () => {
    bootstrapCultureRegistry(['us']);
    const config: PlatformRuntimeConfig = {
      ...runtimeConfig,
      shells: [
        ...runtimeConfig.shells,
        {
          shellKey: 'custom-portal',
          name: 'Custom Portal',
          entry: 'designer:portal-layouts/my-custom-shell',
          surface: 'studio',
          enabled: true,
        },
      ],
    };

    mockedUsePlatformConfig.mockReturnValue({
      config,
      version: config.version,
      refetch: async () => undefined,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/us/custom-portal/dashboard']}>
          <Routes>
            <Route path="*" element={<PortalHost />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const publishedShell = screen.getByTestId('designer-published-shell');
    expect(publishedShell).toBeInTheDocument();
    expect(publishedShell).toHaveAttribute('data-shell-key', 'my-custom-shell');
  });
});
