// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreBrowserSession } from '../authSession';

const createJsonResponse = (status: number, payload: unknown): Response => (
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
);

const authUser = {
  id: 42,
  email: 'admin@append.os',
  role: 'ADMIN',
  roles: ['ADMIN'],
};

describe('restoreBrowserSession (session persistence contract)', () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns authenticated on first /me without calling refresh', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(200, {
      success: true,
      user: authUser,
    }));

    const result = await restoreBrowserSession();

    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.me.user?.email).toBe('admin@append.os');
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/auth/me');
  });

  it('silently refreshes when /me reports a restorable session', async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(200, { success: false, canRestoreSession: true }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true, user: authUser }));

    const result = await restoreBrowserSession();

    expect(result.status).toBe('authenticated');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/auth/me');
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe('/api/auth/me');
  });

  it('silently refreshes when /me returns 401 for an expired access cookie', async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(401, {
        success: false,
        error: 'Access token expired or invalid.',
      }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true, user: authUser }));

    const result = await restoreBrowserSession();

    expect(result.status).toBe('authenticated');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('/api/auth/refresh');
  });

  it('returns anonymous when /me reports no restorable session without calling refresh', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(200, { success: false, canRestoreSession: false }));

    const result = await restoreBrowserSession();

    expect(result.status).toBe('anonymous');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/auth/me');
  });

  it('returns anonymous when refresh fails (no valid refresh cookie)', async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(200, { success: false, canRestoreSession: true }))
      .mockResolvedValueOnce(createJsonResponse(401, { success: false, error: 'Invalid refresh token.' }));

    const result = await restoreBrowserSession();

    expect(result.status).toBe('anonymous');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns anonymous when refresh succeeds but /me still has no user', async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(401, { success: false }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: true }))
      .mockResolvedValueOnce(createJsonResponse(200, { success: false }));

    const result = await restoreBrowserSession();

    expect(result.status).toBe('anonymous');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
