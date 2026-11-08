/**
 * Backfill base_info_title_path for all cultures.
 * Run: npx tsx scripts/recompute-base-info-title-paths.ts
 */
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { initPrismaControlPlane, closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { closeControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';
import { ensureBaseInfoCultureTextTable } from '../src/server/domain/base-info/baseInfoCultureTextSequelizeModel';
import { rebuildAllBaseInfoCultureTextFromTranslationStore } from '../src/server/domain/base-info/baseInfoCultureTextSqlSync';
import { recomputeAllBaseInfoTitlePaths } from '../src/server/domain/base-info/baseInfoTitlePath';
import { ensureBaseInfoTitlePathTable } from '../src/server/domain/base-info/baseInfoTitlePathSequelizeModel';
import { bootstrapPlatformCultureTranslationsFromSettings } from '../src/server/services/platform/platformCultureTranslations.service';

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  bootstrapPlatformCultureTranslationsFromSettings(SETTINGS_PATH);
  await ensureBaseInfoCultureTextTable();
  await ensureBaseInfoTitlePathTable();

  const mirrored = await rebuildAllBaseInfoCultureTextFromTranslationStore();
  console.log(`Mirrored ${mirrored} base_info_culture_text row(s).`);

  await recomputeAllBaseInfoTitlePaths();
  console.log('base_info_title_path recomputed for all nodes and cultures.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closePrismaControlPlane();
    await closeControlPlaneSequelize();
  });
