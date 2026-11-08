/**
 * Restore CMS Base Info + cms_contents sample rows after a fresh install/reset.
 *
 * Usage:
 *   npx tsx scripts/cms-phase1/restore-cms-data.ts
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../../src/server/db/controlPlaneDatabase';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { installCmsSchemaSqlServer } from './install-cms-schema-sqlserver';
import { seedCmsRuntimeData } from './seed/seedCmsRuntimeData';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const republishContentsEditor = (): void => {
  console.log('[CMS restore] Republishing Content Editor with current Base Info ids…');
  execSync('npx tsx --import ./scripts/tsx-css-register.mjs scripts/cms-phase3/republish-contents-editor.ts', {
    cwd: path.join(scriptDir, '../..'),
    stdio: 'inherit',
  });
};

const main = async (): Promise<void> => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (settings.provider === 'sqlserver') {
    console.log('[CMS restore] Applying SQL Server CMS schema…');
    const tables = await installCmsSchemaSqlServer();
    console.log(`  tables: ${tables.join(', ') || '(none)'}`);
  } else if (settings.provider === 'postgresql') {
    console.log('[CMS restore] PostgreSQL detected — run `npm run cms:phase1` for schema + edge wiring, or only seed if tables already exist.');
  } else {
    throw new Error(`CMS restore: unsupported control-plane provider "${settings.provider}".`);
  }

  await seedCmsRuntimeData();
  execSync('npx tsx --import ./scripts/tsx-css-register.mjs scripts/cms-phase3/rebuild-cms-vocab.ts', {
    cwd: path.join(scriptDir, '../..'),
    stdio: 'inherit',
  });
  republishContentsEditor();
  console.log('[CMS restore] Complete.');
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`[CMS restore] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
