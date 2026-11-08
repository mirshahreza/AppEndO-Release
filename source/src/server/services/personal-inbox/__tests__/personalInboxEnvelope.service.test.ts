import { describe, expect, it, vi } from 'vitest';
import type { PersonalInboxItem } from '../../../../shared/api/contracts/personal-inbox/types';

const { getUserNotificationForUser } = vi.hoisted(() => ({
  getUserNotificationForUser: vi.fn(),
}));

vi.mock('../../notifications/userNotification.service', () => ({
  getUserNotificationForUser,
  markNotificationRead: vi.fn(),
  markNotificationUnread: vi.fn(),
}));

vi.mock('../../notifications/userMessageDispatch.service', () => ({
  getUserMessageDispatchById: vi.fn(),
}));

vi.mock('../../direct-messages/directMessage.service', () => ({
  DirectMessageService: class MockDirectMessageService {
    listThreadMessages = vi.fn();
  },
}));

import { PersonalInboxEnvelopeService } from '../personalInboxEnvelope.service';

const alertItem: PersonalInboxItem = {
  id: 'alert:5',
  kind: 'alert',
  origin: 'Alert',
  originDetail: 'workflow',
  title: 'Task assigned',
  summary: 'Summary fallback',
  surfacedAt: '2026-11-01T12:00:00.000Z',
  attention: 'none',
  href: 'my-work',
  ref: { type: 'notification', id: 5 },
};

describe('PersonalInboxEnvelopeService', () => {
  it('builds a synthetic thread for alerts from notification body', async () => {
    getUserNotificationForUser.mockResolvedValue({
      id: 5,
      title: 'Task assigned',
      body: 'Please review the assignment.',
      severity: 'info',
      href: null,
      source: 'workflow',
      metadataJson: null,
      readAt: null,
      seenAt: null,
      createdAt: '2026-11-01T12:00:00.000Z',
    });

    const inboxService = {
      findItemForUser: vi.fn().mockResolvedValue(alertItem),
    };
    const service = new PersonalInboxEnvelopeService(
      inboxService as never,
      {} as never,
      {} as never,
    );
    const detail = await service.getItemDetail(
      { userId: 1, username: 'u', roles: [] },
      'alert:5',
    );

    expect(detail.itemKey).toBe('alert:5');
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0]?.body).toBe('Please review the assignment.');
    expect(detail.capabilities.forward).toBe(false);
    expect(detail.capabilities.reply).toBe(false);
    expect(detail.capabilities.showRelatedHref).toBe(true);
  });
});
