// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../Login';

const mockUseAuthPublicConfig = vi.fn();
const mockLogin = vi.fn();
const mockStoreBrowserLoginCredentials = vi.fn();

vi.mock('../../shared/lib/authPublicConfig', () => ({
  useAuthPublicConfig: () => mockUseAuthPublicConfig(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

vi.mock('../../features/auth/storeBrowserLoginCredentials', () => ({
  storeBrowserLoginCredentials: (...args: unknown[]) => mockStoreBrowserLoginCredentials(...args),
}));

vi.mock('../../components/AboutAppModal', () => ({
  AboutAppModal: () => null,
}));

vi.mock('../../components/AppEndLogo', () => ({
  APPENDO_LOGO_SRC: '/assets/appendo-logo.png',
  APPENDO_LOGO_ONLY_SRC: '/assets/appendo-logo-only.png',
  AppEndLogo: () => <div data-testid="appendo-logo" />,
}));

vi.mock('../../shared/ui/AtmosphereBackdrop', () => ({
  AtmosphereBackdrop: () => null,
}));

vi.mock('../../shared/ui/CircuitTraceField', () => ({
  CircuitTraceField: () => null,
}));

vi.mock('../../shared/ui/TechConstellation', () => ({
  TechConstellation: () => null,
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button type="button" {...props}>{children}</button>
    ),
    p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <p {...props}>{children}</p>
    ),
  },
}));

const renderLogin = (path = '/login') => render(
  <MemoryRouter initialEntries={[path]}>
    <Login />
  </MemoryRouter>,
);

describe('Login oauth surface', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockLogin.mockResolvedValue({ success: false, error: 'Invalid credentials' });
    mockStoreBrowserLoginCredentials.mockResolvedValue(undefined);
    mockUseAuthPublicConfig.mockReturnValue({
      config: { identityProviders: [] },
      isLoading: false,
      registrationEnabled: false,
    });
  });

  it('exposes a POST login form the browser password manager can save', async () => {
    renderLogin();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    });

    const form = document.querySelector('#login-form');
    expect(form).toHaveAttribute('method', 'post');
    expect(form).toHaveAttribute('action', '/login');
    expect(form).toHaveAttribute('autocomplete', 'on');

    const username = document.querySelector('#login-identifier');
    expect(username).toHaveAttribute('name', 'username');
    expect(username).toHaveAttribute('autocomplete', 'username');
    expect(username).toHaveAttribute('type', 'text');

    const password = document.querySelector('#login-password');
    expect(password).toHaveAttribute('name', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('type', 'password');

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows inline errors when username and password are blank', async () => {
    renderLogin();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    });

    fireEvent.submit(document.querySelector('#login-form') as HTMLFormElement);

    expect(await screen.findByText('Username is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('keeps About this system and Forgot? outside the primary submit path', async () => {
    renderLogin();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'About this system' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot?' })).toHaveAttribute('href', '/forgot-password');
  });

  it('asks the browser to store credentials after a successful sign-in', async () => {
    mockLogin.mockResolvedValue({ success: true });
    renderLogin();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    });

    fireEvent.change(document.querySelector('#login-identifier') as HTMLInputElement, {
      target: { value: 'admin' },
    });
    fireEvent.change(document.querySelector('#login-password') as HTMLInputElement, {
      target: { value: 'secret' },
    });
    fireEvent.submit(document.querySelector('#login-form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockStoreBrowserLoginCredentials).toHaveBeenCalledWith('admin', 'secret');
    });
  });

  it('hides oauth buttons when no enabled providers are returned', async () => {
    mockUseAuthPublicConfig.mockReturnValue({
      config: { identityProviders: [] },
      isLoading: false,
      registrationEnabled: false,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
      expect(screen.queryByText('Or continue with')).not.toBeInTheDocument();
    });
  });

  it('shows oauth buttons for enabled providers', async () => {
    mockUseAuthPublicConfig.mockReturnValue({
      config: {
        identityProviders: [
          { id: 'google', kind: 'google-oauth', label: 'Google' },
          { id: 'github', kind: 'github-oauth', label: 'GitHub' },
        ],
      },
      isLoading: false,
      registrationEnabled: false,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Google' })).toHaveAttribute(
        'href',
        '/api/auth/oauth/google/start',
      );
      expect(screen.getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
    });
  });

  it('shows oauth error toast from query string', async () => {
    mockUseAuthPublicConfig.mockReturnValue({
      config: { identityProviders: [] },
      isLoading: false,
      registrationEnabled: false,
    });

    render(
      <MemoryRouter initialEntries={['/login?error=oauth_state']}>
        <Login />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Sign-in session expired. Please try again.')).toBeInTheDocument();
    });
  });
});
