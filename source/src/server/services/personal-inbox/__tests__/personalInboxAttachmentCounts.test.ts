import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PersonalInboxItem } from '../../../../shared/api/contracts/personal-inbox/types';

const groupByWorkItem = vi.fn();
const groupByFeedback = vi.fn();

vi.mock('../../../db/prismaControlPlane', () => ({
  getPrismaControlPlane: () => ({
    workItemAttachment: { groupBy: groupByWorkItem },
    baseAppFeedbackAttachment: { groupBy: groupByFeedback },
  }),
}));

import { enrichPersonalInboxAttachmentCounts } from '../personalInboxAttachmentCounts';

const baseItem = (overrides: Partial<PersonalInboxItem>): PersonalInboxItem => ({
  id: 'work_item:1',
  kind: 'work_item',
  origin: 'Workflow',
  originDetail: 'APPROVAL',
  title: 'Test',
  summary: null,
  surfacedAt: '2026-01-01T00:00:00.000Z',
  attention: 'action_required',
  href: 'my-inbox?workItemId=1',
  ref: { type: 'work_item', id: 1 },
  ...overrides,
});

describe('enrichPersonalInboxAttachmentCounts', () => {
  beforeEach(() => {
    groupByWorkItem.mockReset();
    groupByFeedback.mockReset();
    groupByWorkItem.mockResolvedValue([]);
    groupByFeedback.mockResolvedValue([]);
  });

  it('maps work-item and feedback attachment totals', async () => {
    groupByWorkItem.mockResolvedValue([
      { workItemId: 1n, _count: { _all: 2 } },
    ]);
    groupByFeedback.mockResolvedValue([
      { feedbackId: 9n, _count: { _all: 1 } },
    ]);

    const items: PersonalInboxItem[] = [
      baseItem({ id: 'work_item:1', ref: { type: 'work_item', id: 1 } }),
      baseItem({
        id: 'feedback:9',
        kind: 'feedback',
        ref: { type: 'feedback', id: 9 },
      }),
      baseItem({
        id: 'alert:3',
        kind: 'alert',
        ref: { type: 'notification', id: 3 },
      }),
    ];

    const result = await enrichPersonalInboxAttachmentCounts(items);
    expect(result[0]?.attachmentCount).toBe(2);
    expect(result[1]?.attachmentCount).toBe(1);
    expect(result[2]?.attachmentCount).toBe(0);
  });
});
