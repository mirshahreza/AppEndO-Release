/**
 * Re-publish CMS DATA_API definitions with canonical (PostgreSQL) computed fields.
 * Query-time compilation in DataApiExecutor maps them to the live data-source dialect.
 *
 * Usage:
 *   npx tsx scripts/cms-phase2/patch-cms-sqlserver-api.ts
 */

import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { DataApiExecutor } from '../../src/server/services/data-api/dataApiExecutor';
import { EdgeApiService } from '../../src/server/services/data-api/edgeApiService';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { listEdgeApiDefinitions } from '../../src/server/services/data-api/edgeApiStore';
import {
  patchCmsAssetsOperation,
  patchCmsContentsOperation,
  patchCmsRelationsOperation,
  patchCmsTagsOperation,
} from './cmsApiProjection';

const CMS_KEYS = [
  'cms-contents',
  'cms-revisions',
  'cms-assets',
  'cms-tags',
  'cms-relations',
  'cms-settings',
] as const;

const createApiService = (): EdgeApiService => {
  const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
  return new EdgeApiService(new DataApiExecutor({ getDataSources }));
};

const findModelId = (dataSourceId: string, objectName: string): string => {
  const model = listEdgeModels().find(
    (item) => item.dataSourceId === dataSourceId && item.objectName === objectName,
  );
  if (!model) {
    throw new Error(`Edge model missing: ${objectName}`);
  }
  return model.id;
};

const main = (): void => {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('No default data source configured.');
  }

  const dialectLabel = source.type;
  const api = createApiService();
  const contentsModelId = findModelId(source.id, 'cms_contents');
  const usersModelId = findModelId(source.id, 'base_users');

  console.log(`[CMS API patch] data source=${dialectLabel} (computed SQL stored as postgres)`);

  for (const key of CMS_KEYS) {
    const definition = listEdgeApiDefinitions().find((item) => item.key === key);
    if (!definition) {
      console.log(`  skip ${key}: definition missing`);
      continue;
    }

    const operations = definition.operations.map((operation) => {
      if (key === 'cms-contents') {
        return patchCmsContentsOperation(operation, usersModelId);
      }
      if (key === 'cms-assets') {
        return patchCmsAssetsOperation(operation);
      }
      if (key === 'cms-relations') {
        return patchCmsRelationsOperation(operation, contentsModelId);
      }
      if (key === 'cms-tags') {
        return patchCmsTagsOperation(operation);
      }
      return operation;
    });

    api.updateDefinition(definition.id, { operations });
    if (definition.publishedAt) {
      api.unpublish(definition.id);
    }
    const published = api.publish(definition.id);
    console.log(`  republished ${published.key} (${published.id})`);
  }

  console.log('[CMS API patch] Done. Refresh CMS / Contents in Studio.');
};

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[CMS API patch] failed: ${message}`);
  process.exitCode = 1;
}
