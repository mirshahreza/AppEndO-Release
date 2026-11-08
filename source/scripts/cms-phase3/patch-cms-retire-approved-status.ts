/**
 * Retire dropped CMS Statuses (Approved / Pending / Spam) and compact HIDs (no gaps).
 *
 * - Re-seeds Base Info catalog
 * - Remaps cms_contents off retired ids onto fallbacks, then deletes the rows
 * - Renames remaining Statuses leaves to parent.001…parent.00N in catalog order
 *
 * Usage: npx tsx scripts/cms-phase3/patch-cms-retire-approved-status.ts
 */
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { renameBaseInfoSubtree } from '../../src/server/domain/base-info/treeRepository';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { invalidateBaseInfoOptionsCache } from '../../src/server/services/baseInfoOptionsCache';
import { CMS_BASE_INFO_CATEGORIES } from '../cms-phase1/seed/cmsBaseInfoCatalog';
import { seedCmsBaseInfo } from '../cms-phase1/seed/seedCmsBaseInfo';
import { resolveCmsIds } from './cmsIds';

/** Retired shortName → catalog shortName used as cms_contents remap target. */
const STATUS_RETIRE_FALLBACK: Record<string, string> = {
  approved: 'published',
  pending: 'in_review',
  spam: 'rejected',
};

const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
const edgeExec = createEdgeDbQueryExecutor({ getDataSources });

const defaultDataSourceId = (): string => {
  const sources = getDataSources();
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('CMS status retire requires a default data source.');
  }
  return source.id;
};

const padHidSegment = (order: number): string => String(order).padStart(3, '0');

const remapCmsContentsStatus = async (fromId: string, toId: string): Promise<number> => {
  if (fromId === toId) {
    return 0;
  }
  const result = await edgeExec(
    `UPDATE cms_contents
        SET status_code = ?, updated_at = ?
      WHERE status_code = ?`,
    [toId, new Date().toISOString(), fromId],
    { dataSourceId: defaultDataSourceId() },
  );
  return result.count;
};

const renameStatusLeaf = async (
  previousId: string,
  nextId: string,
  parentId: string,
): Promise<void> => {
  if (previousId === nextId) {
    return;
  }
  const occupied = await prisma().baseInfo.findUnique({
    where: { id: nextId },
    select: { id: true },
  });
  if (occupied) {
    throw new Error(`Cannot rename ${previousId} → ${nextId}: target already exists.`);
  }
  await renameBaseInfoSubtree([previousId, nextId, parentId, null, null]);
};

const compactStatusesHids = async (statusesCategoryId: string): Promise<void> => {
  const catalog = CMS_BASE_INFO_CATEGORIES.find((category) => category.title === 'Statuses');
  if (!catalog) {
    throw new Error('Statuses catalog missing.');
  }

  const rows = await prisma().baseInfo.findMany({
    where: { parentId: statusesCategoryId, isActive: true },
    select: { id: true, shortName: true },
  });
  const byShortName = new Map(
    rows
      .filter((row) => typeof row.shortName === 'string' && row.shortName.length > 0)
      .map((row) => [row.shortName!, row]),
  );

  const planned = catalog.items.map((item) => {
    const row = byShortName.get(item.shortName);
    if (!row) {
      throw new Error(`Active Statuses item "${item.shortName}" missing after seed.`);
    }
    return {
      shortName: item.shortName,
      fromId: row.id,
      finalId: `${statusesCategoryId}.${padHidSegment(item.viewOrder)}`,
      tempId: `${statusesCategoryId}.9${padHidSegment(item.viewOrder)}`,
      viewOrder: item.viewOrder,
      value: item.value,
    };
  });

  for (const entry of planned) {
    if (entry.fromId === entry.finalId) {
      continue;
    }
    await renameStatusLeaf(entry.fromId, entry.tempId, statusesCategoryId);
    const remapped = await remapCmsContentsStatus(entry.fromId, entry.tempId);
    console.log(`[cms-retire-statuses] temp ${entry.shortName}: ${entry.fromId} → ${entry.tempId} (cms_contents=${remapped})`);
    entry.fromId = entry.tempId;
  }

  for (const entry of planned) {
    if (entry.fromId !== entry.finalId) {
      await renameStatusLeaf(entry.fromId, entry.finalId, statusesCategoryId);
      const remapped = await remapCmsContentsStatus(entry.fromId, entry.finalId);
      console.log(`[cms-retire-statuses] final ${entry.shortName}: ${entry.fromId} → ${entry.finalId} (cms_contents=${remapped})`);
    }
    await prisma().baseInfo.update({
      where: { id: entry.finalId },
      data: {
        viewOrder: entry.viewOrder,
        value: entry.value,
        isActive: true,
      },
    });
  }
};

const main = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const seeded = await seedCmsBaseInfo(null);
  console.log(`[cms-retire-statuses] base-info seeded root=${seeded.rootId}`);

  const ids = await resolveCmsIds();
  const statusesCategoryId = ids.categoryIds.Statuses;
  const catalogShortNames = new Set(
    (CMS_BASE_INFO_CATEGORIES.find((category) => category.title === 'Statuses')?.items ?? [])
      .map((item) => item.shortName),
  );

  const idByShortName = new Map(
    (await prisma().baseInfo.findMany({
      where: { parentId: statusesCategoryId },
      select: { id: true, shortName: true },
    }))
      .filter((row) => row.shortName)
      .map((row) => [row.shortName!, row.id]),
  );

  const extras = await prisma().baseInfo.findMany({
    where: { parentId: statusesCategoryId },
    select: { id: true, shortName: true, isActive: true },
  });

  for (const extra of extras) {
    if (extra.shortName && catalogShortNames.has(extra.shortName)) {
      continue;
    }
    const fallbackShort = (extra.shortName && STATUS_RETIRE_FALLBACK[extra.shortName])
      || 'published';
    const fallbackId = idByShortName.get(fallbackShort) ?? ids.statusIds.published;
    if (!fallbackId) {
      throw new Error(`No fallback status for retired "${extra.shortName ?? extra.id}".`);
    }
    const remapped = await remapCmsContentsStatus(extra.id, fallbackId);
    await prisma().baseInfo.delete({ where: { id: extra.id } });
    console.log(
      `[cms-retire-statuses] deleted ${extra.shortName ?? '?'} id=${extra.id} → ${fallbackShort} (cms_contents=${remapped})`,
    );
  }

  await compactStatusesHids(statusesCategoryId);
  invalidateBaseInfoOptionsCache();

  const after = await resolveCmsIds();
  console.log('[cms-retire-statuses] Statuses HIDs:');
  const statuses = await prisma().baseInfo.findMany({
    where: { parentId: statusesCategoryId },
    orderBy: { viewOrder: 'asc' },
    select: { id: true, shortName: true, viewOrder: true, value: true, isActive: true },
  });
  for (const row of statuses) {
    console.log(`  ${row.id}  order=${row.viewOrder} value=${row.value} active=${row.isActive}  ${row.shortName}`);
  }
  console.log(
    `[cms-retire-statuses] aliases: approve→${after.commentStatusIds.approved} pending→${after.commentStatusIds.pending} spam→${after.commentStatusIds.spam}`,
  );
};

main()
  .catch((error: unknown) => {
    console.error('[cms-retire-statuses]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
