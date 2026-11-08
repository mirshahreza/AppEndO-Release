import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthRequestContext } from '../../../middleware/auth.middleware';
import { PersonalInboxService } from '../personalInbox.service';
import type { FeedbackService } from '../../feedback/feedback.service';

vi.mock('../../../domain/workflow/engine/workItemInboxService', () => ({
  listWorkItemInbox: vi.fn(),
}));

vi.mock('../../notifications/userNotification.service', () => ({
  listUserNotifications: vi.fn(),
  countUnseenNotifications: vi.fn(),
}));

vi.mock('../personalInboxAttachmentCounts', () => ({
  enrichPersonalInboxAttachmentCounts: vi.fn(async (items: unknown[]) => items),
}));

vi.mock('../personalInboxDirectMessageItems', () => ({
  collectPersonalInboxDirectMessageItems: vi.fn(async () => []),
}));

import { listWorkItemInbox } from '../../../domain/workflow/engine/workItemInboxService';
import { listUserNotifications } from '../../notifications/userNotification.service';

const auth: AuthRequestContext = { userId: 7, roles: ['USER'], username: 'u7' };

const feedbackService = {
  listMine: vi.fn(),
  listAdmin: vi.fn(),
} as unknown as FeedbackService;

describe('PersonalInboxService (live mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('summary breakdown matches attention kinds', async () => {
    vi.mocked(listWorkItemInbox).mockResolvedValue([]);
    vi.mocked(feedbackService.listMine).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 40 });
    vi.mocked(feedbackService.listAdmin).mockRejectedValue(new Error('forbidden'));
    vi.mocked(listUserNotifications).mockResolvedValue([
      {
        id: 1,
        title: 'A',
        body: 'b',
        severity: 'info',
        href: null,
        source: 'x',
        metadataJson: null,
        readAt: null,
        seenAt: null,
        createdAt: '2026-10-01T00:00:00.000Z',
      },
      {
        id: 2,
        title: 'Read',
        body: 'b',
        severity: 'info',
        href: null,
        source: 'x',
        metadataJson: null,
        readAt: '2026-10-01T01:00:00.000Z',
        seenAt: null,
        createdAt: '2026-09-30T00:00:00.000Z',
      },
    ]);

    const service = new PersonalInboxService(feedbackService, { readMode: 'live' });
    const summary = await service.summary(auth);
    expect(summary.attentionCount).toBe(1);
    expect(summary.breakdown).toEqual({ workItems: 0, feedback: 0, alerts: 1 });
    expect(summary.preview).toHaveLength(2);
  });

  it('list respects take cap and kind filter', async () => {
    vi.mocked(listWorkItemInbox).mockImplementation(async (bucket) => {
      if (bucket === 'MINE_ASSIGNED') {
        return [{
          id: 1,
          workItemType: 'T',
          titleText: 'W',
          summaryText: null,
          status: 'OPEN',
          priority: 0,
          createdAt: '2026-10-01T00:00:00.000Z',
          dueAt: null,
          followUpAt: null,
          approvalGroupKey: null,
          allowedOutcomes: [],
        }];
      }
      return [];
    });
    vi.mocked(feedbackService.listMine).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 40 });
    vi.mocked(feedbackService.listAdmin).mockRejectedValue(new Error('forbidden'));
    vi.mocked(listUserNotifications).mockResolvedValue([]);

    const service = new PersonalInboxService(feedbackService, { readMode: 'live' });
    const all = await service.list(auth, { take: 100 });
    expect(all.total).toBe(1);

    const wi = await service.list(auth, { kind: 'work_item' });
    expect(wi.items).toHaveLength(1);

    const fb = await service.list(auth, { kind: 'feedback' });
    expect(fb.total).toBe(0);
  });
});
