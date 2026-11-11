/**
 * Re-introspect all vote_* edge models from SQL Server (after column renames) and rewires associations.
 *
 *   npm run voting:refresh-edge-models
 */
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { EdgeModelService } from '../../src/server/services/data-api/edgeModelService';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { VOTE_TABLE_NAMES } from './index';
import { importVoteEdgeModels } from './wireVoteEdgeAssociations';

const main = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
  const edgeModelService = new EdgeModelService({
    settingsPath: SETTINGS_PATH,
    edgeDbQuery: createEdgeDbQueryExecutor({ getDataSources }),
    getDataSources,
  });
  const sources = getDataSources();
  const dataSourceId = sources.find((s) => s.isDefault)?.id ?? sources[0]?.id;
  if (!dataSourceId) {
    throw new Error('No data source configured.');
  }

  console.log('[Voting refresh] Refreshing edge models from database…');
  for (const objectName of VOTE_TABLE_NAMES) {
    const model = listEdgeModels().find((m) => m.dataSourceId === dataSourceId && m.objectName === objectName);
    if (model) {
      await edgeModelService.refreshModel(model.id);
      console.log(`  refreshed: ${objectName}`);
    } else {
      await edgeModelService.importModel({ dataSourceId, objectName, objectType: 'TABLE' });
      console.log(`  imported: ${objectName}`);
    }
  }

  console.log('[Voting refresh] Wiring associations…');
  await importVoteEdgeModels(edgeModelService, dataSourceId);
  console.log('[Voting refresh] Done. Run: npm run voting:phase2');
};

main()
  .catch((error) => {
    console.error('[Voting refresh]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
