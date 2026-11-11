import {
  insertBaseInfoNode,
  updateBaseInfoNode,
} from '../base-info/treeRepository';
import { prisma } from '../users/prismaHelpers';
import { invalidateBaseInfoOptionsCache } from '../../services/baseInfoOptionsCache';
import {
  VOTING_BASE_INFO_CATEGORIES,
  VOTING_BASE_INFO_ROOT_TITLE,
  type VotingBaseInfoCategorySeed,
  type VotingBaseInfoItemSeed,
} from './votingBaseInfoCatalog';

export type VotingBaseInfoSeedResult = {
  rootId: string;
  categories: Array<{
    title: string;
    id: string;
    itemCount: number;
  }>;
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
    existingId,
    actorId,
  } = input;

  if (existingId) {
    await updateBaseInfoNode([
      title,
      shortName,
      viewOrder,
      note,
      null,
      value,
      true,
      null,
      null,
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
    null,
    null,
    undefined,
    actorId,
  ]);

  const id = inserted?.id;
  if (!id) {
    throw new Error(`Failed to create Base Info node "${title}".`);
  }
  return id;
};

const seedItem = async (
  categoryId: string,
  item: VotingBaseInfoItemSeed,
  actorId: number | null,
): Promise<string> => {
  const existing = await findChildByShortName(categoryId, item.shortName)
    ?? await findChildByTitle(categoryId, item.title);

  return upsertNode({
    parentId: categoryId,
    title: item.title,
    shortName: item.shortName,
    viewOrder: item.viewOrder,
    value: item.value,
    note: item.note?.trim() || null,
    existingId: existing?.id ?? null,
    actorId,
  });
};

const seedCategory = async (
  rootId: string,
  category: VotingBaseInfoCategorySeed,
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

  for (const entry of category.items) {
    await seedItem(categoryId, entry, actorId);
  }

  return { id: categoryId, itemCount: category.items.length };
};

export async function seedVotingBaseInfo(actorId: number | null = null): Promise<VotingBaseInfoSeedResult> {
  const existingRoot = await findRootByTitle(VOTING_BASE_INFO_ROOT_TITLE);
  const rootId = await upsertNode({
    parentId: null,
    title: VOTING_BASE_INFO_ROOT_TITLE,
    viewOrder: 221,
    value: 1,
    existingId: existingRoot?.id ?? null,
    actorId,
  });

  const categories: VotingBaseInfoSeedResult['categories'] = [];
  for (const category of VOTING_BASE_INFO_CATEGORIES) {
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

export async function unseedVotingBaseInfo(): Promise<{ deletedRootId: string | null }> {
  const root = await findRootByTitle(VOTING_BASE_INFO_ROOT_TITLE);
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
