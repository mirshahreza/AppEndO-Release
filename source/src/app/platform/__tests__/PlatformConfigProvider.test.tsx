// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PlatformConfigProvider, usePlatformConfig } from '../PlatformConfigProvider';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';

const sampleConfig: PlatformRuntimeConfig = {
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
  shells: [],
  shellRules: [],
  pageModules: [],
  bindings: [],
  navigations: [],
  version: 'boot-version',
};

vi.mock('../../../shared/api/queries/boot', () => ({
  useAppBootQuery: vi.fn(),
  seedAppBootQueryCaches: vi.fn(),
}));

import { useAppBootQuery } from '../../../shared/api/queries/boot';

const mockedUseAppBootQuery = vi.mocked(useAppBootQuery);

const sampleBootPayload = {
  success: true as const,
  runtimeConfig: sampleConfig,
  cultures: {
    success: true as const,
    packs: [],
    enabledCulturePackIds: ['us', 'ir', 'iq'],
    defaultCultureId: 'us',
    availablePacks: [],
  },
  install: {
    success: true as const,
    apiVersion: 2,
    install: { pending: false, completed: true },
  },
  pwa: {
    enabled: false,
    name: 'AppEndO',
    shortName: 'AppEndO',
    description: '',
    startUrl: '/',
    scope: '/',
    display: 'standalone' as const,
    orientation: 'any' as const,
    themeColor: '#ffffff',
    backgroundColor: '#ffffff',
  },
  webFonts: [],
  cultureTranslations: {
    revision: 0,
    cultureOverrides: {},
  },
  feedbackPolicy: {
    enabled: false,
    allowAuthenticated: true,
    allowAnonymous: false,
    showContactFieldsForAnonymous: true,
    requireSubject: true,
    allowAttachments: true,
    widgetPlacement: 'fab' as const,
    showOnDashboard: true,
    pageKeyDenylist: ['auth', 'install'],
    subjects: [],
  },
};

const Consumer = () => {
  const { version } = usePlatformConfig();
  return <div data-testid="platform-version">{version}</div>;
};

const renderProvider = (initialPath = '/studio') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <PlatformConfigProvider>
          <Consumer />
        </PlatformConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PlatformConfigProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows loading state while boot payload is fetching', () => {
    mockedUseAppBootQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAppBootQuery>);

    renderProvider('/studio');

    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('waits for boot on component preview route', () => {
    mockedUseAppBootQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAppBootQuery>);

    renderProvider('/studio/component-preview?component=general%2Ftest');

    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('renders public routes while boot payload is still fetching', () => {
    mockedUseAppBootQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAppBootQuery>);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <PlatformConfigProvider>
            <div data-testid="public-child">Login route</div>
          </PlatformConfigProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('public-child')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('renders children with runtime config after boot fetch', async () => {
    mockedUseAppBootQuery.mockReturnValue({
      data: sampleBootPayload,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAppBootQuery>);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('platform-version').textContent).toBe('boot-version');
    });
  });

  it('shows retry UI when boot fetch fails', () => {
    mockedUseAppBootQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Boot failed'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAppBootQuery>);

    renderProvider();

    expect(screen.getByText('Platform configuration unavailable')).toBeTruthy();
    expect(screen.getByText('Boot failed')).toBeTruthy();
  });
});
