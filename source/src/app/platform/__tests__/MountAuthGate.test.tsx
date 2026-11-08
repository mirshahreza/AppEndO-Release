// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MountAuthGate } from '../MountAuthGate';
import type { PlatformMount } from '../../../shared/api/contracts/platform/types';

const studioMount: PlatformMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none',
  authProfile: { requireAuth: true },
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../components/AppRouteLoading', () => ({
  AppRouteLoading: () => <div>Loading…</div>,
}));

vi.mock('../PlatformConfigProvider', () => {
  const value = { config: { shells: [], mounts: [], bindings: [], pageModules: [], shellRules: [] } };
  return {
    usePlatformConfig: () => value,
    useOptionalPlatformConfig: () => value,
  };
});

import { useAuth } from '../../../contexts/AuthContext';

const mockedUseAuth = vi.mocked(useAuth);

const renderGate = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/studio/*"
          element={
            <MountAuthGate mount={studioMount}>
              <div data-testid="protected-content">Protected</div>
            </MountAuthGate>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('MountAuthGate', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders children when the user is authenticated', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
    } as ReturnType<typeof useAuth>);

    renderGate('/studio/users');

    expect(screen.getByTestId('protected-content')).toBeTruthy();
  });

  it('redirects unauthenticated users to login with return URL', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      currentUser: null,
    } as ReturnType<typeof useAuth>);

    renderGate('/studio/users');

    expect(screen.getByTestId('login-page')).toBeTruthy();
  });

  it('shows loading state while auth is resolving', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      currentUser: null,
    } as ReturnType<typeof useAuth>);

    renderGate('/studio/users');

    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('renders children while client context is still loading but session user exists', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
      currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
    } as ReturnType<typeof useAuth>);

    renderGate('/studio/users');

    expect(screen.getByTestId('protected-content')).toBeTruthy();
  });
});
