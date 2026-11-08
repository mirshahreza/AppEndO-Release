import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthRequestContext } from '../../../middleware/auth.middleware';
import { PersonalInboxService } from '../personalInbox.service';
import type { FeedbackService } from '../../feedback/feedback.service';

vi.mock('../../../domain/workflow/engine/workItemInboxService', () => ({
  listWorkItemInbox: vi.fn(),
}));

vi.mock('../personalInboxAttachmentCounts', () => ({
  enrichPersonalInboxAttachmentCounts: vi.fn(async (items: unknown[]) => items),
}));

vi.mock('../personalInboxDirectMessageItems', () => ({
  collectPersonalInboxDirectMessageItems: vi.fn(async () => []),
}));

vi.mock('../../notifications/userNotification.service', () => ({
  listUserNotifications: vi.fn(),
  countUnseenNotifications: vi.fn(),
}));

vi.mock('../../../domain/personal-inbox/personalInboxFolder.repository', () => ({
  personalInboxFolderRepository: {
    listTagIndex: vi.fn().mockResolvedValue(new Map<string, Set<string>>()),
    listUserFolders: vi.fn().mockResolvedValue([]),
  },
}));

import { listWorkItemInbox } from '../../../domain/workflow/engine/workItemInboxService';
import { listUserNotifications } from '../../notifications/userNotification.service';

const auth: AuthRequestContext = { userId: 7, roles: ['USER'], username: 'u7' };

const feedbackService = {
  listMine: vi.fn(),
  listAdmin: vi.fn(),
} as unknown as FeedbackService;

describe('PersonalInboxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges work items, feedback, and deduped alerts sorted by surfacedAt', async () => {
    vi.mocked(listWorkItemInbox).mockImplementation(async (bucket) => {
      if (bucket === 'MINE_ASSIGNED') {
        return [{
          id: 10,
          workItemType: 'APPROVAL',
          titleText: 'Approve budget',
          summaryText: null,
          status: 'OPEN',
          priority: 1,
          createdAt: '2026-10-01T10:00:00.000Z',
          dueAt: null,
          followUpAt: null,
          approvalGroupKey: null,
          allowedOutcomes: ['APPROVE'],
        }];
      }
      return [];
    });

    vi.mocked(feedbackService.listMine).mockResolvedValue({
      items: [{
        id: '5',
        subjectId: '100.3.1',
        subjectLabel: 'Bug',
        status: 'NEW',
        priority: 'NORMAL',
        title: 'Button broken',
        submittedAt: '2026-10-02T08:00:00.000Z',
        submitterUserId: 7,
        submitterDisplayName: 'u7',
        anonymousContact: null,
        assigneeUserId: null,
        assigneeDisplayName: null,
        assigneeRoleName: null,
        routingRuleId: null,
        routedAt: null,
        portalSlug: null,
        pageKey: null,
        route: null,
        metadata: null,
        messageCount: 1,
        lastMessageAt: '2026-10-02T09:00:00.000Z',
        lastMessagePreview: 'Help',
        unreadCount: 1,
        createdAt: '2026-10-02T08:00:00.000Z',
        updatedAt: '2026-10-02T09:00:00.000Z',
      }],
      total: 1,
      page: 1,
      pageSize: 40,
    });
    vi.mocked(feedbackService.listAdmin).mockRejectedValue(new Error('forbidden'));

    vi.mocked(listUserNotifications).mockResolvedValue([
      {
        id: 99,
        title: 'Mentioned on "Approve budget"',
        body: '@you',
        severity: 'info',
        href: 'my-inbox?workItemId=10',
        source: 'workflow.comment',
        metadataJson: JSON.stringify({ workItemId: 10 }),
        readAt: null,
        seenAt: null,
        createdAt: '2026-10-01T11:00:00.000Z',
      },
      {
        id: 100,
        title: 'Agent done',
        body: 'Finished',
        severity: 'info',
        href: null,
        source: 'agent_task',
        metadataJson: null,
        readAt: null,
        seenAt: null,
        createdAt: '2026-10-03T12:00:00.000Z',
      },
    ]);

    const service = new PersonalInboxService(feedbackService, { readMode: 'live' });
    const { items } = await service.list(auth, { take: 20 });

    expect(items.map((i) => i.id)).toEqual([
      'alert:100',
      'feedback:5',
      'work_item:10',
    ]);
    expect(items.find((i) => i.id === 'alert:99')).toBeUndefined();
    expect(items.find((i) => i.id === 'work_item:10')?.kind).toBe('work_item');
  });

  it('summary attentionCount matches list attention rows in live mode', async () => {
    vi.mocked(listWorkItemInbox).mockResolvedValue([]);
    vi.mocked(feedbackService.listMine).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 40 });
    vi.mocked(feedbackService.listAdmin).mockRejectedValue(new Error('forbidden'));
    vi.mocked(listUserNotifications).mockResolvedValue([
      {
        id: 50,
        title: 'Unread alert',
        body: 'x',
        severity: 'info',
        href: null,
        source: 's',
        metadataJson: null,
        readAt: null,
        seenAt: null,
        createdAt: '2026-10-03T00:00:00.000Z',
      },
    ]);

    const service = new PersonalInboxService(feedbackService, { readMode: 'live' });
    const summary = await service.summary(auth);
    const list = await service.list(auth);
    const attentionInList = list.items.filter(
      (i) => i.attention === 'action_required' || i.attention === 'unread',
    ).length;
    expect(summary.attentionCount).toBe(attentionInList);
    expect(summary.attentionCount).toBe(1);
  });
});
