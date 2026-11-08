import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpConnectionRecord } from '../httpConnectionStore';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('../../ai/mcp/mcpUrlGuard', () => ({
  validateMcpRemoteUrl: vi.fn(async (urlString: string) => new URL(urlString)),
  createSsrfGuardedFetch: () => fetchMock,
}));

vi.mock('../httpConnectionVault', () => ({
  HTTP_CONNECTION_VAULT_OWNER_TYPE: 'http_connection',
  getHttpVaultSecret: vi.fn(async () => 'decrypted-secret'),
}));

import { callHttpConnection } from '../httpConnectionExecutor';
import { validateMcpRemoteUrl } from '../../ai/mcp/mcpUrlGuard';

const baseConnection = (overrides: Partial<HttpConnectionRecord> = {}): HttpConnectionRecord => ({
  id: 'conn-1',
  name: 'Test API',
  baseUrl: 'https://api.example.com',
  authKind: 'none',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdByUserId: 1,
  hasSecret: false,
  openApiSpec: {
    operations: [
      { operationId: 'listPets', method: 'GET', path: '/pets' },
      { operationId: 'getPet', method: 'GET', path: '/pets/{petId}' },
      { operationId: 'createPet', method: 'POST', path: '/pets' },
    ],
  },
  ...overrides,
});

describe('callHttpConnection', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  it('rejects an operationId that is not part of the imported spec', async () => {
    await expect(callHttpConnection(baseConnection(), { operationId: 'deletePet' }))
      .rejects.toThrow('not part of this connection');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds the full URL from baseUrl + operation path and validates it through the SSRF guard', async () => {
    await callHttpConnection(baseConnection(), { operationId: 'listPets' });
    expect(validateMcpRemoteUrl).toHaveBeenCalledWith('https://api.example.com/pets');
  });

  it('substitutes path params into the operation path', async () => {
    await callHttpConnection(baseConnection(), { operationId: 'getPet', pathParams: { petId: '42' } });
    expect(validateMcpRemoteUrl).toHaveBeenCalledWith('https://api.example.com/pets/42');
  });

  it('attaches an apiKey header when authKind is apiKey', async () => {
    const connection = baseConnection({
      authKind: 'apiKey',
      apiKeyHeaderName: 'X-Api-Key',
      hasSecret: true,
    });
    await callHttpConnection(connection, { operationId: 'listPets' });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe('decrypted-secret');
  });

  it('attaches a bearer Authorization header when authKind is bearer', async () => {
    const connection = baseConnection({
      authKind: 'bearer',
      hasSecret: true,
    });
    await callHttpConnection(connection, { operationId: 'listPets' });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer decrypted-secret');
  });

  it('attaches a basic Authorization header when authKind is basic', async () => {
    const connection = baseConnection({
      authKind: 'basic',
      basicUsername: 'admin',
      hasSecret: true,
    });
    await callHttpConnection(connection, { operationId: 'listPets' });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const expected = `Basic ${Buffer.from('admin:decrypted-secret').toString('base64')}`;
    expect((init.headers as Record<string, string>).Authorization).toBe(expected);
  });

  it('sends a JSON body for non-GET/DELETE operations only', async () => {
    await callHttpConnection(baseConnection(), { operationId: 'createPet', body: { name: 'Rex' } });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.body).toBe(JSON.stringify({ name: 'Rex' }));

    fetchMock.mockClear();
    await callHttpConnection(baseConnection(), { operationId: 'listPets', body: { ignored: true } });
    const [, getInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(getInit.body).toBeUndefined();
  });

  it('returns status, parsed JSON body and headers', async () => {
    const result = await callHttpConnection(baseConnection(), { operationId: 'listPets' });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.truncated).toBe(false);
  });

  it('falls back to plain text when the response is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('plain text body', { status: 200 }));
    const result = await callHttpConnection(baseConnection(), { operationId: 'listPets' });
    expect(result.body).toBe('plain text body');
  });
});
