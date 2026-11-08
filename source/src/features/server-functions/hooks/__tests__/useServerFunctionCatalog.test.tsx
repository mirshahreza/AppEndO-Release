// @vitest-environment jsdom

import React from 'react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient as appQueryClient } from '../../../../shared/api/queryClient';
import { PlatformMountProvider } from '../../../../app/platform/PlatformMountContext';
import { APP_LIST_PREFERENCE_KEYS } from '../../../../shared/lib/listPreferenceKeys';
import { LIST_PREFERENCES_STORAGE_PREFIX } from '../../../../shared/lib/listPreferencesStorage';
import { useServerFunctionCatalog } from '../useServerFunctionCatalog';

const testMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none' as const,
  authProfile: { requireAuth: true },
};

function CatalogProbe() {
  const catalog = useServerFunctionCatalog({ addLog: vi.fn() });

  return (
    <div>
      <div data-testid="function-count">{catalog.functions.length}</div>
      <div data-testid="filtered-count">{catalog.filteredFunctions.length}</div>
      <div data-testid="group-count">{Object.keys(catalog.groups).length}</div>
      <button type="button" onClick={() => catalog.setBuiltInFilter('')}>
        Show built-in
      </button>
      <button type="button" onClick={() => catalog.setBuiltInFilter('not-builtin')}>
        Hide built-in
      </button>
    </div>
  );
}

const renderCatalog = (strict = false) => {
  appQueryClient.clear();

  const tree = (
    <QueryClientProvider client={appQueryClient}>
      <MemoryRouter initialEntries={['/studio/server-functions']}>
        <PlatformMountProvider mount={testMount}>
          <CatalogProbe />
        </PlatformMountProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

describe('useServerFunctionCatalog initial load', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.removeItem(
      `${LIST_PREFERENCES_STORAGE_PREFIX}${APP_LIST_PREFERENCE_KEYS.serverFunctions}`,
    );

    const jsonResponse = (body: unknown, status = 200) => {
      const payload = JSON.stringify(body);
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => payload,
        json: async () => body,
      } as Response;
    };

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/functions/system') {
        return jsonResponse({ success: true, items: [] });
      }

      if (url === '/api/functions') {
        return jsonResponse({
          success: true,
          items: [
            {
              id: 'fn_custom_1',
              name: 'cacheable-list',
              folder: 'custom',
              method: 'GET',
              path: '/api/custom/cacheable-list',
              code: 'res.json({ ok: true });',
            },
          ],
        });
      }

      if (url === '/api/data-sources') {
        return jsonResponse({ success: true, items: [] });
      }

      return jsonResponse({});
    }));
  });

  it('loads catalog functions on first fetch without manual refresh', async () => {
    renderCatalog(false);

    await waitFor(() => {
      expect(Number(screen.getByTestId('function-count').textContent)).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('loads catalog functions under StrictMode without manual refresh', async () => {
    renderCatalog(true);

    await waitFor(() => {
      const counts = screen.getAllByTestId('function-count');
      expect(counts.length).toBeGreaterThan(0);
      expect(Number(counts[0]?.textContent)).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('shows package APIs when Not BuiltIn hides platform built-in routes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const jsonResponse = (body: unknown, status = 200) => {
        const payload = JSON.stringify(body);
        return {
          ok: status >= 200 && status < 300,
          status,
          text: async () => payload,
          json: async () => body,
        } as Response;
      };

      if (url === '/api/functions/system') {
        return jsonResponse({
          success: true,
          items: [
            {
              id: 'pkg-api-pkg-test-get-test',
              name: 'test',
              folder: 'test',
              method: 'GET',
              path: '/api/test/test',
              code: 'res.json({ ok: true });',
              isBuiltIn: true,
            },
            {
              id: 'sys-get-api-users',
              name: 'users',
              folder: 'users',
              method: 'GET',
              path: '/api/users',
              code: 'res.json({ ok: true });',
              isBuiltIn: true,
            },
          ],
        });
      }

      if (url === '/api/functions') {
        return jsonResponse({ success: true, items: [] });
      }

      if (url === '/api/data-sources') {
        return jsonResponse({ success: true, items: [] });
      }

      return jsonResponse({});
    }));

    renderCatalog(false);

    fireEvent.click(screen.getByRole('button', { name: 'Hide built-in' }));

    await waitFor(() => {
      expect(screen.getByTestId('group-count').textContent).toBe('1');
    }, { timeout: 5000 });
  });

  it('hides then shows platform built-in functions after StrictMode load', async () => {
    renderCatalog(true);

    await waitFor(() => {
      expect(Number(screen.getAllByTestId('filtered-count')[0]?.textContent)).toBeGreaterThan(1);
    }, { timeout: 5000 });

    const allCount = Number(screen.getAllByTestId('filtered-count')[0]?.textContent);

    screen.getAllByRole('button', { name: 'Hide built-in' }).forEach((button) => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(Number(screen.getAllByTestId('filtered-count')[0]?.textContent)).toBeLessThan(allCount);
    });

    screen.getAllByRole('button', { name: 'Show built-in' }).forEach((button) => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(Number(screen.getAllByTestId('filtered-count')[0]?.textContent)).toBe(allCount);
    });
  });
});

function EditToListNavigationProbe() {
  const navigate = useNavigate();
  const catalog = useServerFunctionCatalog({ addLog: vi.fn() });

  return (
    <div>
      <div data-testid="active-id">{catalog.activeId ?? 'none'}</div>
      <div data-testid="edit-slug">{catalog.editSlugFromUrl ?? 'none'}</div>
      <button type="button" onClick={() => navigate('/studio/server-functions')}>
        Go to list
      </button>
    </div>
  );
}

function EditToListNavigationHarness() {
  return (
    <PlatformMountProvider mount={testMount}>
      <EditToListNavigationProbe />
    </PlatformMountProvider>
  );
}

describe('useServerFunctionCatalog navigation', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();

    const jsonResponse = (body: unknown, status = 200) => {
      const payload = JSON.stringify(body);
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => payload,
        json: async () => body,
      } as Response;
    };

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/functions/system') {
        return jsonResponse({ success: true, items: [] });
      }

      if (url === '/api/functions') {
        return jsonResponse({
          success: true,
          items: [
            {
              id: 'fn_custom_1',
              name: 'cacheable-list',
              folder: 'custom',
              method: 'GET',
              path: '/api/custom/cacheable-list',
              code: 'res.json({ ok: true });',
            },
          ],
        });
      }

      if (url === '/api/data-sources') {
        return jsonResponse({ success: true, items: [] });
      }

      return jsonResponse({});
    }));
  });

  it('stays on the list route when leaving an edit deep link via main navigation', async () => {
    appQueryClient.clear();

    render(
      <QueryClientProvider client={appQueryClient}>
        <MemoryRouter initialEntries={['/studio/server-functions/edit/custom/cacheable-list']}>
          <Routes>
            <Route path="/studio/server-functions/*" element={<EditToListNavigationHarness />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-id').textContent).toBe('fn_custom_1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Go to list' }));

    await waitFor(() => {
      expect(screen.getByTestId('edit-slug').textContent).toBe('none');
      expect(screen.getByTestId('active-id').textContent).toBe('none');
    });
  });
});
