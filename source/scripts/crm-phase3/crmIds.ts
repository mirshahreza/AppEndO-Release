/**
 * Resolve Base Info ids seeded by CRM Phase 1 (root → vocab categories), read-only.
 * Phase 3a bakes category ids into vocabulary designer documents. Later sub-phases
 * (3b+) extend this with closed-enum item ids as they need them.
 */

import { prisma } from '../../src/server/domain/users/prismaHelpers';

const findRootByTitleEn = async (titleEn: string) => (
  prisma().baseInfo.findFirst({
    where: {
      parentId: null,
      OR: [{ titleEn }, { title: titleEn }],
    },
    select: { id: true },
  })
);

const findChildByTitleEn = async (parentId: string, titleEn: string) => (
  prisma().baseInfo.findFirst({
    where: {
      parentId,
      OR: [{ titleEn }, { title: titleEn }],
    },
    select: { id: true },
  })
);

const requireCategory = async (rootId: string, title: string): Promise<string> => {
  const category = await findChildByTitleEn(rootId, title);
  if (!category) {
    throw new Error(
      `CRM Phase 3: Base Info category "${title}" missing under CRM root. Run npm run crm:phase1 first.`,
    );
  }
  return category.id;
};

export type CrmVocabCategoryTitle =
  | 'Lifecycle Stages'
  | 'Lead Sources'
  | 'Pipeline Stages'
  | 'Activity Types'
  | 'Ticket Status'
  | 'Ticket Priority'
  | 'Ticket Channel'
  | 'Customer Tags';

export type CrmResolvedIds = {
  rootId: string;
  categoryIds: Record<CrmVocabCategoryTitle, string>;
};

export const resolveCrmIds = async (): Promise<CrmResolvedIds> => {
  const root = await findRootByTitleEn('CRM');
  if (!root) {
    throw new Error('CRM Phase 3: Base Info root "CRM" missing. Run npm run crm:phase1 first.');
  }

  const categoryTitles: CrmVocabCategoryTitle[] = [
    'Lifecycle Stages',
    'Lead Sources',
    'Pipeline Stages',
    'Activity Types',
    'Ticket Status',
    'Ticket Priority',
    'Ticket Channel',
    'Customer Tags',
  ];
  const categoryEntries = await Promise.all(
    categoryTitles.map(async (title) => [title, await requireCategory(root.id, title)] as const),
  );
  const categoryIds = Object.fromEntries(categoryEntries) as CrmResolvedIds['categoryIds'];

  return { rootId: root.id, categoryIds };
};

export type CrmVocabOption = { value: string; label: string; uiColor?: string | null };

const listCategoryOptions = async (categoryId: string): Promise<CrmVocabOption[]> => {
  const rows = await prisma().baseInfo.findMany({
    where: { parentId: categoryId, isActive: true },
    orderBy: { viewOrder: 'asc' },
    select: { id: true, titleEn: true, uiColor: true },
  });
  return rows.map((row) => ({ value: row.id, label: row.titleEn, uiColor: row.uiColor }));
};

export type CrmFilterOptions = {
  lifecycleStages: CrmVocabOption[];
  leadSources: CrmVocabOption[];
  customerTags: CrmVocabOption[];
  pipelineStages: CrmVocabOption[];
};

export const resolveCrmFilterOptions = async (ids: CrmResolvedIds): Promise<CrmFilterOptions> => {
  const [lifecycleStages, leadSources, customerTags, pipelineStages] = await Promise.all([
    listCategoryOptions(ids.categoryIds['Lifecycle Stages']),
    listCategoryOptions(ids.categoryIds['Lead Sources']),
    listCategoryOptions(ids.categoryIds['Customer Tags']),
    listCategoryOptions(ids.categoryIds['Pipeline Stages']),
  ]);
  return { lifecycleStages, leadSources, customerTags, pipelineStages };
};
