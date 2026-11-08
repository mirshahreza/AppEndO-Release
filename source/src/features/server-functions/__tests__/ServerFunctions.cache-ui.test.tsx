// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const FUNCTION_ID = 'custom.cacheable-list';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      data-testid="mock-monaco"
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('../../../components/ui/HeroFieldControls', () => ({
  UiInput: ({ value, onChange, ariaLabel, type, disabled }: {
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
  UiSelect: ({ value, onChange, ariaLabel, children }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLSelectElement>;
    ariaLabel?: string;
    children?: React.ReactNode;
  }) => (
    <select value={value ?? ''} onChange={onChange} aria-label={ariaLabel}>
      {children}
    </select>
  ),
  UiCheckbox: ({ id, checked, onChange, disabled }: {
    id?: string;
    checked?: boolean;
    onChange?: (event: { target: { checked: boolean } }) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={Boolean(checked)}
      disabled={disabled}
      onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
    />
  ),
}));

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

describe('ServerFunctions cache settings UI payload', () => {
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
              name: 'cacheable-list',
              folder: 'custom',
              method: 'GET',
              path: '/api/custom/cacheable-list',
              code: 'res.json({ ok: true });',
              language: 'ts',
              test_payload: '{}',
              runtime_version: 'v20.x',
              memory_limit: 128,
              timeout_ms: 1500,
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

  it('sends cacheEnabled/cacheTtlMs/cacheByParam/cacheByUser in save payload', async () => {
    renderServerFunctions();

    await screen.findByText('cacheable-list');

    const settingsBtn = await screen.findByLabelText('Settings for cacheable-list');
    fireEvent.click(settingsBtn);

    fireEvent.click(await screen.findByLabelText('Enable Edge Caching for this GET method'));
    fireEvent.click(await screen.findByLabelText('By Param'));
    fireEvent.click(await screen.findByLabelText('By User'));

    const ttlInput = await screen.findByLabelText('TTL');
    fireEvent.change(ttlInput, { target: { value: '240' } });

    fireEvent.click(await screen.findByRole('button', { name: 'Save Settings' }));

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

    expect(body).toEqual(
      expect.objectContaining({
        cacheEnabled: true,
        cacheTtlMs: 240000,
        cacheByParam: true,
        cacheByUser: true,
      }),
    );
  });
});
