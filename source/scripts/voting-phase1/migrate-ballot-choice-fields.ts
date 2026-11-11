/**
 * Apply ballot/choice columns and refresh edge models.
 *
 *   npm run voting:migrate-ballot-fields
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../../src/server/db/controlPlaneDatabase';
import { buildMssqlConfigFromControlPlaneUrl } from '../../src/server/db/mssqlControlPlaneConfig';
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { EdgeModelService } from '../../src/server/services/data-api/edgeModelService';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { importVoteEdgeModels } from './wireVoteEdgeAssociations';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(scriptDir, 'db', 'migrate', 'ballot-participant-choice-fields.sqlserver.sql');

const runSql = async (): Promise<void> => {
  const ddl = readFileSync(sqlPath, 'utf8');
  const batches = ddl
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  const pool = await sql.connect(buildMssqlConfigFromControlPlaneUrl(settings.url));
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }
  } finally {
    await pool.close();
  }
};

const refreshModels = async (): Promise<void> => {
  const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
  const edgeModelService = new EdgeModelService({
    settingsPath: SETTINGS_PATH,
    edgeDbQuery: createEdgeDbQueryExecutor({ getDataSources }),
    getDataSources,
  });
  const sources = getDataSources();
  const dataSourceId = sources.find((s) => s.isDefault)?.id ?? sources[0]?.id;
  if (!dataSourceId) throw new Error('No data source configured.');

  for (const objectName of ['vote_votings', 'vote_ballots', 'vote_candidates'] as const) {
    const model = listEdgeModels().find((m) => m.dataSourceId === dataSourceId && m.objectName === objectName);
    if (model) {
      await edgeModelService.refreshModel(model.id);
      console.log(`  refreshed edge model: ${objectName}`);
    }
  }
  await importVoteEdgeModels(edgeModelService, dataSourceId);
};

const main = async (): Promise<void> => {
  console.log('[Voting migrate] Applying ballot/choice columns…');
  await runSql();
  console.log('[Voting migrate] Refreshing edge models + associations…');
  await refreshModels();
  console.log('[Voting migrate] Done. Run npm run voting:phase2 to republish APIs if list fields changed.');
};

main().catch((error) => {
  console.error('[Voting migrate]', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
