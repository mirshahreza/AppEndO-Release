/**
 * Voting schema installer for SQL Server (idempotent).
 */
import sql from 'mssql';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../../src/server/db/controlPlaneDatabase';
import { buildMssqlConfigFromControlPlaneUrl } from '../../src/server/db/mssqlControlPlaneConfig';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(scriptDir, 'db', 'install', 'vote_schema.sqlserver.sql');

export async function installVotingSchemaSqlServer(): Promise<string[]> {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (settings.provider !== 'sqlserver') {
    throw new Error(`installVotingSchemaSqlServer requires sqlserver control plane (got ${settings.provider}).`);
  }

  const ddl = readFileSync(schemaPath, 'utf8');
  const batches = ddl
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);

  const pool = await sql.connect(buildMssqlConfigFromControlPlaneUrl(settings.url));
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }

    const tables = await pool.request().query<{ TABLE_NAME: string }>(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME LIKE 'vote[_]%'
      ORDER BY TABLE_NAME
    `);
    return tables.recordset.map((row) => row.TABLE_NAME);
  } finally {
    await pool.close();
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('install-voting-schema-sqlserver.ts');
if (isMain) {
  installVotingSchemaSqlServer()
    .then((tables) => {
      console.log('[Voting SQL Server schema] Done.');
      console.log(`  tables: ${tables.join(', ') || '(none)'}`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Voting SQL Server schema] failed: ${message}`);
      process.exitCode = 1;
    });
}
