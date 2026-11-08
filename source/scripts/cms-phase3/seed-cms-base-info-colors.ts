/**
 * Re-apply CMS Base Info ui_color from the catalog onto existing rows.
 * Does not touch CMS tables — only Base Info upsert via seedCmsBaseInfo.
 */
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { seedCmsBaseInfo } from '../cms-phase1/seed/seedCmsBaseInfo';

const main = async () => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const result = await seedCmsBaseInfo(null);
  console.log(`[cms-base-info-colors] root=${result.rootId}`);
  for (const category of result.categories) {
    console.log(`  ${category.title}: ${category.itemCount} items`);
  }
};

main()
  .catch((error: unknown) => {
    console.error('[cms-base-info-colors]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
