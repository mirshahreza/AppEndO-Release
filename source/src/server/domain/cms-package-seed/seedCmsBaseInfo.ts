import {
  insertBaseInfoNode,
  updateBaseInfoNode,
} from '../base-info/treeRepository';
import { prisma } from '../users/prismaHelpers';
import { invalidateBaseInfoOptionsCache } from '../../services/baseInfoOptionsCache';
import {
  CMS_BASE_INFO_CATEGORIES,
  CMS_BASE_INFO_ROOT_TITLE,
  type CmsBaseInfoCategorySeed,
  type CmsBaseInfoItemSeed,
} from './cmsBaseInfoCatalog';
import { CMS_RETIRED_CONTENT_TAG_SHORT_NAMES } from './cmsSampleSiteCatalog';
import { cmsBaseInfoUiColor } from './cmsBaseInfoUiColors';
import { cmsBaseInfoUiHtml } from './cmsBaseInfoCatalog';

export type CmsBaseInfoSeedResult = {
  rootId: string;
  categories: Array<{
    title: string;
    id: string;
    itemCount: number;
  }>;
};

const findRootByTitle = async (title: string) => (
  prisma().baseInfo.findFirst({
    where: {
      parentId: null,
      title,
    },
    select: { id: true },
  })
);

const findChildByTitle = async (parentId: string, title: string) => (
  prisma().baseInfo.findFirst({
    where: {
      parentId,
      title,
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

const upsertNode = async (input: {
  parentId: string | null;
  title: string;
  shortName?: string | null;
  viewOrder: number;
  value: number;
  note?: string | null;
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
    note = null,
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
      shortName,
      viewOrder,
      note,
      null,
      value,
      true,
      effectiveUiColor,
      effectiveUiHtml,
      undefined,
      actorId,
      existingId,
    ]);
    return existingId;
  }

  const inserted = await insertBaseInfoNode([
    parentId,
    3,
    title,
    shortName,
    viewOrder,
    note,
    null,
    value,
    true,
    uiColor,
    uiHtml,
    undefined,
    actorId,
  ]);

  const id = inserted?.id;
  if (!id) {
    throw new Error(`Failed to create Base Info node "${title}".`);
  }
  return id;
};

const seedCategory = async (
  rootId: string,
  category: CmsBaseInfoCategorySeed,
  actorId: number | null,
): Promise<{ id: string; itemCount: number }> => {
  const existingCategory = await findChildByTitle(rootId, category.title);
  const categoryId = await upsertNode({
    parentId: rootId,
    title: category.title,
    viewOrder: category.viewOrder,
    value: category.value,
    existingId: existingCategory?.id ?? null,
    actorId,
  });

  for (const item of category.items) {
    await seedItem(categoryId, item, actorId);
  }

  if (category.title === 'Statuses') {
    await retireRemovedStatusItems(categoryId, category.items);
  }
  if (category.title === 'Content Tags') {
    await retireLegacyContentTags(categoryId);
  }

  return { id: categoryId, itemCount: category.items.length };
};

/** Soft-retire then remove Statuses items dropped from the catalog (frees HID slots). */
const retireRemovedStatusItems = async (
  categoryId: string,
  catalogItems: readonly CmsBaseInfoItemSeed[],
): Promise<void> => {
  const keep = new Set(catalogItems.map((entry) => entry.shortName));
  const children = await prisma().baseInfo.findMany({
    where: { parentId: categoryId },
    select: { id: true, shortName: true, isActive: true },
  });
  for (const child of children) {
    if (!child.shortName || keep.has(child.shortName)) {
      continue;
    }
    // Mark inactive first so options LOVs drop it immediately; hard delete is done by
    // `patch-cms-retire-approved-status.ts` after remapping cms_contents + HID compact.
    if (child.isActive) {
      await prisma().baseInfo.update({
        where: { id: child.id },
        data: { isActive: false },
      });
    }
  }
};

/** Soft-retire former news-desk and Harbor tags. Operator-created tags stay. */
const retireLegacyContentTags = async (categoryId: string): Promise<void> => {
  const retired = new Set<string>(CMS_RETIRED_CONTENT_TAG_SHORT_NAMES);
  const children = await prisma().baseInfo.findMany({
    where: { parentId: categoryId },
    select: { id: true, shortName: true, isActive: true },
  });
  for (const child of children) {
    if (!child.shortName || !retired.has(child.shortName) || !child.isActive) {
      continue;
    }
    await prisma().baseInfo.update({
      where: { id: child.id },
      data: { isActive: false },
    });
  }
};

const seedItem = async (
  categoryId: string,
  item: CmsBaseInfoItemSeed,
  actorId: number | null,
): Promise<string> => {
  const existing = await findChildByShortName(categoryId, item.shortName)
    ?? await findChildByTitle(categoryId, item.title);

  const catalogColor = cmsBaseInfoUiColor(item.shortName);

  return upsertNode({
    parentId: categoryId,
    title: item.title,
    shortName: item.shortName,
    viewOrder: item.viewOrder,
    value: item.value,
    note: item.note?.trim() || null,
    ...(catalogColor ? { uiColor: catalogColor } : {}),
    uiHtml: cmsBaseInfoUiHtml(item.lucideIcon),
    existingId: existing?.id ?? null,
    actorId,
  });
};

/** Idempotent Base Info seed for the CMS package root + categories + items. */
export async function seedCmsBaseInfo(actorId: number | null = null): Promise<CmsBaseInfoSeedResult> {
  const existingRoot = await findRootByTitle(CMS_BASE_INFO_ROOT_TITLE);
  const rootId = await upsertNode({
    parentId: null,
    title: CMS_BASE_INFO_ROOT_TITLE,
    viewOrder: 200,
    value: 1,
    uiHtml: null,
    existingId: existingRoot?.id ?? null,
    actorId,
  });

  const categories: CmsBaseInfoSeedResult['categories'] = [];
  for (const category of CMS_BASE_INFO_CATEGORIES) {
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

/** Remove CMS Base Info root and all descendants (Phase 1 rollback helper). */
export async function unseedCmsBaseInfo(): Promise<{ deletedRootId: string | null }> {
  const root = await findRootByTitle(CMS_BASE_INFO_ROOT_TITLE);
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
