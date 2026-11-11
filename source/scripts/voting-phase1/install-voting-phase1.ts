/**
 * Voting package — Phase 1 (schema + Base Info + edge models).
 *
 *   npm run voting:phase1
 *   npm run voting:phase1:rollback
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { readControlPlaneDatabaseSettings } from '../../src/server/db/controlPlaneDatabase';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { EdgeModelService } from '../../src/server/services/data-api/edgeModelService';
import { buildMssqlConfigFromControlPlaneUrl } from '../../src/server/db/mssqlControlPlaneConfig';
import sql from 'mssql';
import {
  VOTE_TABLE_NAMES,
  seedVotingBaseInfo,
  unseedVotingBaseInfo,
} from './index';
import { installVotingSchemaSqlServer } from './install-voting-schema-sqlserver';
import { importVoteEdgeModels, removeVoteEdgeModels } from './wireVoteEdgeAssociations';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const uninstallSqlPath = path.join(scriptDir, 'db', 'uninstall', 'vote_schema.sqlserver.sql');
const migrateSqlPath = path.join(scriptDir, 'db', 'migrate', 'rename-elections-to-votings.sqlserver.sql');
const isRollback = process.argv.includes('--rollback');
const VOTE_TABLE_NAME_SET = new Set<string>(VOTE_TABLE_NAMES);

const createEdgeModelService = (): EdgeModelService => {
  const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
  return new EdgeModelService({
    settingsPath: SETTINGS_PATH,
    edgeDbQuery: createEdgeDbQueryExecutor({ getDataSources }),
    getDataSources,
  });
};

const resolveDefaultDataSourceId = (): string => {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source?.id) {
    throw new Error('Voting Phase 1 requires a default data source in settings.');
  }
  return source.id;
};

const runMssqlUninstallBatches = async (): Promise<void> => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (settings.provider !== 'sqlserver') {
    throw new Error('Voting uninstall SQL batch file requires sqlserver control plane.');
  }
  const ddl = readFileSync(uninstallSqlPath, 'utf8');
  const batches = ddl
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
  const pool = await sql.connect(buildMssqlConfigFromControlPlaneUrl(settings.url));
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }
  } finally {
    await pool.close();
  }
};

const verifyVoteTables = async (): Promise<string[]> => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (settings.provider !== 'sqlserver') {
    return [...VOTE_TABLE_NAMES];
  }
  const pool = await sql.connect(buildMssqlConfigFromControlPlaneUrl(settings.url));
  try {
    const result = await pool.request().query<{ TABLE_NAME: string }>(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME LIKE 'vote[_]%'
      ORDER BY TABLE_NAME
    `);
    return result.recordset.map((row) => row.TABLE_NAME);
  } finally {
    await pool.close();
  }
};

const install = async (): Promise<void> => {
  const cp = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (cp.provider !== 'sqlserver') {
    throw new Error('Voting Phase 1 v1 targets SQL Server control plane (same as Hawiety).');
  }

  console.log('[Voting Phase 1] Applying legacy rename (vote_elections → vote_votings)…');
  const ddlMigrate = readFileSync(migrateSqlPath, 'utf8');
  const migrateBatches = ddlMigrate
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
  const migrateSettings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  const migratePool = await sql.connect(buildMssqlConfigFromControlPlaneUrl(migrateSettings.url));
  try {
    for (const batch of migrateBatches) {
      await migratePool.request().query(batch);
    }
  } finally {
    await migratePool.close();
  }

  console.log('[Voting Phase 1] Applying schema…');
  const tables = await installVotingSchemaSqlServer();
  console.log(`  tables: ${tables.join(', ')}`);

  console.log('[Voting Phase 1] Seeding Base Info…');
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const seedResult = await seedVotingBaseInfo(null);
  console.log(`  root Voting id=${seedResult.rootId}`);
  for (const category of seedResult.categories) {
    console.log(`  category "${category.title}" id=${category.id} items=${category.itemCount}`);
  }

  console.log('[Voting Phase 1] Importing edge models + associations…');
  const dataSourceId = resolveDefaultDataSourceId();
  const edgeModelService = createEdgeModelService();
  await importVoteEdgeModels(edgeModelService, dataSourceId);

  const remaining = await verifyVoteTables();
  const missing = [...VOTE_TABLE_NAME_SET].filter((name) => !remaining.includes(name));
  if (missing.length > 0) {
    throw new Error(`Voting Phase 1 incomplete — missing tables: ${missing.join(', ')}`);
  }

  console.log('[Voting Phase 1] Done.');
  console.log('  Next: npm run voting:phase2');
};

const rollback = async (): Promise<void> => {
  console.log('[Voting Phase 1 rollback] Removing edge models…');
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const edgeModelService = createEdgeModelService();
  removeVoteEdgeModels(edgeModelService);

  console.log('[Voting Phase 1 rollback] Dropping vote_* tables…');
  await runMssqlUninstallBatches();

  console.log('[Voting Phase 1 rollback] Removing Base Info Voting tree…');
  const { deletedRootId } = await unseedVotingBaseInfo();
  console.log(`  deleted root: ${deletedRootId ?? '(already absent)'}`);

  const remaining = await verifyVoteTables();
  console.log('[Voting Phase 1 rollback] Done.');
  console.log(`  remaining vote_* tables: ${remaining.join(', ') || '(none)'}`);
};

const main = async () => {
  if (isRollback) {
    await rollback();
    return;
  }
  await install();
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Voting Phase 1] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
