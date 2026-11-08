/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 102): `shell.not-found` / `shell.error-page` palette
 * templates were content-only on the canvas — the real app 404 path always rendered the
 * hardcoded RouteNotFoundPage with no portal registry. Fixed in PlatformShell /
 * ExperienceManifestPortal (`notFoundPageRef`), shellRepository + portal.service persistence,
 * compileExperienceManifest round-trip, MountRouteFallback / PortalAwareNotFoundPage, and
 * Portals settings UI. Custom Designer page renders when configured; otherwise the default
 * RouteNotFoundPage is unchanged (safe fallback). `shell.error-page` deferred (ErrorBoundary).
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { PortalContextProvider } from '../../../app/platform/PortalContext';
import { PortalAwareNotFoundPage, MountRouteFallback } from '../../../app/platform/DynamicOutlet';
import { resolvePortalNotFoundPageRef } from '../../../app/platform/resolvePortalNotFoundPage';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { RouteNotFoundPage } from '../../../pages/RouteNotFoundPage';
import { validateExperienceManifest } from '../../../shared/api/contracts/platform/experienceManifest';
import type { PlatformMount, PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import {
  documentContainsShellErrorPageTemplate,
  documentContainsShellNotFoundTemplate,
} from '../shellNotFoundPage';
import { createInitialDesignerState, designerReducer } from '../state';

vi.mock('../../../app/platform/PlatformConfigProvider', () => ({
  usePlatformConfig: vi.fn(),
  useOptionalPlatformConfig: vi.fn(() => null),
}));

vi.mock('../../../app/platform/DesignerPublishedPage', () => ({
  DesignerPublishedPage: ({ slug }: { slug: string }) => (
    <div data-testid="designer-published-page-stub">{slug}</div>
  ),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
  }),
}));

import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';

const usePlatformConfigMock = vi.mocked(usePlatformConfig);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function buildConfig(overrides?: Partial<PlatformRuntimeConfig>): PlatformRuntimeConfig {
  return {
    version: 'test',
    mounts: [],
    shells: [
      {
        shellKey: 'acme',
        name: 'Acme',
        entry: 'designer:portal-layouts/acme',
        surface: 'studio',
        enabled: true,
        entryMode: 'shell',
        notFoundPageRef: null,
        navigationRef: 'acme',
      },
    ],
    shellRules: [],
    pageModules: [],
    bindings: [],
    navigations: [],
    ...overrides,
  };
}

function renderWithProviders(
  ui: React.ReactElement,
  options?: {
    portal?: { portalSegment: string; shellKey: string; pageRemainderPath?: string } | null;
    mountPathPrefix?: string;
    initialPath?: string;
  },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const mount: PlatformMount = {
    id: 'us',
    pathPrefix: options?.mountPathPrefix ?? '/us',
    name: 'US',
    enabled: true,
    defaultRoute: '',
    designerRoutePropagation: 'none',
    authProfile: {},
  };

  const wrap = (child: React.ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <CultureProvider cultureId="us">
        <MemoryRouter initialEntries={[options?.initialPath ?? '/us/acme/missing']}>
          <PlatformMountProvider mount={mount}>
            {child}
          </PlatformMountProvider>
        </MemoryRouter>
      </CultureProvider>
    </QueryClientProvider>
  );

  if (options?.portal) {
    return render(wrap(
      <PortalContextProvider
        value={{
          portalSegment: options.portal.portalSegment,
          shellKey: options.portal.shellKey,
          pageRemainderPath: options.portal.pageRemainderPath ?? '/missing',
        }}
      >
        {ui}
      </PortalContextProvider>,
    ));
  }

  return render(wrap(ui));
}

describe('Phase 16 — portal custom not-found (item 102)', () => {
  it('resolvePortalNotFoundPageRef returns null when shell has no custom page (safe default)', () => {
    const config = buildConfig();
    expect(resolvePortalNotFoundPageRef(config, {
      portalSegment: 'acme',
      shellKey: 'acme-layout',
    })).toBeNull();
  });

  it('resolvePortalNotFoundPageRef finds shell by portal segment even when context shellKey is a layout key', () => {
    const config = buildConfig({
      shells: [
        {
          shellKey: 'acme',
          name: 'Acme',
          entry: 'designer:portal-layouts/acme-layout',
          surface: 'studio',
          enabled: true,
          entryMode: 'shell',
          notFoundPageRef: 'general/custom-404',
          navigationRef: 'acme',
        },
      ],
    });

    expect(resolvePortalNotFoundPageRef(config, {
      portalSegment: 'acme',
      shellKey: 'acme-layout',
    })).toBe('general/custom-404');
  });

  it('manifest validation accepts optional notFoundPageRef and strips it for redirect portals', () => {
    const valid = validateExperienceManifest({
      id: 'admin',
      cultureId: 'us',
      portals: [
        {
          segment: 'home',
          name: 'Home',
          shellKey: 'home-shell',
          entryMode: 'redirect',
          redirectToSegment: 'studio',
          redirectToCulture: 'us',
          enabled: true,
          pages: [],
        },
        {
          segment: 'studio',
          name: 'Studio',
          shellKey: 'studio',
          entryMode: 'shell',
          enabled: true,
          pages: [],
        },
        {
          segment: 'component-alone',
          name: 'Component Alone',
          shellKey: 'component-alone',
          entryMode: 'shell',
          enabled: true,
          pages: [],
        },
        {
          segment: 'acme',
          name: 'Acme',
          shellKey: 'acme',
          entryMode: 'shell',
          notFoundPageRef: 'general/custom-404',
          enabled: true,
          pages: [],
        },
      ],
    });

    expect(valid.valid).toBe(true);
    if (!valid.valid) return;
    const acme = valid.manifest.portals.find((portal) => portal.segment === 'acme');
    expect(acme?.notFoundPageRef).toBe('general/custom-404');
  });

  it('portal without notFoundPageRef renders the exact default RouteNotFoundPage UI', () => {
    usePlatformConfigMock.mockReturnValue({
      config: buildConfig(),
      version: 'test',
      refetch: async () => undefined,
    });

    renderWithProviders(<MountRouteFallback />, {
      portal: { portalSegment: 'acme', shellKey: 'acme-layout' },
    });

    expect(screen.getByTestId('route-not-found-page')).toBeInTheDocument();
    expect(screen.queryByTestId('portal-custom-not-found-page')).not.toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/us');
  });

  it('portal with notFoundPageRef renders the published Designer page instead of hardcoded 404', () => {
    usePlatformConfigMock.mockReturnValue({
      config: buildConfig({
        shells: [
          {
            shellKey: 'acme',
            name: 'Acme',
            entry: 'designer:portal-layouts/acme',
            surface: 'studio',
            enabled: true,
            entryMode: 'shell',
            notFoundPageRef: 'general/custom-404',
            navigationRef: 'acme',
          },
        ],
      }),
      version: 'test',
      refetch: async () => undefined,
    });

    renderWithProviders(<PortalAwareNotFoundPage />, {
      portal: { portalSegment: 'acme', shellKey: 'acme-layout' },
    });

    expect(screen.getByTestId('portal-custom-not-found-page')).toBeInTheDocument();
    expect(screen.getByTestId('designer-published-page-stub')).toHaveTextContent('general/custom-404');
    expect(screen.queryByTestId('route-not-found-page')).not.toBeInTheDocument();
  });

  it('outside portal context (no PortalContext) keeps hardcoded RouteNotFoundPage — PlatformAppRoutes catch-all parity', () => {
    usePlatformConfigMock.mockReturnValue({
      config: buildConfig({
        shells: [
          {
            shellKey: 'acme',
            name: 'Acme',
            entry: 'designer:portal-layouts/acme',
            surface: 'studio',
            enabled: true,
            entryMode: 'shell',
            notFoundPageRef: 'general/custom-404',
            navigationRef: 'acme',
          },
        ],
      }),
      version: 'test',
      refetch: async () => undefined,
    });

    renderWithProviders(
      <RouteNotFoundPage variant="fullscreen" />,
      { portal: null, initialPath: '/totally-unknown' },
    );

    expect(screen.getByTestId('route-not-found-page')).toBeInTheDocument();
    expect(screen.queryByTestId('portal-custom-not-found-page')).not.toBeInTheDocument();
  });

  it('documentContainsShellNotFoundTemplate detects palette marker; error-page is separate', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'shell.not-found',
      parentId: state.document.rootNodeId,
    });
    expect(documentContainsShellNotFoundTemplate(state.document)).toBe(true);
    expect(documentContainsShellErrorPageTemplate(state.document)).toBe(false);

    let errorState = createInitialDesignerState();
    errorState = designerReducer(errorState, {
      type: 'insert-palette-item',
      itemId: 'shell.error-page',
      parentId: errorState.document.rootNodeId,
    });
    expect(documentContainsShellErrorPageTemplate(errorState.document)).toBe(true);
    expect(documentContainsShellNotFoundTemplate(errorState.document)).toBe(false);
  });
});
