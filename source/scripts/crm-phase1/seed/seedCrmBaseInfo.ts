import {
  insertBaseInfoNode,
  updateBaseInfoNode,
} from '../../../src/server/domain/base-info/treeRepository';
import { prisma } from '../../../src/server/domain/users/prismaHelpers';
import { invalidateBaseInfoOptionsCache } from '../../../src/server/services/baseInfoOptionsCache';
import {
  CRM_BASE_INFO_CATEGORIES,
  CRM_BASE_INFO_ROOT_TITLE,
  type CrmBaseInfoCategorySeed,
  type CrmBaseInfoItemSeed,
  crmBaseInfoUiHtml,
} from './crmBaseInfoCatalog';
import { crmBaseInfoUiColor } from './crmBaseInfoUiColors';

/**
 * Stable CRM Base Info root id.
 * Must NOT use 103/104 — controlPlaneSeed treats those prefixes as deprecated
 * contact-topic leftovers and deletes them on every ensureControlPlaneInitialized.
 */
export const CRM_BASE_INFO_ROOT_ID = '110';

export type CrmBaseInfoSeedResult = {
  rootId: string;
  categories: Array<{
    title: string;
    id: string;
    itemCount: number;
  }>;
};

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

const findChildByShortName = async (parentId: string, shortName: string) => (
  prisma().baseInfo.findFirst({
    where: { parentId, shortName },
    select: { id: true },
  })
);

const toActor = (actorId: number | null) => (
  actorId !== null && Number.isFinite(actorId) ? BigInt(actorId) : null
);

const upsertNode = async (input: {
  parentId: string | null;
  title: string;
  shortName?: string | null;
  viewOrder: number;
  value: number;
  uiColor?: string | null;
  uiHtml?: string | null;
  existingId?: string | null;
  actorId: number | null;
}): Promise<string> => {
  const {
    parentId,
    title,
    shortName = null,
    viewOrder,
    value,
    uiColor = null,
    uiHtml = null,
    existingId,
    actorId,
  } = input;

  if (existingId) {
    let effectiveUiColor = uiColor;
    if (uiColor === undefined) {
      const existing = await prisma().baseInfo.findUnique({
        where: { id: existingId },
        select: { uiColor: true },
      });
      effectiveUiColor = existing?.uiColor ?? null;
    }

    let effectiveUiHtml = uiHtml;
    if (uiHtml === undefined) {
      const existing = await prisma().baseInfo.findUnique({
        where: { id: existingId },
        select: { uiHtml: true },
      });
      effectiveUiHtml = existing?.uiHtml ?? null;
    }

    await updateBaseInfoNode([
      title,
      title,
      title,
      title,
      shortName,
      viewOrder,
      null,
      null,
      null,
      null,
      null,
      value,
      true,
      effectiveUiColor,
      effectiveUiHtml,
      actorId,
      existingId,
    ]);
    return existingId;
  }

  const inserted = await insertBaseInfoNode([
    parentId,
    3,
    title,
    title,
    title,
    title,
    shortName,
    viewOrder,
    null,
    null,
    null,
    null,
    null,
    value,
    true,
    uiColor,
    uiHtml,
    actorId,
  ]);

  const id = inserted?.id;
  if (!id) {
    throw new Error(`Failed to create Base Info node "${title}".`);
  }
  return id;
};

const isDeprecatedRootId = (id: string): boolean => (
  id === '103' || id.startsWith('103.') || id === '104' || id.startsWith('104.')
);

const ensureCrmRoot = async (actorId: number | null): Promise<string> => {
  const actor = toActor(actorId);
  const existingByTitle = await findRootByTitleEn(CRM_BASE_INFO_ROOT_TITLE);
  if (existingByTitle && !isDeprecatedRootId(existingByTitle.id)) {
    await upsertNode({
      parentId: null,
      title: CRM_BASE_INFO_ROOT_TITLE,
      viewOrder: 210,
      value: 1,
      uiHtml: null,
      existingId: existingByTitle.id,
      actorId,
    });
    return existingByTitle.id;
  }

  const existingFixed = await prisma().baseInfo.findUnique({
    where: { id: CRM_BASE_INFO_ROOT_ID },
    select: { id: true },
  });
  if (existingFixed) {
    await upsertNode({
      parentId: null,
      title: CRM_BASE_INFO_ROOT_TITLE,
      viewOrder: 210,
      value: 1,
      uiHtml: null,
      existingId: existingFixed.id,
      actorId,
    });
    return existingFixed.id;
  }

  await prisma().baseInfo.create({
    data: {
      id: CRM_BASE_INFO_ROOT_ID,
      parentId: null,
      title: CRM_BASE_INFO_ROOT_TITLE,
      titleEn: CRM_BASE_INFO_ROOT_TITLE,
      titleFa: CRM_BASE_INFO_ROOT_TITLE,
      titleAr: CRM_BASE_INFO_ROOT_TITLE,
      viewOrder: 210,
      value: 1,
      isActive: true,
      createdBy: actor,
      updatedBy: actor,
    },
  });
  return CRM_BASE_INFO_ROOT_ID;
};

const seedCategory = async (
  rootId: string,
  category: CrmBaseInfoCategorySeed,
  actorId: number | null,
): Promise<{ id: string; itemCount: number }> => {
  const existingCategory = await findChildByTitleEn(rootId, category.title);
  const categoryId = await upsertNode({
    parentId: rootId,
    title: category.title,
    viewOrder: category.viewOrder,
    value: category.value,
    existingId: existingCategory?.id ?? null,
    actorId,
  });

  for (const entry of category.items) {
    await seedItem(categoryId, entry, actorId);
  }

  return { id: categoryId, itemCount: category.items.length };
};

const seedItem = async (
  categoryId: string,
  item: CrmBaseInfoItemSeed,
  actorId: number | null,
): Promise<string> => {
  const existing = await findChildByShortName(categoryId, item.shortName)
    ?? await findChildByTitleEn(categoryId, item.title);

  const catalogColor = crmBaseInfoUiColor(item.shortName);

  return upsertNode({
    parentId: categoryId,
    title: item.title,
    shortName: item.shortName,
    viewOrder: item.viewOrder,
    value: item.value,
    ...(catalogColor ? { uiColor: catalogColor } : {}),
    uiHtml: crmBaseInfoUiHtml(item.lucideIcon),
    existingId: existing?.id ?? null,
    actorId,
  });
};

/** Idempotent Base Info seed for the CRM package root + categories + items. */
export async function seedCrmBaseInfo(actorId: number | null = null): Promise<CrmBaseInfoSeedResult> {
  const rootId = await ensureCrmRoot(actorId);

  const categories: CrmBaseInfoSeedResult['categories'] = [];
  for (const category of CRM_BASE_INFO_CATEGORIES) {
    const seeded = await seedCategory(rootId, category, actorId);
    categories.push({
      title: category.title,
      id: seeded.id,
      itemCount: seeded.itemCount,
    });
  }

  invalidateBaseInfoOptionsCache();

  return { rootId, categories };
}

/** Remove CRM Base Info root and all descendants (Phase 1 rollback helper). */
export async function unseedCrmBaseInfo(): Promise<{ deletedRootId: string | null }> {
  const root = await findRootByTitleEn(CRM_BASE_INFO_ROOT_TITLE)
    ?? await prisma().baseInfo.findUnique({
      where: { id: CRM_BASE_INFO_ROOT_ID },
      select: { id: true },
    });
  if (!root) {
    return { deletedRootId: null };
  }

  const nodes = await prisma().baseInfo.findMany({
    where: {
      OR: [
        { id: root.id },
        { id: { startsWith: `${root.id}.` } },
      ],
    },
    select: { id: true },
  });
  const deepestFirst = [...nodes].sort((a, b) => b.id.length - a.id.length);
  for (const row of deepestFirst) {
    await prisma().baseInfo.delete({ where: { id: row.id } });
  }

  invalidateBaseInfoOptionsCache();
  return { deletedRootId: root.id };
}

/** Resolve a CRM Base Info item id by category title + shortName (for studio-meta filters). */
/** Resolve a CRM Base Info category id by title (for seeding studio-meta targetFilters or listing children). */
export async function findCrmBaseInfoCategoryId(categoryTitle: string): Promise<string> {
  const root = await findRootByTitleEn(CRM_BASE_INFO_ROOT_TITLE)
    ?? await prisma().baseInfo.findUnique({
      where: { id: CRM_BASE_INFO_ROOT_ID },
      select: { id: true },
    });
  if (!root) {
    throw new Error('CRM Base Info root missing.');
  }
  const category = await findChildByTitleEn(root.id, categoryTitle);
  if (!category) {
    throw new Error(`CRM Base Info category "${categoryTitle}" missing.`);
  }
  return category.id;
}

export async function findCrmBaseInfoItemId(
  categoryTitle: string,
  shortName: string,
): Promise<string> {
  const categoryId = await findCrmBaseInfoCategoryId(categoryTitle);
  const item = await findChildByShortName(categoryId, shortName);
  if (!item) {
    throw new Error(`CRM Base Info item "${shortName}" missing under "${categoryTitle}".`);
  }
  return item.id;
}
