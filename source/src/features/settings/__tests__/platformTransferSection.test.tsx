// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Settings } from '../SettingsPage';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import type { PlatformMount } from '../../../shared/api/contracts/platform/types';

vi.mock('../../../core/culture/builtinTranslationLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/culture/builtinTranslationLoader')>();
  const { BUILTIN_TRANSLATION_MASTER_EN } = await import('../../../core/culture/translations/masterEn');
  return {
    ...actual,
    loadBuiltinTranslationBundle: async () => ({ ...BUILTIN_TRANSLATION_MASTER_EN }),
    loadMasterTranslationBundle: async () => ({ ...BUILTIN_TRANSLATION_MASTER_EN }),
  };
});

const studioMount: PlatformMount = {
  id: 'studio',
  name: 'Studio',
  pathPrefix: '/studio',
  enabled: true,
  designerRoutePropagation: 'manual',
};

const { apiGetMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
}));

vi.mock('../../../shared/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/client')>();
  return {
    ...actual,
    apiGet: apiGetMock,
  };
});

vi.mock('../../../app/platform/PortalContext', () => ({
  useOptionalPortal: () => null,
}));

describe('Platform Transfer settings section', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    bootstrapCultureRegistry();
    vi.clearAllMocks();
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/settings/transfer/catalog') {
        return {
          data: {
            success: true,
            catalog: [
              { key: 'ai', group: 'platform-blobs', label: 'AI Models & MCP', description: 'AI', defaultSelected: true },
            ],
          },
        };
      }
      if (url === '/api/settings/node') {
        return {
          data: {
            success: true,
            node: {
              nodeName: 'node-1',
              capabilities: ['service', 'platform', 'worker'],
              nodeEnv: 'development',
              port: 3000,
              logLevel: 'debug',
              disableHmr: false,
              hmrPort: 0,
            },
          },
        };
      }
      return {
        data: {
          serverFunctionVmMode: 'v20.x',
          serverFunctionRamAllocation: 256,
          serverFunctionTimeout: 3000,
          serverFunctionAutoLogging: false,
        },
      };
    });
  });

  const renderSection = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <PlatformMountProvider mount={studioMount}>
          <CultureProvider cultureId="us">
            <MemoryRouter initialEntries={['/studio/settings/platform-transfer']}>
              <Routes>
                <Route path="/studio/settings/*" element={<Settings />} />
              </Routes>
            </MemoryRouter>
          </CultureProvider>
        </PlatformMountProvider>
      </QueryClientProvider>,
    );
  };

  it('opens from the This node sidebar link', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PlatformMountProvider mount={studioMount}>
          <CultureProvider cultureId="us">
            <MemoryRouter initialEntries={['/studio/settings/server-functions']}>
              <Routes>
                <Route path="/studio/settings/*" element={<Settings />} />
              </Routes>
            </MemoryRouter>
          </CultureProvider>
        </PlatformMountProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Platform Transfer/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: /Platform Transfer/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Platform Transfer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export selected/i })).toBeInTheDocument();
    });
  });

  it('renders export/import controls inside Settings', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Platform Transfer/i })).toBeInTheDocument();
      expect(screen.getByText(/manage those through git and your deploy workflow/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export selected/i })).toBeInTheDocument();
    });
  });

  it('shows only choose button in import mode before a bundle is loaded', async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export selected/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Import$/i }));

    expect(screen.getByRole('button', { name: /Choose…/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Select defaults/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm import/i })).not.toBeInTheDocument();
  });
});
