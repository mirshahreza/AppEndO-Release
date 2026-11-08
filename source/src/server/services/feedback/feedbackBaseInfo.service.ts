import { BASE_INFO_ROOT_FEEDBACK_SUBJECT } from '../../../shared/api/contracts/feedback/constants';
import type { FeedbackSubjectOption } from '../../../shared/api/contracts/feedback/types';
import { prisma } from '../../domain/users/prismaHelpers';
import { ensureBaseInfoCode } from '../../utils/baseInfoValidation';

const resolveLabel = (row: { id: string; title: string | null }): string =>
  row.title?.trim() || row.id;

export const listFeedbackSubjectOptions = async (): Promise<FeedbackSubjectOption[]> => {
  const rows = await prisma().baseInfo.findMany({
    where: {
      parentId: BASE_INFO_ROOT_FEEDBACK_SUBJECT,
      isActive: true,
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: [{ viewOrder: 'asc' }, { id: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    label: resolveLabel(row),
  }));
};

export const buildFeedbackLabelMap = async (ids: string[]): Promise<Map<string, string>> => {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await prisma().baseInfo.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      title: true,
    },
  });
  return new Map(rows.map((row) => [row.id, resolveLabel(row)]));
};

export const assertFeedbackSubjectCode = async (code: string | null | undefined): Promise<void> => {
  if (!code?.trim()) return;
  try {
    await ensureBaseInfoCode(code.trim(), BASE_INFO_ROOT_FEEDBACK_SUBJECT, 'subjectId');
  } catch {
    throw new Error('subjectId is invalid.');
  }
};
