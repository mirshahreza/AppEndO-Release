import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiRequest, formatApiErrorMessage } from '../client';
import { setDevToolbarImpersonation } from '../../lib/devToolbarSignal';

describe('api client JSON parsing', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses valid JSON responses unchanged', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, items: [{ id: 1 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { data, response } = await apiGet<{ success: boolean; items: Array<{ id: number }> }>('/api/users');

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.items).toEqual([{ id: 1 }]);
  });

  it('returns an empty object for an empty JSON body', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    const { data } = await apiGet('/api/users');

    expect(data).toEqual({});
  });

  it('throws ApiError when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html><body>Bad Gateway</body></html>', {
        status: 502,
        statusText: 'Bad Gateway',
      }),
    );

    await expect(apiGet('/api/users')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(502);
      expect((error as ApiError).statusText).toBe('Bad Gateway');
      expect((error as ApiError).isParseError).toBe(true);
      expect((error as ApiError).bodySnippet).toContain('Bad Gateway');
      return true;
    });
  });

  it('deduplicates concurrent GET requests for the same path', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const [first, second] = await Promise.all([
      apiGet('/api/data-sources'),
      apiGet('/api/data-sources'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.data.success).toBe(true);
    expect(second.data.success).toBe(true);
  });

  it('does not force JSON Content-Type for FormData uploads', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, packageId: 'demo', version: '1.0.0' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const file = new File(['zip'], 'demo-1.0.0.zip', { type: 'application/zip' });
    const body = new FormData();
    body.append('file', file);

    await apiRequest('/api/packages/upload', { method: 'POST', body });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('formats ApiError messages with status and response preview', async () => {
    const error = new ApiError('Server returned a non-JSON response.', {
      status: 404,
      statusText: 'Not Found',
      bodySnippet: 'Not found',
      path: '/api/missing',
      isParseError: true,
    });

    expect(formatApiErrorMessage(error)).toContain('HTTP 404 Not Found');
    expect(formatApiErrorMessage(error)).toContain('Not found');
  });

  it('does not wrap an aborted fetch as a network failure', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiRequest('/api/boot', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  describe('PDK-7 impersonation header', () => {
    afterEach(() => {
      setDevToolbarImpersonation(null);
    });

    it('does not attach x-impersonate-grant when no impersonation is active', async () => {
      fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

      await apiGet('/api/users');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.has('x-impersonate-grant')).toBe(false);
    });

    it('attaches x-impersonate-grant on every call while a grant is active', async () => {
      setDevToolbarImpersonation({
        grantId: 'grant-123',
        targetUserId: 42,
        targetEmail: 'target@example.com',
        targetRoles: ['USER'],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

      await apiGet('/api/users');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.get('x-impersonate-grant')).toBe('grant-123');
    });

    it('stops attaching the header once impersonation is cleared', async () => {
      setDevToolbarImpersonation({
        grantId: 'grant-123',
        targetUserId: 42,
        targetEmail: 'target@example.com',
        targetRoles: ['USER'],
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      setDevToolbarImpersonation(null);
      fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

      await apiGet('/api/users');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.has('x-impersonate-grant')).toBe(false);
    });

    it('does not attach an expired grant (client-side safety net)', async () => {
      setDevToolbarImpersonation({
        grantId: 'grant-123',
        targetUserId: 42,
        targetEmail: 'target@example.com',
        targetRoles: ['USER'],
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      });
      fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

      await apiGet('/api/users');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.has('x-impersonate-grant')).toBe(false);
    });
  });
});
