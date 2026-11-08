import sql from 'mssql';

import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import { buildMssqlConfigFromControlPlaneUrl } from '../src/server/db/mssqlControlPlaneConfig';
import {
  SQL_SERVER_PERFORMANCE_INDEXES as INDEXES,
  buildCreateIndexSql as createIndexSql,
} from '../src/server/db/controlPlaneSqlServerIndexes';

// Kept for manual/offline use (e.g. against a DB the running server can't reach yet). The same
// index set is applied automatically on every boot against a sqlserver control plane — see
// ensureSqlServerPerformanceIndexes() in controlPlaneInit.ts — so this script is now a fallback,
// not the only way these indexes get created.
const main = async () => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (settings.provider !== 'sqlserver') {
    throw new Error(`Unsupported provider for this script: ${settings.provider}`);
  }

  const pool = await sql.connect(buildMssqlConfigFromControlPlaneUrl(settings.url));
  try {
    for (const index of INDEXES) {
      await pool.request().query(createIndexSql(index));
      console.log(`Ensured index: ${index.name}`);
    }

    const names = INDEXES.map((index) => `N'${index.name}'`).join(', ');
    const verify = await pool.request().query(`
      SELECT i.name, t.name AS table_name
      FROM sys.indexes i
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE i.name IN (${names})
      ORDER BY i.name
    `);

    console.log('Verified indexes:');
    for (const row of verify.recordset as Array<{ name: string; table_name: string }>) {
      console.log(`  - ${row.name} on ${row.table_name}`);
    }

    if (verify.recordset.length !== INDEXES.length) {
      throw new Error(`Expected ${INDEXES.length} indexes, found ${verify.recordset.length}.`);
    }

    console.log('All performance indexes applied.');
  } finally {
    await pool.close();
  }
};

main().catch((error) => {
  console.error('apply-performance-indexes failed:', error?.message || error);
  process.exit(1);
});
