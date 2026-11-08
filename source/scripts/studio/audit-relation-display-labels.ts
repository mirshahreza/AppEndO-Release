import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { DataSourcesService } from '../../src/server/services/data-sources.service';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { getEdgeModelStudioMeta } from '../../src/server/services/data-api/edgeModelStudioMetaStore';
import { buildRelationsDatasheetRows } from '../../src/features/data-studio/lib/relationsDatasheetRows';
import { studioKeyForRelationRow } from '../../src/features/data-studio/lib/edgeModelAssociationStudioMeta';

const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
const dataSources = getDataSources();
const defaultDataSource = dataSources.find((item) => item.id === 'ds_default_local') ?? dataSources[0];

async function main(): Promise<void> {
  if (!defaultDataSource) {
    throw new Error('No data source configured');
  }

  const svc = new DataSourcesService({
    settingsPath: SETTINGS_PATH,
    edgeDbQuery: createEdgeDbQueryExecutor({ getDataSources }),
  });

  const allModels = listEdgeModels();
  const peers = allModels.map((model) => ({
    id: model.id,
    objectName: model.objectName,
    labels: model.labels,
  }));

  let missing = 0;
  let total = 0;
  const missingByObject: Array<{ objectName: string; count: number }> = [];

  for (const model of allModels.filter((item) => item.dataSourceId === defaultDataSource.id)) {
    const meta = getEdgeModelStudioMeta(model.id);
    const labelByKey = new Map(
      (meta?.associationMeta ?? []).map((entry) => [entry.relationKey, entry.displayLabel ?? '']),
    );

    const relationsResult = await svc.listObjectRelations(
      defaultDataSource.id,
      model.objectType,
      model.objectName,
    );
    const rows = buildRelationsDatasheetRows({
      objectName: model.objectName,
      physicalRelations: relationsResult.body.data.relations,
      associations: model.associations ?? [],
      peerModels: peers,
    });

    let objectMissing = 0;
    for (const row of rows) {
      total += 1;
      const key = studioKeyForRelationRow(row);
      if (!labelByKey.get(key)?.trim()) {
        missing += 1;
        objectMissing += 1;
      }
    }
    if (objectMissing > 0) {
      missingByObject.push({ objectName: model.objectName, count: objectMissing });
    }
  }

  console.log(JSON.stringify({
    dataSourceId: defaultDataSource.id,
    modelCount: allModels.filter((item) => item.dataSourceId === defaultDataSource.id).length,
    totalRelations: total,
    missingLabels: missing,
    topMissing: missingByObject.sort((a, b) => b.count - a.count).slice(0, 25),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
