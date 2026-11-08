import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import { getPrismaControlPlane } from '../../db/prismaControlPlane';

const countByWorkItemId = async (workItemIds: number[]): Promise<Map<number, number>> => {
  if (workItemIds.length === 0) {
    return new Map();
  }
  const prisma = getPrismaControlPlane();
  const rows = await prisma.workItemAttachment.groupBy({
    by: ['workItemId'],
    where: { workItemId: { in: workItemIds.map((id) => BigInt(id)) } },
    _count: { _all: true },
  });
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.workItemId != null) {
      counts.set(Number(row.workItemId), row._count._all);
    }
  }
  return counts;
};

const countByFeedbackId = async (feedbackIds: number[]): Promise<Map<number, number>> => {
  if (feedbackIds.length === 0) {
    return new Map();
  }
  const prisma = getPrismaControlPlane();
  const rows = await prisma.baseAppFeedbackAttachment.groupBy({
    by: ['feedbackId'],
    where: { feedbackId: { in: feedbackIds.map((id) => BigInt(id)) } },
    _count: { _all: true },
  });
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.feedbackId != null) {
      counts.set(Number(row.feedbackId), row._count._all);
    }
  }
  return counts;
};

export async function enrichPersonalInboxAttachmentCounts(
  items: PersonalInboxItem[],
): Promise<PersonalInboxItem[]> {
  if (items.length === 0) {
    return items;
  }

  const workItemIds: number[] = [];
  const feedbackIds: number[] = [];
  for (const item of items) {
    if (item.ref.type === 'work_item') {
      workItemIds.push(item.ref.id);
    } else if (item.ref.type === 'feedback') {
      feedbackIds.push(item.ref.id);
    }
  }

  const [workItemCounts, feedbackCounts] = await Promise.all([
    countByWorkItemId(workItemIds),
    countByFeedbackId(feedbackIds),
  ]);

  return items.map((item) => {
    let attachmentCount = 0;
    if (item.ref.type === 'work_item') {
      attachmentCount = workItemCounts.get(item.ref.id) ?? 0;
    } else if (item.ref.type === 'feedback') {
      attachmentCount = feedbackCounts.get(item.ref.id) ?? 0;
    }
    return { ...item, attachmentCount };
  });
}
