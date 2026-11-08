// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouteLoading } from '../AppRouteLoading';
import { PORTAL_BRAND_CACHE_KEY } from '../../shared/lib/portalBrandCache';

function renderLoading(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('AppRouteLoading portal brand', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute('data-loading-identity');
  });

  it('renders the portal logo when logoSrc is provided', () => {
    renderLoading(
      <AppRouteLoading
        logoSrc="/assets/workspace/portals/shop/logo.png"
        logoAlt="Harbor"
      />,
    );

    const logo = screen.getByAltText('Harbor');
    expect(logo).toHaveAttribute('src', '/assets/workspace/portals/shop/logo.png');
    expect(document.querySelector('.appendo-logo-themed')).not.toBeInTheDocument();
  });

  it('uses the cached portal logo when props are omitted', () => {
    window.history.replaceState({}, '', '/us/shop/home');
    localStorage.setItem(PORTAL_BRAND_CACHE_KEY, JSON.stringify({
      shop: {
        logoUrl: '/assets/workspace/portals/shop/logo.png',
        title: 'Harbor',
      },
    }));

    renderLoading(<AppRouteLoading />);

    expect(screen.getByAltText('Loading')).toHaveAttribute(
      'src',
      '/assets/workspace/portals/shop/logo.png',
    );
  });

  it('uses the bundled Hawiety mark on first paint when cache is empty', () => {
    window.history.replaceState({}, '', '/iq/hawiety/self-registration-shabab');

    renderLoading(<AppRouteLoading />);

    expect(screen.getByAltText('Loading')).toHaveAttribute(
      'src',
      '/assets/hawiety/mark-blue.png',
    );
    expect(document.documentElement.getAttribute('data-loading-identity')).toBe('hawiety');
  });

  it('shows a custom logo on the embedded variant', () => {
    renderLoading(
      <AppRouteLoading
        variant="embedded"
        logoSrc="/assets/workspace/portals/shop/logo.png"
      />,
    );

    expect(document.querySelector('.app-route-loading__logo')).toHaveAttribute(
      'src',
      '/assets/workspace/portals/shop/logo.png',
    );
  });
});
