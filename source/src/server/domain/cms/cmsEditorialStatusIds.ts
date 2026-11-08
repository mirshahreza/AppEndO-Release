import { prisma } from '../users/prismaHelpers';

export type CmsEditorialStatusIds = {
  published: string | null;
  draft: string | null;
  inReview: string | null;
};

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

const findOptionalItemByShortName = async (
  categoryId: string,
  shortName: string,
): Promise<string | null> => {
  const item = await prisma().baseInfo.findFirst({
    where: { parentId: categoryId, shortName, isActive: true },
    select: { id: true },
  });
  return item?.id ?? null;
};

/** Resolves CMS editorial status Base Info ids when the CMS package vocab is installed. */
export async function resolveCmsEditorialStatusIds(): Promise<CmsEditorialStatusIds | null> {
  const root = await findRootByTitle('CMS');
  if (!root) {
    return null;
  }
  const statusesCategory = await findChildByTitle(root.id, 'Statuses');
  if (!statusesCategory) {
    return null;
  }
  const [published, draft, inReview] = await Promise.all([
    findOptionalItemByShortName(statusesCategory.id, 'published'),
    findOptionalItemByShortName(statusesCategory.id, 'draft'),
    findOptionalItemByShortName(statusesCategory.id, 'in_review'),
  ]);
  return { published, draft, inReview };
}

export function buildCmsAwaitingReviewStatusFilter(statusIds: CmsEditorialStatusIds): string[] {
  const codes = [statusIds.draft, statusIds.inReview].filter((value): value is string => Boolean(value));
  return [...new Set(codes)];
}
