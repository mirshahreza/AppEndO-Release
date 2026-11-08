import http from 'http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalInboxListResult, PersonalInboxSummary } from '../../../shared/api/contracts/personal-inbox/types';

const listMock = vi.fn<[], Promise<PersonalInboxListResult>>();
const summaryMock = vi.fn<[], Promise<PersonalInboxSummary>>();
const getItemDetailMock = vi.fn();

vi.mock('../../services/personal-inbox/personalInboxEnvelope.service', () => ({
  PersonalInboxEnvelopeService: class MockPersonalInboxEnvelopeService {
    getItemDetail = getItemDetailMock;
  },
}));

vi.mock('../../middleware/auth.middleware', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.auth = { userId: 99, username: 'inbox-user', roles: ['USER'] };
    next();
  },
}));

vi.mock('../../middleware/rateLimit', () => ({
  createUserRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../services/feedback/feedback.service', () => ({
  FeedbackService: class MockFeedbackService {},
}));

vi.mock('../../services/personal-inbox/personalInbox.service', () => ({
  PersonalInboxService: class MockPersonalInboxService {
    list = listMock;

    summary = summaryMock;
  },
}));

describe('personal-inbox.routes', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    const { mountPersonalInboxRoutes } = await import('../personal-inbox.routes');
    mountPersonalInboxRoutes(app, '/tmp/settings.json');

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    listMock.mockReset();
    summaryMock.mockReset();
    getItemDetailMock.mockReset();
    listMock.mockResolvedValue({
      items: [{
        id: 'work_item:1',
        kind: 'work_item',
        origin: 'Workflow',
        originDetail: 'TASK',
        title: 'Task',
        summary: null,
        surfacedAt: '2026-10-01T00:00:00.000Z',
        attention: 'action_required',
        href: 'my-inbox?workItemId=1',
        ref: { type: 'work_item', id: 1 },
      }],
      total: 1,
    });
    summaryMock.mockResolvedValue({
      attentionCount: 1,
      breakdown: { workItems: 1, feedback: 0, alerts: 0 },
      preview: [],
    });
  });

  it('GET /api/personal-inbox returns success envelope', async () => {
    const response = await fetch(`${baseUrl}/api/personal-inbox`);
    expect(response.status).toBe(200);
    const body = await response.json() as PersonalInboxListResult & { success: boolean };
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.items[0]?.id).toBe('work_item:1');
    expect(listMock).toHaveBeenCalledOnce();
    expect(listMock.mock.calls[0]?.[1]).toEqual({ kind: undefined, take: undefined });
  });

  it('GET /api/personal-inbox forwards kind and take query params', async () => {
    const response = await fetch(`${baseUrl}/api/personal-inbox?kind=feedback&take=12`);
    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 99 }),
      { kind: 'feedback', take: 12 },
    );
    await response.json();
  });

  it('GET /api/personal-inbox ignores invalid kind values', async () => {
    await fetch(`${baseUrl}/api/personal-inbox?kind=not-a-kind`);
    expect(listMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: undefined }),
    );
  });

  it('GET /api/personal-inbox/summary returns summary envelope', async () => {
    const response = await fetch(`${baseUrl}/api/personal-inbox/summary`);
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; summary: PersonalInboxSummary };
    expect(body.success).toBe(true);
    expect(body.summary.attentionCount).toBe(1);
    expect(body.summary.breakdown.workItems).toBe(1);
    expect(summaryMock).toHaveBeenCalledOnce();
  });

  it('GET /api/personal-inbox/items/detail requires itemKey', async () => {
    const response = await fetch(`${baseUrl}/api/personal-inbox/items/detail`);
    expect(response.status).toBe(400);
    expect(getItemDetailMock).not.toHaveBeenCalled();
  });

  it('GET /api/personal-inbox/items/detail returns envelope', async () => {
    getItemDetailMock.mockResolvedValue({
      itemKey: 'alert:2',
      threadId: 'alert:2',
      item: {
        id: 'alert:2',
        kind: 'alert',
        origin: 'Alert',
        originDetail: null,
        title: 'Hi',
        summary: null,
        surfacedAt: '2026-11-01T00:00:00.000Z',
        attention: 'none',
        href: 'my-inbox',
        ref: { type: 'notification', id: 2 },
      },
      messages: [],
      capabilities: { reply: false, forward: true, showRelatedHref: false },
    });
    const response = await fetch(`${baseUrl}/api/personal-inbox/items/detail?itemKey=alert%3A2`);
    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; detail: { itemKey: string } };
    expect(body.success).toBe(true);
    expect(body.detail.itemKey).toBe('alert:2');
    expect(getItemDetailMock).toHaveBeenCalledOnce();
  });
});
