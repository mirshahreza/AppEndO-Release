/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { navigationGuardRegistry } from '../../../lib/navigationGuardRegistry';
import { ShellRouteEnter } from '../ShellRouteEnter';
import { ShellRevealProvider } from '../ShellRevealContext';
import { useShellNavigate } from '../useShellNavigate';
import {
  beginShellNavigationPending,
  clearShellNavigationPending,
  resetShellNavigationPendingForTests,
  useShellNavigationPending,
} from '../shellNavigationPending';

const shellNavigateTestClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const ShellNavigateTestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={shellNavigateTestClient}>
    {children}
  </QueryClientProvider>
);

afterEach(() => {
  resetShellNavigationPendingForTests();
  cleanup();
});

describe('shellNavigationPending', () => {
  it('stores the destination path for a real in-shell jump', () => {
    beginShellNavigationPending('/studio/home', '/studio/users');
    const { getByTestId } = render(<PendingProbe />);
    expect(getByTestId('pending').textContent).toBe('/studio/users');
  });

  it('ignores same-path clicks', () => {
    beginShellNavigationPending('/studio/users', '/studio/users/');
    render(<PendingProbe />);
    expect(screen.getByTestId('pending').textContent).toBe('');
  });

  it('ignores CMS Settings soft-nav', () => {
    beginShellNavigationPending('/studio/cms/settings', '/studio/cms/settings/tags');
    render(<PendingProbe />);
    expect(screen.getByTestId('pending').textContent).toBe('');
  });

  it('ignores member dossier section soft-nav', () => {
    beginShellNavigationPending(
      '/iq/vertical/members-all/view/42/files',
      '/iq/vertical/members-all/view/42/kasb',
    );
    render(<PendingProbe />);
    expect(screen.getByTestId('pending').textContent).toBe('');
  });
});

describe('ShellRouteEnter click-pending cover', () => {
  it('shows the embedded loading cover from the click, before the URL changes', () => {
    beginShellNavigationPending('/studio/home', '/studio/users');

    render(
      <ShellNavigateTestProviders>
        <MemoryRouter initialEntries={['/studio/home']}>
          <ShellRevealProvider surfaceReady>
            <PendingProbe />
            <ShellRouteEnter>
              <div>Home page</div>
            </ShellRouteEnter>
          </ShellRevealProvider>
        </MemoryRouter>
      </ShellNavigateTestProviders>,
    );

    expect(screen.getByTestId('pending').textContent).toBe('/studio/users');
    expect(screen.getByTestId('shell-formatted-reveal-cover')).toBeTruthy();
    expect(screen.getByTestId('shell-formatted-reveal').getAttribute('data-nav-pending')).toBe('true');
    expect(screen.getByTestId('app-route-loading').getAttribute('data-variant')).toBe('embedded');
    expect(screen.getByText('Home page')).toBeTruthy();
  });
});

describe('useShellNavigate', () => {
  it('marks pending then navigates', () => {
    render(
      <ShellNavigateTestProviders>
        <MemoryRouter initialEntries={['/studio/home']}>
          <NavigateProbe />
          <Routes>
            <Route path="/studio/home" element={<div>Home</div>} />
            <Route path="/studio/users" element={<div>Users</div>} />
          </Routes>
        </MemoryRouter>
      </ShellNavigateTestProviders>,
    );

    act(() => {
      screen.getByRole('button', { name: 'go' }).click();
    });

    expect(screen.getByTestId('pending').textContent).toBe('/studio/users');
    expect(screen.getByTestId('path').textContent).toBe('/studio/users');
  });

  it('does not mark pending when a guard blocks', () => {
    const unregister = navigationGuardRegistry.register({
      id: 'shell-nav-pending-test',
      shouldBlock: () => true,
      onBlock: () => undefined,
    });

    try {
      render(
        <ShellNavigateTestProviders>
          <MemoryRouter initialEntries={['/studio/home']}>
            <NavigateProbe />
          </MemoryRouter>
        </ShellNavigateTestProviders>,
      );

      act(() => {
        screen.getByRole('button', { name: 'go' }).click();
      });

      expect(screen.getByTestId('pending').textContent).toBe('');
      expect(screen.getByTestId('path').textContent).toBe('/studio/home');
    } finally {
      unregister();
      clearShellNavigationPending();
    }
  });
});

function PendingProbe() {
  const pending = useShellNavigationPending();
  return <span data-testid="pending">{pending ?? ''}</span>;
}

function NavigateProbe() {
  const navigateShell = useShellNavigate();
  const pending = useShellNavigationPending();
  const { pathname } = useLocation();
  return (
    <div>
      <button type="button" onClick={() => navigateShell('/studio/users')}>go</button>
      <span data-testid="pending">{pending ?? ''}</span>
      <span data-testid="path">{pathname}</span>
    </div>
  );
}
