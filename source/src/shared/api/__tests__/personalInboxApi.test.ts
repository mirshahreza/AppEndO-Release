import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../authSession';
import { personalInboxApi } from '../personalInboxApi';

vi.mock('../authSession', () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const createJsonResponse = (status: number, body: unknown): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
} as Response);

describe('personalInboxApi', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('list builds query string and normalizes payload', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(200, {
      success: true,
      items: [{ id: 'alert:1' }],
      total: 1,
    }));

    const result = await personalInboxApi.list({ kind: 'alert', take: 5 });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/personal-inbox?kind=alert&take=5');
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('list omits kind when all', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(200, { success: true, items: [], total: 0 }));
    await personalInboxApi.list({ kind: 'all' });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/personal-inbox');
  });

  it('list throws on error response', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(500, { success: false, error: 'Server down' }));
    await expect(personalInboxApi.list()).rejects.toThrow('Server down');
  });

  it('list defaults missing items to empty array', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(200, { success: true, total: 0 }));
    const result = await personalInboxApi.list();
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('summary returns summary payload', async () => {
    const summary = {
      attentionCount: 2,
      breakdown: { workItems: 1, feedback: 0, alerts: 1 },
      preview: [],
    };
    apiFetchMock.mockResolvedValue(createJsonResponse(200, { success: true, summary }));
    await expect(personalInboxApi.summary()).resolves.toEqual(summary);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/personal-inbox/summary');
  });

  it('summary throws when summary missing', async () => {
    apiFetchMock.mockResolvedValue(createJsonResponse(200, { success: true }));
    await expect(personalInboxApi.summary()).rejects.toThrow(/Failed to load inbox summary/);
  });
});
