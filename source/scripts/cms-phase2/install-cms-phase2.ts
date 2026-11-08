/**
 * CMS domain — Phase 2 (custom DATA_API Server Functions on Edge Sequelize).
 *
 * Opt-in only. Creates/publishes Edge API definitions so managed functions appear
 * under Studio → Server Functions as custom (engineType DATA_API, not built-in).
 * No Express mountCmsRoutes · no db.query · not part of bootstrap.
 *
 * Usage:
 *   npm run cms:phase2
 *   npm run cms:phase2:rollback
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { DataApiExecutor } from '../../src/server/services/data-api/dataApiExecutor';
import { EdgeApiService } from '../../src/server/services/data-api/edgeApiService';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { listEdgeApiDefinitions } from '../../src/server/services/data-api/edgeApiStore';
import { CMS_TABLE_NAMES } from '../cms-phase1';
import {
  patchCmsAssetsOperation,
  patchCmsContentsOperation,
  patchCmsRelationsOperation,
  patchCmsTagsOperation,
} from './cmsApiProjection';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(scriptDir, 'state.json');
const isRollback = process.argv.includes('--rollback');

const CMS_API_SPECS = [
  {
    objectName: 'cms_contents',
    key: 'cms-contents',
    label: 'CMS Contents',
    basePath: '/api/cms/contents',
    // Public-facing reads (list/getOne) benefit from response caching; writes
    // ignore cacheEnabled at the executor layer (GET-only gate), so this is safe.
    publicCache: true,
  },
  {
    objectName: 'cms_content_revisions',
    key: 'cms-revisions',
    label: 'CMS Content Revisions',
    basePath: '/api/cms/revisions',
    publicCache: false,
  },
  {
    objectName: 'cms_content_assets',
    key: 'cms-assets',
    label: 'CMS Content Assets',
    basePath: '/api/cms/assets',
    publicCache: false,
  },
  {
    objectName: 'cms_content_tags',
    key: 'cms-tags',
    label: 'CMS Content Tags',
    basePath: '/api/cms/tags',
    publicCache: false,
  },
  {
    objectName: 'cms_content_relations',
    key: 'cms-relations',
    label: 'CMS Content Relations',
    basePath: '/api/cms/relations',
    publicCache: false,
  },
  {
    objectName: 'cms_settings',
    key: 'cms-settings',
    label: 'CMS Settings',
    basePath: '/api/cms/settings',
    publicCache: false,
  },
] as const;

// Matches cms_settings.public_cache_ttl_seconds default (seeded in Phase 1).
const PUBLIC_CACHE_TTL_MS = 300_000;

type Phase2State = {
  schema: 'cms-phase2-state';
  definitionIds: string[];
  keys: string[];
  updatedAt: string;
};

const readState = (): Phase2State | null => {
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as Phase2State;
  } catch {
    return null;
  }
};

const writeState = (state: Phase2State): void => {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

const createApiService = (): EdgeApiService => {
  const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
  return new EdgeApiService(new DataApiExecutor({ getDataSources }));
};

const resolveDefaultDataSource = () => {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('CMS Phase 2 requires a default data source.');
  }
  if (source.type !== 'PostgreSQL' && source.type !== 'SQL Server') {
    throw new Error(`CMS Phase 2 requires PostgreSQL or SQL Server (got ${source.type}).`);
  }
  return source;
};

const findCmsModelId = (dataSourceId: string, objectName: string): string => {
  const model = listEdgeModels().find(
    (item) => item.dataSourceId === dataSourceId && item.objectName === objectName,
  );
  if (!model) {
    throw new Error(
      `CMS edge model missing for ${objectName}. Run npm run cms:phase1 first.`,
    );
  }
  return model.id;
};

const deleteCmsDefinitions = (api: EdgeApiService, ids: string[]): number => {
  let removed = 0;
  for (const id of ids) {
    const existing = api.getDefinition(id);
    if (!existing) continue;
    try {
      if (existing.publishedAt) {
        api.unpublish(id);
      }
    } catch (error) {
      console.warn(`  warn: unpublish ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    api.delete(id);
    removed += 1;
    console.log(`  deleted definition ${existing.key} (${id})`);
  }
  return removed;
};

const install = (): void => {
  const source = resolveDefaultDataSource();
  const dataSourceId = source.id;
  const api = createApiService();

  // Idempotent: remove prior CMS phase-2 definitions (by key or saved state).
  const prior = readState();
  const priorIds = new Set(prior?.definitionIds ?? []);
  for (const def of listEdgeApiDefinitions()) {
    if (priorIds.has(def.id) || CMS_API_SPECS.some((spec) => spec.key === def.key)) {
      priorIds.add(def.id);
    }
  }
  if (priorIds.size > 0) {
    console.log('[CMS Phase 2] Cleaning previous CMS API definitions…');
    deleteCmsDefinitions(api, [...priorIds]);
  }

  // Ensure phase-1 models exist.
  for (const objectName of CMS_TABLE_NAMES) {
    findCmsModelId(dataSourceId, objectName);
  }

  console.log('[CMS Phase 2] Creating + publishing DATA_API definitions…');
  const contentsModelId = findCmsModelId(dataSourceId, 'cms_contents');
  const usersModelId = findCmsModelId(dataSourceId, 'base_users');
  const definitionIds: string[] = [];
  const keys: string[] = [];

  for (const spec of CMS_API_SPECS) {
    const edgeModelId = findCmsModelId(dataSourceId, spec.objectName);
    const draft = api.createDefinition({
      edgeModelId,
      key: spec.key,
      label: spec.label,
      basePath: spec.basePath,
    });
    if (spec.publicCache) {
      api.updateDefinition(draft.id, {
        runtime: {
          useGlobalConfig: true,
          cacheEnabled: true,
          cacheTtlMs: PUBLIC_CACHE_TTL_MS,
          cacheByParam: true,
          cacheByUser: false,
        },
      });
    }

    if (spec.key === 'cms-contents') {
      const current = api.getDefinition(draft.id);
      if (current) {
        api.updateDefinition(draft.id, {
          operations: current.operations.map(
            (operation) => patchCmsContentsOperation(operation, usersModelId),
          ),
        });
      }
    }

    if (spec.key === 'cms-assets') {
      const current = api.getDefinition(draft.id);
      if (current) {
        api.updateDefinition(draft.id, {
          operations: current.operations.map(patchCmsAssetsOperation),
        });
      }
    }

    if (spec.key === 'cms-relations') {
      const current = api.getDefinition(draft.id);
      if (current) {
        api.updateDefinition(draft.id, {
          operations: current.operations.map((operation) => patchCmsRelationsOperation(operation, contentsModelId)),
        });
      }
    }

    if (spec.key === 'cms-tags') {
      const current = api.getDefinition(draft.id);
      if (current) {
        api.updateDefinition(draft.id, {
          operations: current.operations.map((operation) => patchCmsTagsOperation(operation)),
        });
      }
    }

    const published = api.publish(draft.id);
    definitionIds.push(published.id);
    keys.push(published.key);
    const ops = published.operations.filter((op) => op.enabled).map((op) => op.kind).join(', ');
    const cacheNote = spec.publicCache ? ` [cache ${PUBLIC_CACHE_TTL_MS / 1000}s on GET ops]` : '';
    console.log(`  published ${published.key} → ${published.basePath} [${ops}]${cacheNote}`);
  }

  writeState({
    schema: 'cms-phase2-state',
    definitionIds,
    keys,
    updatedAt: new Date().toISOString(),
  });

  console.log('[CMS Phase 2] Done.');
  console.log('  Managed functions are custom DATA_API (Sequelize) — visible in Server Functions Studio.');
  console.log('  Domain flows (publish / revision snapshot / tag sync) compose these endpoints.');
};

const rollback = (): void => {
  const api = createApiService();
  const state = readState();
  const ids = new Set(state?.definitionIds ?? []);
  for (const def of listEdgeApiDefinitions()) {
    if (CMS_API_SPECS.some((spec) => spec.key === def.key)) {
      ids.add(def.id);
    }
  }

  console.log('[CMS Phase 2 rollback] Removing CMS DATA_API definitions…');
  const removed = deleteCmsDefinitions(api, [...ids]);
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
  console.log(`[CMS Phase 2 rollback] Done. removed=${removed}`);
};

const main = (): void => {
  if (isRollback) {
    rollback();
    return;
  }
  install();
};

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[CMS Phase 2] failed: ${message}`);
  process.exitCode = 1;
}
