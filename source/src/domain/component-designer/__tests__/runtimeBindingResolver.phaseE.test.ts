import { describe, expect, it, vi } from 'vitest';
import { collectBindingDependencies, resolveRuntimeBinding } from '../runtime';
import type { DesignerBindingDefinition } from '../types';

const createJsonResponse = (payload: unknown, init?: { ok?: boolean; status?: number; contentType?: string }) => ({
  ok: init?.ok ?? true,
  status: init?.status ?? 200,
  headers: {
    get: (name: string) => (name.toLowerCase() === 'content-type' ? (init?.contentType ?? 'application/json') : null),
  },
  json: async () => payload,
  text: async () => JSON.stringify(payload),
});

describe('component designer phase E runtime resolver', () => {
  it('resolves apiRef binding success with request config and response mapping', async () => {
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toBe('/api/customers?page=3');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer abc' });
      expect(init?.body).toBe(JSON.stringify({ tenant: 'north' }));
      return createJsonResponse({ data: { items: [{ id: 1 }, { id: 2 }] } });
    });

    const definition: DesignerBindingDefinition = {
      sourceType: 'apiRef',
      endpointRef: '/api/customers',
      requestConfig: {
        method: 'POST',
        headers: { Authorization: 'Bearer {{globals.token}}' },
        query: { page: '{{globals.page}}' },
        body: { tenant: '{{globals.tenant}}' },
      },
      responseMapping: 'data.items',
    };

    const result = await resolveRuntimeBinding(definition, {
      fetchImpl,
      context: {
        globals: { token: 'abc', page: 3, tenant: 'north' },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.log.attempts).toBe(1);
  });

  it('maps timeout failures to preview-timeout diagnostics', async () => {
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      init?.signal?.throwIfAborted?.();
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted.')));
      });
    }) as NonNullable<Parameters<typeof resolveRuntimeBinding>[1]['fetchImpl']>;

    const result = await resolveRuntimeBinding(
      {
        sourceType: 'apiRef',
        endpointRef: '/api/slow',
        timeoutMs: 250,
      },
      { fetchImpl },
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('preview-timeout');
    expect(result.value).toBeNull();
  });

  it('retries transient status codes before succeeding', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ error: { message: 'busy' } }, { ok: false, status: 503 }))
      .mockResolvedValueOnce(createJsonResponse({ rows: [1, 2, 3] }));
    const sleep = vi.fn(async () => undefined);

    const result = await resolveRuntimeBinding(
      {
        sourceType: 'apiRef',
        endpointRef: '/api/retry',
        retryPolicy: {
          maxAttempts: 2,
          retryDelayMs: 15,
        },
        responseMapping: 'rows',
      },
      { fetchImpl, sleep },
    );

    expect(result.ok).toBe(true);
    expect(result.value).toEqual([1, 2, 3]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(15);
  });

  it('maps API error payloads through errorMapping and returns fallback value', async () => {
    const fetchImpl = vi.fn(async () => createJsonResponse({ error: { message: 'Access denied' } }, { ok: false, status: 403 }));

    const result = await resolveRuntimeBinding(
      {
        sourceType: 'apiRef',
        endpointRef: '/api/protected',
        errorMapping: 'error.message',
        fallbackValue: [],
      },
      { fetchImpl },
    );

    expect(result.ok).toBe(false);
    expect(result.value).toEqual([]);
    expect(result.diagnostics[0].message).toBe('Access denied');
    expect(result.diagnostics[0].code).toBe('binding-runtime');
  });

  it('extracts dependencies from template placeholders and sourcePath references', () => {
    const dependencies = collectBindingDependencies({
      sourceType: 'apiRef',
      sourcePath: 'bindings.customer.id',
      endpointRef: '/api/orders/{{ bindings.customer.id }}',
      requestConfig: {
        headers: {
          Authorization: 'Bearer {{bindings.auth.token}}',
        },
        body: {
          filter: '{{bindings.filters.current}}',
        },
      },
    });

    expect(dependencies.sort()).toEqual(['auth.token', 'customer.id', 'filters.current']);
  });

  it('returns dependency diagnostics when a required binding is unresolved', async () => {
    const result = await resolveRuntimeBinding(
      {
        sourceType: 'expression',
        sourcePath: 'bindings.user.profile',
        fallbackValue: 'n/a',
      },
      {
        context: {
          bindings: {},
        },
      },
    );

    expect(result.ok).toBe(false);
    expect(result.value).toBe('n/a');
    expect(result.diagnostics[0].code).toBe('binding-dependency');
  });

  it('returns binding-invalid diagnostics when requestConfig headers/query are not objects', async () => {
    const fetchImpl = vi.fn(async () => createJsonResponse({ ok: true }));

    const result = await resolveRuntimeBinding(
      {
        sourceType: 'apiRef',
        endpointRef: '/api/x',
        requestConfig: {
          headers: [] as unknown as Record<string, string>,
        },
      },
      { fetchImpl },
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0].code).toBe('binding-invalid');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});