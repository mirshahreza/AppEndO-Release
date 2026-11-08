// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
  default: ({ value, onChange }: { value?: string; onChange?: (next?: string) => void }) => (
    <textarea
      data-testid="mock-monaco"
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
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

const renderEditPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/studio/server-functions/edit/custom/settings-probe']}>
        <CultureProvider cultureId="us">
          <ShellHeaderOverrideProvider>
            <PlatformMountProvider mount={testMount}>
              <Routes>
                <Route path="/studio/*" element={<ServerFunctionsWorkspace />} />
              </Routes>
            </PlatformMountProvider>
          </ShellHeaderOverrideProvider>
        </CultureProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Server Functions edit page', () => {
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
        return jsonResponse({ success: true, items: [{ id: 1, name: 'ADMIN', description: 'Admin' }] });
      }

      if (url === '/api/ai/settings' && method === 'GET') {
        return jsonResponse({ success: true, ai: { enabled: true } });
      }

      if (url === '/api/ai/models/available' && method === 'GET') {
        return jsonResponse({
          success: true,
          enabled: true,
          defaultModelId: 'demo',
          models: [{
            id: 'demo',
            name: 'Demo',
            provider: 'openai',
            providerLabel: 'OpenAI',
            modelId: 'gpt-4',
            isDefault: true,
            hasApiKey: true,
            capabilities: {
              chat: true,
              streaming: true,
              vision: false,
              tools: true,
              embeddings: false,
              imageGeneration: false,
              speechToText: false,
              textToSpeech: false,
            },
          }],
        });
      }

      if (url === '/api/ai/mcp-access/me' && method === 'GET') {
        return jsonResponse({
          success: true,
          packs: [],
          mcpServers: [],
          defaultScope: { packIds: [], mcpServerIds: [] },
        });
      }

      return jsonResponse({ success: false, error: `Unhandled ${method} ${url}` }, 404);
    });
  });

  it('renders the editor, Execute console, and AI dock without crashing', async () => {
    renderEditPage();

    expect(await screen.findByText('settings-probe')).toBeInTheDocument();
    expect(screen.getByTestId('server-functions-test-console')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Execute' })).toBeEnabled();

    const aiToggle = await screen.findByRole('button', { name: 'Show AI assistant' });
    fireEvent.click(aiToggle);

    await waitFor(() => {
      expect(screen.getByTestId('server-functions-ai-dock')).not.toHaveClass('hidden');
    });
    expect(screen.getByRole('button', { name: 'Chat mode: Agent' })).toBeInTheDocument();
  });
});
