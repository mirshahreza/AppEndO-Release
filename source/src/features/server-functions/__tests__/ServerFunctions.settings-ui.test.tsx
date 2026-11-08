// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { ShellHeaderOverrideProvider } from '../../../layouts/adminShell/ShellHeaderOverrideContext';
import { resolveRequestUrl } from '../../../shared/api/authSession';

const testMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none' as const,
  authProfile: { requireAuth: true },
};

const FUNCTION_ID = 'custom.settings-probe';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      data-testid="mock-monaco"
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('../../../shared/ui/HeroFieldControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui/HeroFieldControls')>();
  return {
    ...actual,
    UiInputCore: ({ value, onChange, ariaLabel, type, disabled }: {
      value?: string | number;
      onChange?: React.ChangeEventHandler<HTMLInputElement>;
      ariaLabel?: string;
      type?: string;
      disabled?: boolean;
    }) => (
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange}
        aria-label={ariaLabel}
        disabled={disabled}
      />
    ),
    UiSelect: ({ value, onChange, ariaLabel, children, disabled }: {
      value?: string | number;
      onChange?: React.ChangeEventHandler<HTMLSelectElement>;
      ariaLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
    }) => (
      <select
        value={value ?? ''}
        onChange={onChange}
        aria-label={ariaLabel || 'select'}
        disabled={disabled}
      >
        {children}
      </select>
    ),
    UiCheckbox: ({ id, checked, onChange, disabled, children }: {
      id?: string;
      checked?: boolean;
      onChange?: (event: { target: { checked: boolean } }) => void;
      disabled?: boolean;
      children?: React.ReactNode;
    }) => (
      <label>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
        />
        {children}
      </label>
    ),
  };
});

vi.mock('../../../shared/api/authSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/authSession')>();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

import { apiFetch } from '../../../shared/api/authSession';
import { ServerFunctionsWorkspace } from '../components/ServerFunctionsWorkspace';

const apiFetchMock = vi.mocked(apiFetch);

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const renderServerFunctions = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/studio/server-functions']}>
        <CultureProvider cultureId="us">
          <ShellHeaderOverrideProvider>
            <PlatformMountProvider mount={testMount}>
              <ServerFunctionsWorkspace />
            </PlatformMountProvider>
          </ShellHeaderOverrideProvider>
        </CultureProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('ServerFunctions settings dialog — full options payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    apiFetchMock.mockImplementation(async (input, init) => {
      const url = resolveRequestUrl(input);
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

      if (url === '/api/functions/system' && method === 'GET') {
        return jsonResponse({ success: true, items: [] });
      }

      if (url === '/api/functions' && method === 'GET') {
        return jsonResponse({
          success: true,
          items: [
            {
              id: FUNCTION_ID,
              name: 'settings-probe',
              folder: 'custom',
              method: 'GET',
              path: '/api/custom/settings-probe',
              code: 'res.json({ ok: true });',
              language: 'ts',
              test_payload: '{}',
              runtime_version: 'v20.x',
              memory_limit: 128,
              timeout_ms: 1500,
              use_global_config: true,
              enable_logs: true,
              cache_enabled: false,
              cache_ttl_ms: 180000,
              cache_by_param: false,
              cache_by_user: false,
              engine_type: 'SANDBOX_JS',
              metadata_json: null,
            },
          ],
        });
      }

      if (url === '/api/data-sources' && method === 'GET') {
        return jsonResponse({
          success: true,
          items: [
            {
              id: 'ds_default_1',
              name: 'Default SQLite',
              type: 'SQLite',
              isDefault: true,
              database: 'app.db',
              status: 'connected',
            },
          ],
        });
      }

      if (url === '/api/roles' && method === 'GET') {
        return jsonResponse({
          success: true,
          items: [{ id: 1, name: 'ADMIN', description: 'Admin' }],
        });
      }

      if (url === `/api/functions/${encodeURIComponent(FUNCTION_ID)}` && method === 'PUT') {
        return jsonResponse({ success: true });
      }

      return jsonResponse({ success: false, error: `Unhandled ${method} ${url}` }, 404);
    });
  });

  it('saves inherit/VM/RAM/timeout/logs/cache/portal settings in one PUT payload', async () => {
    renderServerFunctions();

    await screen.findByText('settings-probe');
    fireEvent.click(await screen.findByLabelText('Settings for settings-probe'));

    const dialog = await screen.findByRole('dialog');

    const inherit = within(dialog).getByLabelText(/Inherit Global Defaults/i);
    expect(inherit).toBeChecked();
    fireEvent.click(inherit);
    expect(inherit).not.toBeChecked();

    const selects = within(dialog).getAllByRole('combobox');
    // Source, VM Mode, RAM, Timeout (in that order in the settings grid)
    fireEvent.change(selects[0], { target: { value: 'js' } });
    fireEvent.change(selects[1], { target: { value: 'v18.x' } });
    fireEvent.change(selects[2], { target: { value: '256' } });
    fireEvent.change(selects[3], { target: { value: '5000' } });

    fireEvent.click(within(dialog).getByLabelText(/Enable execution logs/i));
    fireEvent.click(within(dialog).getByLabelText(/Enable Edge Caching for this GET method/i));
    fireEvent.click(within(dialog).getByLabelText('By Param'));

    const ttlInput = within(dialog).getByLabelText('TTL');
    fireEvent.change(ttlInput, { target: { value: '180' } });

    const portalInput = within(dialog).getByLabelText(/Portal segment for export tag/i);
    fireEvent.change(portalInput, { target: { value: 'ops' } });

    expect(within(dialog).queryByLabelText('Change reason ask')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Manage reasons' })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        `/api/functions/${encodeURIComponent(FUNCTION_ID)}`,
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    const putCall = apiFetchMock.mock.calls.find(
      ([url, init]) => url === `/api/functions/${encodeURIComponent(FUNCTION_ID)}` && init?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    const body = JSON.parse(String(putCall?.[1]?.body));

    expect(body).toEqual(expect.objectContaining({
      language: 'js',
      runtimeVersion: 'v18.x',
      memoryLimit: 256,
      timeoutMs: 5000,
      useGlobalConfig: false,
      enableLogs: false,
      cacheEnabled: true,
      cacheTtlMs: 180000,
      cacheByParam: true,
      cacheByUser: false,
      metadataJson: expect.objectContaining({
        apiDoc: expect.objectContaining({
          tags: expect.arrayContaining(['portal:ops']),
        }),
      }),
    }));
  });
});
