// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../core/culture/builtinTranslationLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/culture/builtinTranslationLoader')>();
  const { BUILTIN_TRANSLATION_MASTER_EN } = await import('../../../core/culture/translations/masterEn');
  return {
    ...actual,
    loadBuiltinTranslationBundle: async () => ({ ...BUILTIN_TRANSLATION_MASTER_EN }),
    loadMasterTranslationBundle: async () => ({ ...BUILTIN_TRANSLATION_MASTER_EN }),
  };
});

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Settings } from '../SettingsPage';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import type { PlatformMount } from '../../../shared/api/contracts/platform/types';

const studioMount: PlatformMount = {
  id: 'studio',
  name: 'Studio',
  pathPrefix: '/studio',
  enabled: true,
  designerRoutePropagation: 'manual',
};

const defaultSettings = {
  serverFunctionVmMode: 'v20.x',
  serverFunctionRamAllocation: 256,
  serverFunctionTimeout: 3000,
  serverFunctionAutoLogging: false,
};

const defaultNodeSettings = {
  nodeName: 'node-1',
  capabilities: ['service', 'platform', 'worker'],
  nodeEnv: 'development',
  port: 3000,
  logLevel: 'debug',
  disableHmr: false,
  hmrPort: 0,
};

const { apiGetMock, apiPostMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
}));

vi.mock('../../../shared/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/client')>();
  return {
    ...actual,
    apiGet: apiGetMock,
    apiPost: apiPostMock,
  };
});

vi.mock('../../../app/platform/PortalContext', () => ({
  useOptionalPortal: () => null,
}));

const renderSettings = async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <PlatformMountProvider mount={studioMount}>
        <CultureProvider cultureId="us">
          <MemoryRouter initialEntries={['/studio/settings']}>
            <Routes>
              <Route path="/studio/settings/*" element={<Settings />} />
            </Routes>
          </MemoryRouter>
        </CultureProvider>
      </PlatformMountProvider>
    </QueryClientProvider>,
  );

  await waitFor(() => {
    expect(screen.getByRole('link', { name: /Server Functions/i })).toBeInTheDocument();
  });

  return result;
};

describe('Settings Component', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    bootstrapCultureRegistry();
    vi.clearAllMocks();
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/settings/node') {
        return { data: { success: true, node: defaultNodeSettings } };
      }
      if (url === '/api/retention/destinations') {
        return { data: { items: [{ id: 'conn-1', name: 'Archive SQL', type: 'mssql' }] } };
      }
      return { data: defaultSettings };
    });
    apiPostMock.mockResolvedValue({ data: defaultSettings });
  });

  it('renders loading state initially', async () => {
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
            <MemoryRouter initialEntries={['/studio/settings']}>
              <Routes>
                <Route path="/studio/settings/*" element={<Settings />} />
              </Routes>
            </MemoryRouter>
          </CultureProvider>
        </PlatformMountProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Loading settings runtime/i)).toBeInTheDocument();
  });

  it('loads and renders settings', async () => {
    await renderSettings();

    await waitFor(() => {
      expect(screen.queryByText(/Loading settings runtime/i)).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Save Changes/i })[0]).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Server Functions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Platform Transfer/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Platform Transfer/i })).not.toBeInTheDocument();
  });

  it('switches between sidebar sections', async () => {
    await renderSettings();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: /^Logs \/ Record Events$/i }));

    await waitFor(() => {
      expect(screen.getByText(/^Older than$/i)).toBeInTheDocument();
      expect(screen.getByText(/General & persistence/i)).toBeInTheDocument();
    });
  });

  it('merges retention destination into one File-default picker for every family', async () => {
    await renderSettings();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: /^Logs \/ Record Events$/i }));

    await waitFor(() => {
      expect(screen.getByText(/^Older than$/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('columnheader', { name: /^Destination$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Connection$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Action$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Retention \/ older than/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('File').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/^Auth audit$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/App logs \/ Auth audit/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Record events')).not.toBeInTheDocument();
    expect(screen.getByText(/^Older than$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Follow each model/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fixed days/i)).not.toBeInTheDocument();
  });

  it('disables auth hardening controls in development', async () => {
    await renderSettings();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: /Auth & Security/i }));

    await waitFor(() => {
      expect(screen.getByText(/Development mode keeps login on simple username\/password/i)).toBeInTheDocument();
    });

    // Each control now has an adjacent "About <label>" info-tooltip button whose aria-label
    // also contains the field label text — getByLabelText matches both, so scope to the
    // checkbox role specifically (the info button has role=button, not checkbox).
    expect(screen.getByRole('checkbox', { name: /Enable OTP/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Email Verification/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Mobile Verification/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Allow public registration/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Allow login with Username/i })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Account Lockout/i })).not.toBeDisabled();
  });

  it('handles save functionality via API POST', async () => {
    await renderSettings();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: /Auto Logging/i }));

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({ serverFunctionAutoLogging: true }),
      );
    });

    await waitFor(() => {
      expect(saveButton).toHaveTextContent(/Saved!/i);
    });
  });
});
