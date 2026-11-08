import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthRequestContext } from '../../../middleware/auth.middleware';

vi.mock('../../notifications/userNotification.service', () => ({
  markNotificationRead: vi.fn(),
  markNotificationUnread: vi.fn(),
}));

vi.mock('../../../domain/personal-inbox/personalInboxSeen.repository', () => ({
  personalInboxSeenRepository: {
    clearSeen: vi.fn(),
  },
}));

vi.mock('../../../domain/personal-inbox/personalInboxFolder.repository', () => ({
  personalInboxFolderRepository: {
    listTagIndex: vi.fn(),
  },
}));

vi.mock('../personalInboxProjectionSync', () => ({
  patchPersonalInboxProjectionAttention: vi.fn(),
}));

import { markNotificationRead } from '../../notifications/userNotification.service';
import { personalInboxFolderRepository } from '../../../domain/personal-inbox/personalInboxFolder.repository';
import { patchPersonalInboxProjectionAttention } from '../personalInboxProjectionSync';
import { markNotificationUnread } from '../../notifications/userNotification.service';
import { personalInboxSeenRepository } from '../../../domain/personal-inbox/personalInboxSeen.repository';
import {
  dismissPersonalInboxAttention,
  filterPersonalInboxItemsForFolderScope,
  markPersonalInboxUnread,
} from '../personalInboxItemActions.service';
import { PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED } from '../../../../shared/personal-inbox/personalInboxFolderRefs';

const auth: AuthRequestContext = { userId: 7, username: 'u', roles: ['USER'] };

const feedbackService = {
  markRead: vi.fn(),
  markUnread: vi.fn(),
} as unknown as import('../../feedback/feedback.service').FeedbackService;

describe('personalInboxItemActions.service', () => {
  beforeEach(() => {
    vi.mocked(markNotificationRead).mockReset();
    vi.mocked(markNotificationUnread).mockReset();
    vi.mocked(personalInboxSeenRepository.clearSeen).mockReset();
    vi.mocked(personalInboxFolderRepository.listTagIndex).mockReset();
    vi.mocked(patchPersonalInboxProjectionAttention).mockReset();
    vi.mocked(feedbackService.markRead).mockReset();
    vi.mocked(feedbackService.markUnread).mockReset();
  });

  it('dismisses alert attention and patches projection', async () => {
    const result = await dismissPersonalInboxAttention(auth, 'alert:12', feedbackService);
    expect(result.dismissed).toBe(true);
    expect(markNotificationRead).toHaveBeenCalledWith(7, 12);
    expect(patchPersonalInboxProjectionAttention).toHaveBeenCalledWith(7, 'alert:12', 'none');
  });

  it('marks alert unread and clears seen state', async () => {
    const result = await markPersonalInboxUnread(auth, 'alert:12', feedbackService);
    expect(result.updated).toBe(true);
    expect(personalInboxSeenRepository.clearSeen).toHaveBeenCalledWith(7, 'alert:12');
    expect(markNotificationUnread).toHaveBeenCalledWith(7, 12);
    expect(patchPersonalInboxProjectionAttention).toHaveBeenCalledWith(7, 'alert:12', 'unread');
  });

  it('dismisses feedback attention via feedback read cursor', async () => {
    const result = await dismissPersonalInboxAttention(auth, 'feedback:42', feedbackService);
    expect(result.dismissed).toBe(true);
    expect(feedbackService.markRead).toHaveBeenCalledWith(42, auth);
    expect(patchPersonalInboxProjectionAttention).toHaveBeenCalledWith(7, 'feedback:42', 'none');
  });

  it('still dismisses feedback when ticket markRead fails', async () => {
    vi.mocked(feedbackService.markRead).mockRejectedValue(new Error('cursor failed'));
    const result = await dismissPersonalInboxAttention(auth, 'feedback:42', feedbackService);
    expect(result.dismissed).toBe(true);
    expect(patchPersonalInboxProjectionAttention).toHaveBeenCalledWith(7, 'feedback:42', 'none');
  });

  it('marks feedback unread via feedback service and clears seen state', async () => {
    const result = await markPersonalInboxUnread(auth, 'feedback:42', feedbackService);
    expect(result.updated).toBe(true);
    expect(personalInboxSeenRepository.clearSeen).toHaveBeenCalledWith(7, 'feedback:42');
    expect(feedbackService.markUnread).toHaveBeenCalledWith(42, auth);
    expect(patchPersonalInboxProjectionAttention).toHaveBeenCalledWith(7, 'feedback:42', 'unread');
  });

  it('accepts work item dismiss without side effects in this layer', async () => {
    const result = await dismissPersonalInboxAttention(auth, 'work_item:9', feedbackService);
    expect(result.dismissed).toBe(true);
    expect(patchPersonalInboxProjectionAttention).not.toHaveBeenCalled();
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it('filters inbox scope using folder tags', async () => {
    vi.mocked(personalInboxFolderRepository.listTagIndex).mockResolvedValue(
      new Map([
        ['alert:1', new Set([PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED])],
        ['work_item:2', new Set()],
      ]),
    );
    const items = [{ id: 'alert:1' }, { id: 'work_item:2' }];
    const filtered = await filterPersonalInboxItemsForFolderScope(7, items, { scope: 'system', slug: 'inbox' });
    expect(filtered.map((item) => item.id)).toEqual(['work_item:2']);
  });
});
