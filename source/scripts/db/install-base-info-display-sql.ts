/**
 * Install zz_base_info_display_* SQL functions (provider-specific batch file).
 *
 *   npx tsx scripts/db/install-base-info-display-sql.ts
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { readControlPlaneDatabaseSettings } from '../../src/server/db/controlPlaneDatabase';
import { closeControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  await ensureControlPlaneInitialized();
  const { provider } = readControlPlaneDatabaseSettings();
  const sequelize = await getControlPlaneSequelize();

  if (provider === 'sqlserver') {
    const ddl = readFileSync(path.join(scriptDir, 'install', 'base_info_display_sql.sqlserver.sql'), 'utf8');
    const batches = ddl
      .split(/^\s*GO\s*$/gim)
      .map((batch) => batch.trim())
      .filter(Boolean);
    for (const batch of batches) {
      await sequelize.query(batch);
    }
    console.log('SQL Server: zz_base_info_display_* installed.');
  } else if (provider === 'postgresql') {
    const ddl = readFileSync(path.join(scriptDir, 'install', 'base_info_display_sql.postgresql.sql'), 'utf8');
    await sequelize.query(ddl);
    console.log('PostgreSQL: zz_base_info_display_* installed.');
  } else {
    console.warn(`Provider "${provider}" has no bundled display SQL — add functions manually or extend install script.`);
  }

  await closeControlPlaneSequelize();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
