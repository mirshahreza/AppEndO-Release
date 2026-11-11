/**
 * Resolve Base Info ids seeded by Voting Phase 1 (root → vocab categories).
 */

import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { VOTING_BASE_INFO_CATEGORIES, VOTING_BASE_INFO_ROOT_TITLE } from '../../src/server/domain/voting-package-seed/votingBaseInfoCatalog';

const findRootByTitle = async (title: string) => (
  prisma().baseInfo.findFirst({
    where: { parentId: null, title },
    select: { id: true },
  })
);

const findChildByTitle = async (parentId: string, title: string) => (
  prisma().baseInfo.findFirst({
    where: { parentId, title },
    select: { id: true },
  })
);

const requireCategory = async (rootId: string, title: string): Promise<string> => {
  const category = await findChildByTitle(rootId, title);
  if (!category) {
    throw new Error(
      `Voting Phase 3: Base Info category "${title}" missing under Voting root. Run npm run voting:phase1 first.`,
    );
  }
  return category.id;
};

export type VotingVocabCategoryTitle = (typeof VOTING_BASE_INFO_CATEGORIES)[number]['title'];

export type VotingResolvedIds = {
  rootId: string;
  categoryIds: Record<VotingVocabCategoryTitle, string>;
};

export const resolveVotingIds = async (): Promise<VotingResolvedIds> => {
  const root = await findRootByTitle(VOTING_BASE_INFO_ROOT_TITLE);
  if (!root) {
    throw new Error('Voting Phase 3: Base Info root "Voting" missing. Run npm run voting:phase1 first.');
  }

  const categoryEntries = await Promise.all(
    VOTING_BASE_INFO_CATEGORIES.map(async (category) => [
      category.title,
      await requireCategory(root.id, category.title),
    ] as const),
  );
  const categoryIds = Object.fromEntries(categoryEntries) as VotingResolvedIds['categoryIds'];

  return { rootId: root.id, categoryIds };
};

export type VotingVocabOption = { value: string; label: string; uiColor?: string | null };

const listCategoryOptions = async (categoryId: string): Promise<VotingVocabOption[]> => {
  const rows = await prisma().baseInfo.findMany({
    where: { parentId: categoryId },
    orderBy: { viewOrder: 'asc' },
    select: { id: true, title: true, uiColor: true },
  });
  return rows.map((row) => ({
    value: row.id,
    label: row.title,
    uiColor: row.uiColor,
  }));
};

export type VotingFilterOptions = {
  votingStatusOptions: VotingVocabOption[];
};

export const resolveVotingFilterOptions = async (
  ids: VotingResolvedIds,
): Promise<VotingFilterOptions> => {
  const votingStatusOptions = await listCategoryOptions(ids.categoryIds['Voting statuses']);
  return { votingStatusOptions };
};
