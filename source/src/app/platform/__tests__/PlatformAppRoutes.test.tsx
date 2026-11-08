// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { installQueryKeys } from '../../../shared/api/queries/install';
import { PlatformAppRoutes } from '../PlatformAppRoutes';

vi.mock('../PlatformConfigProvider', () => ({
  usePlatformConfig: vi.fn(),
  useOptionalPlatformConfig: vi.fn(),
}));

vi.mock('../ExperienceHost', () => ({
  ExperienceHost: ({ mountId }: { mountId: string }) => <div data-testid={`experience-host-${mountId}`} />,
}));

vi.mock('../RootZonePage', () => ({
  RootZonePage: () => <div data-testid="root-zone-page" />,
}));

vi.mock('../../../pages/Login', () => ({ Login: () => <div data-testid="login-page" /> }));
vi.mock('../../../pages/Register', () => ({ Register: () => <div data-testid="register-page" /> }));
vi.mock('../../../pages/ForgotPassword', () => ({
  ForgotPassword: () => <div data-testid="forgot-password-page" />,
}));
vi.mock('../../../pages/ResetPassword', () => ({
  ResetPassword: () => <div data-testid="reset-password-page" />,
}));
vi.mock('../../../pages/VerifyEmail', () => ({
  VerifyEmail: () => <div data-testid="verify-email-page" />,
}));
vi.mock('../../../features/workbooks/SharedWorkbookPage', () => ({
  SharedWorkbookPage: () => <div data-testid="shared-workbook-page" />,
}));

vi.mock('../../../features/dashboard-canvas/DashboardSnapshotPage', () => ({
  DashboardSnapshotPage: () => <div data-testid="dashboard-snapshot-page" />,
}));

import { useOptionalPlatformConfig, usePlatformConfig } from '../PlatformConfigProvider';

const mockedUsePlatformConfig = vi.mocked(usePlatformConfig);
const mockedUseOptionalPlatformConfig = vi.mocked(useOptionalPlatformConfig);

const platformConfig: PlatformRuntimeConfig = {
  version: 'er12-v1',
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
};

const renderAt = (initialPath: string) => {
  const platformConfigValue = {
    config: platformConfig,
    version: platformConfig.version,
    refetch: async () => undefined,
  };
  mockedUsePlatformConfig.mockReturnValue(platformConfigValue);
  mockedUseOptionalPlatformConfig.mockReturnValue(platformConfigValue);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(installQueryKeys.status(), {
    success: true,
    install: { completed: true, pending: false },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <PlatformAppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PlatformAppRoutes culture-aware top router', () => {
  afterEach(() => {
    cleanup();
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('keeps auth routes unchanged', async () => {
    renderAt('/login');
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });

  it('routes legacy designer /studio/client-components through studio ExperienceHost', async () => {
    renderAt('/studio/client-components');
    expect(await screen.findByTestId('experience-host-studio')).toBeInTheDocument();
    expect(screen.queryByTestId('experience-host-us')).not.toBeInTheDocument();
  });

  it('routes enabled culture prefixes through ExperienceHost', async () => {
    renderAt('/ir/studio/users');
    expect(await screen.findByTestId('experience-host-ir')).toBeInTheDocument();
    expect(screen.queryByTestId('experience-host-studio')).not.toBeInTheDocument();
  });

  it('serves shared workbook links outside the studio shell', async () => {
    renderAt('/shared/workbooks/wb-1');
    expect(await screen.findByTestId('shared-workbook-page')).toBeInTheDocument();
    expect(screen.queryByTestId('experience-host-us')).not.toBeInTheDocument();
  });

  it('serves culture-prefixed shared workbook links outside ExperienceHost', async () => {
    renderAt('/us/shared/workbooks/wb-1');
    expect(await screen.findByTestId('shared-workbook-page')).toBeInTheDocument();
    expect(screen.queryByTestId('experience-host-us')).not.toBeInTheDocument();
  });

  it('serves dashboard snapshot links outside the studio shell', async () => {
    renderAt('/shared/dashboard-snapshots/snap-1');
    expect(await screen.findByTestId('dashboard-snapshot-page')).toBeInTheDocument();
    expect(screen.queryByTestId('experience-host-us')).not.toBeInTheDocument();
  });

  it('serves culture-prefixed dashboard snapshot links outside ExperienceHost', async () => {
    renderAt('/us/shared/dashboard-snapshots/snap-1');
    expect(await screen.findByTestId('dashboard-snapshot-page')).toBeInTheDocument();
    expect(screen.queryByTestId('experience-host-us')).not.toBeInTheDocument();
  });

  it('shows not-found for unknown top-level routes instead of redirecting', async () => {
    renderAt('/does-not-exist');
    expect(await screen.findByTestId('route-not-found-page')).toBeInTheDocument();
    expect(screen.getByText('/does-not-exist')).toBeInTheDocument();
    expect(screen.queryByTestId('root-zone-page')).not.toBeInTheDocument();
  });
});
