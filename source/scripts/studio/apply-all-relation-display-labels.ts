/**
 * Fill missing relation display labels for every edge model in the workspace.
 *
 *   npx tsx scripts/studio/apply-all-relation-display-labels.ts
 */

import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { DataSourcesService } from '../../src/server/services/data-sources.service';
import { EdgeModelService } from '../../src/server/services/data-api/edgeModelService';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { getEdgeModelStudioMeta } from '../../src/server/services/data-api/edgeModelStudioMetaStore';
import type { EdgeModelStudioAssociationMeta } from '../../src/shared/api/contracts/data-api';
import { buildRelationsDatasheetRows } from '../../src/features/data-studio/lib/relationsDatasheetRows';
import { studioKeyForRelationRow } from '../../src/features/data-studio/lib/edgeModelAssociationStudioMeta';
import { suggestRelationDisplayLabel } from '../../src/features/data-studio/lib/suggestRelationDisplayLabel';

const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);

const createEdgeModelService = (): EdgeModelService => new EdgeModelService({
  settingsPath: SETTINGS_PATH,
  edgeDbQuery: createEdgeDbQueryExecutor({ getDataSources }),
  getDataSources,
});

const mergeAssociationMeta = (
  existing: ReadonlyArray<EdgeModelStudioAssociationMeta>,
  patches: ReadonlyArray<EdgeModelStudioAssociationMeta>,
): EdgeModelStudioAssociationMeta[] => {
  const byKey = new Map(existing.map((entry) => [entry.relationKey, { ...entry }]));
  for (const patch of patches) {
    const previous = byKey.get(patch.relationKey);
    byKey.set(patch.relationKey, { ...previous, ...patch });
  }
  return [...byKey.values()].sort((left, right) => left.relationKey.localeCompare(right.relationKey));
};

async function main(): Promise<void> {
  const edgeModelService = createEdgeModelService();
  const dataSources = getDataSources();
  const allModels = listEdgeModels();
  const peers = allModels.map((model) => ({
    id: model.id,
    objectName: model.objectName,
    labels: model.labels,
  }));

  let modelsUpdated = 0;
  let labelsAdded = 0;

  for (const dataSource of dataSources) {
    const modelsOnSource = allModels.filter((model) => model.dataSourceId === dataSource.id);
    if (modelsOnSource.length === 0) {
      continue;
    }

    const svc = new DataSourcesService({
      settingsPath: SETTINGS_PATH,
      edgeDbQuery: createEdgeDbQueryExecutor({ getDataSources }),
    });

    for (const model of modelsOnSource) {
      const relationsResult = await svc.listObjectRelations(
        dataSource.id,
        model.objectType,
        model.objectName,
      );
      const rows = buildRelationsDatasheetRows({
        objectName: model.objectName,
        physicalRelations: relationsResult.body.data.relations,
        associations: model.associations ?? [],
        peerModels: peers,
      });

      const previousMeta = getEdgeModelStudioMeta(model.id);
      const existing = previousMeta?.associationMeta ?? [];
      const labelByKey = new Map(
        existing.map((entry) => [entry.relationKey, entry.displayLabel?.trim() ?? '']),
      );

      const patches: EdgeModelStudioAssociationMeta[] = [];
      for (const row of rows) {
        const relationKey = studioKeyForRelationRow(row);
        if (labelByKey.get(relationKey)) {
          continue;
        }
        const displayLabel = suggestRelationDisplayLabel({
          focusObjectName: model.objectName,
          row,
          peerModels: peers,
        }).trim();
        if (!displayLabel) {
          continue;
        }
        patches.push({ relationKey, displayLabel });
        labelsAdded += 1;
      }

      if (patches.length === 0) {
        continue;
      }

      edgeModelService.upsertStudioMeta(model.id, {
        associationMeta: mergeAssociationMeta(existing, patches),
      });
      modelsUpdated += 1;
      console.log(`  ${model.objectName}: +${patches.length} label(s)`);
    }
  }

  console.log(`Done. ${labelsAdded} label(s) on ${modelsUpdated} model(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
