/**
 * CMS domain — Phase 1 runtime data seed (Base Info tree + cms_settings singleton +
 * AppEndO public-site guide rows (pages, fragments, feature guides, annotated screenshots, tags). Schema tables + edge model wiring + studio-meta are
 * expected to already exist (created by an earlier phase-1 run); this script only
 * fills the rows they depend on. Portable across data source dialects via
 * `createEdgeDbQueryExecutor` (this environment's default data source is SQL Server,
 * not PostgreSQL — see p-packages-cms.md round 15/16 notes).
 */

import { createEdgeDbQueryExecutor } from '../../../core/database/EdgeDbRouter';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getDataSourcesFromSettings } from '../../db/dataSourcesStore';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../db/controlPlaneInit';
import { closePrismaControlPlane } from '../../db/prismaControlPlane';
import { seedCmsBaseInfo, type CmsBaseInfoSeedResult } from './seedCmsBaseInfo';
import { seedCmsSampleSite } from './seedCmsSampleSite';

const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
const exec = createEdgeDbQueryExecutor({ getDataSources });

const defaultDataSourceId = (): string => {
  const sources = getDataSources();
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('CMS Phase 1 data seed: no default data source configured.');
  }
  return source.id;
};

const ctx = () => ({ dataSourceId: defaultDataSourceId() });

const findCategoryItemId = async (
  seedResult: CmsBaseInfoSeedResult,
  categoryTitle: string,
  shortName: string,
): Promise<string> => {
  const category = seedResult.categories.find((item) => item.title === categoryTitle);
  if (!category) {
    throw new Error(`CMS Phase 1 data seed: category "${categoryTitle}" missing from seed result.`);
  }
  const rows = await exec<{ id: string }>(
    'SELECT id FROM base_info WHERE parent_id = ? AND short_name = ?',
    [category.id, shortName],
    ctx(),
  );
  const id = rows.data[0]?.id;
  if (!id) {
    throw new Error(`CMS Phase 1 data seed: item "${shortName}" missing under "${categoryTitle}".`);
  }
  return id;
};

/** Idempotent singleton row (id=1) seed for cms_settings. */
const seedCmsSettingsRow = async (seedResult: CmsBaseInfoSeedResult): Promise<boolean> => {
  const existing = await exec<{ id: number }>('SELECT id FROM cms_settings WHERE id = 1', [], ctx());
  if (existing.data.length > 0) {
    return false;
  }

  const autoPolicyId = await findCategoryItemId(seedResult, 'Comment Policies', 'auto');
  const plainFormatId = await findCategoryItemId(seedResult, 'Body Formats', 'plain');

  await exec(
    `INSERT INTO cms_settings (id, comments_enabled, comments_policy_code, comments_body_format_code, public_cache_ttl_seconds)
     VALUES (1, ?, ?, ?, 300)`,
    [true, autoPolicyId, plainFormatId],
    ctx(),
  );
  return true;
};

/** Idempotent CMS foundation + sample site rows (safe during package install; no control-plane reset). */
export const ensureCmsPackageRuntimeSeed = async (): Promise<void> => {
  const seedResult = await seedCmsBaseInfo(null);
  await seedCmsSettingsRow(seedResult);
  await seedCmsSampleSite(seedResult);
};

export const seedCmsRuntimeData = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  console.log('[CMS Phase 1 data] Seeding Base Info CMS tree…');
  const seedResult = await seedCmsBaseInfo(null);
  console.log(`  root CMS id=${seedResult.rootId}`);
  for (const category of seedResult.categories) {
    console.log(`  category "${category.title}" id=${category.id} items=${category.itemCount}`);
  }

  console.log('[CMS Phase 1 data] Seeding cms_settings singleton row…');
  const settingsInserted = await seedCmsSettingsRow(seedResult);
  console.log(`  settings row ${settingsInserted ? 'inserted' : 'already present'}`);

  console.log('[CMS Phase 1 data] Seeding AppEndO public-site guide, tags, and screenshots…');
  const sample = await seedCmsSampleSite(seedResult);
  console.log(
    `  contents upserted: ${sample.contentsUpserted}; assets: ${sample.assetsUpserted}; tags: ${sample.tagsLinked}; relations: ${sample.relationsUpserted}; revisions: ${sample.revisionsUpserted}; generated stills: ${sample.generatedAssets}; obsolete removed: ${sample.obsoleteRemoved}`,
  );
};

const isMain = process.argv[1] && process.argv[1].endsWith('seedCmsRuntimeData.ts');
if (isMain) {
  seedCmsRuntimeData()
    .catch((error: unknown) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error(`[CMS Phase 1 data] failed: ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePrismaControlPlane().catch(() => undefined);
    });
}
