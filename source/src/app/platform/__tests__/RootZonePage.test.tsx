// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  resolveDefaultMountRoute,
  resolveRootZoneRedirect,
  RootZonePage,
} from '../RootZonePage';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { HOME_SHELL_KEY } from '../../../shared/api/contracts/platform/mountConstants';

const sampleConfig: PlatformRuntimeConfig = {
  version: 'v1',
  mounts: [
    {
      id: 'studio',
      pathPrefix: '/studio',
      name: 'Studio',
      enabled: true,
      defaultRoute: '/studio',
      designerRoutePropagation: 'none',
      authProfile: { requireAuth: true },
    },
  ],
  shells: [
    {
      shellKey: HOME_SHELL_KEY,
      name: 'Home Redirect',
      entry: '',
      surface: 'home',
      enabled: true,
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
    },
  ],
  shellRules: [],
  pageModules: [],
  bindings: [],
  navigations: [],
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../PlatformConfigProvider', () => ({
  usePlatformConfig: vi.fn(),
  useOptionalPlatformConfig: vi.fn(() => null),
}));

import { useAuth } from '../../../contexts/AuthContext';
import { usePlatformConfig } from '../PlatformConfigProvider';

const mockedUseAuth = vi.mocked(useAuth);
const mockedUsePlatformConfig = vi.mocked(usePlatformConfig);

describe('RootZonePage helpers', () => {
  it('redirects unauthenticated users to login', () => {
    expect(resolveRootZoneRedirect(false, '/studio')).toBe('/login');
  });

  it('redirects authenticated users to the default mount route', () => {
    expect(resolveRootZoneRedirect(true, '/us/studio')).toBe('/us/studio');
  });

  it('resolves home redirect route from runtime config', () => {
    expect(resolveDefaultMountRoute(sampleConfig)).toBe('/us/studio');
  });

  it('resolves culture home when the root portal uses a layout', () => {
    expect(resolveDefaultMountRoute({
      ...sampleConfig,
      shells: [{
        ...sampleConfig.shells[0]!,
        entry: 'core:SiteLayout',
        entryMode: 'shell',
        redirectToSegment: null,
        redirectToCulture: null,
      }],
    })).toBe('/us');
  });

  it('lets anonymous visitors open a public home culture root', () => {
    expect(resolveRootZoneRedirect(false, '/us')).toBe('/us');
  });
});

describe('RootZonePage', () => {
  it('shows loading while auth is resolving', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      currentUser: null,
    } as ReturnType<typeof useAuth>);
    mockedUsePlatformConfig.mockReturnValue({
      config: sampleConfig,
      version: 'v1',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RootZonePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('redirects authenticated users to /us/studio', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
    } as ReturnType<typeof useAuth>);
    mockedUsePlatformConfig.mockReturnValue({
      config: sampleConfig,
      version: 'v1',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootZonePage />} />
          <Route path="/us/studio" element={<div data-testid="studio-page">Studio</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('studio-page')).toBeTruthy();
  });

  it('redirects unauthenticated users to /login', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      currentUser: null,
    } as ReturnType<typeof useAuth>);
    mockedUsePlatformConfig.mockReturnValue({
      config: sampleConfig,
      version: 'v1',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootZonePage />} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('login-page')).toBeTruthy();
  });
});
