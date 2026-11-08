/**
 * CMS domain — Phase 1 (schema + Base Info + edge associations + studio-meta).
 *
 * Opt-in only. Does NOT run during app bootstrap / controlPlaneSeed.
 * Not a Package Manager zip install. Runtime data access (Phase 2+) uses Sequelize Edge models.
 *
 * Usage:
 *   npm run cms:phase1
 *   npm run cms:phase1:rollback
 */

import crypto from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { createEdgeDbQueryExecutor } from '../../src/core/database/EdgeDbRouter';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { EdgeModelService } from '../../src/server/services/data-api/edgeModelService';
import {
  getEdgeModelById,
  listEdgeModels,
} from '../../src/server/services/data-api/edgeModelStore';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../src/shared/api/contracts/data-api';
import {
  CMS_TABLE_NAMES,
  seedCmsBaseInfo,
  seedCmsStudioMeta,
  unseedCmsBaseInfo,
} from './index';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const installSqlPath = path.join(scriptDir, 'db', 'install', 'cms_schema.sql');
const uninstallSqlPath = path.join(scriptDir, 'db', 'uninstall', 'cms_schema.sql');

const isRollback = process.argv.includes('--rollback');
const CMS_TABLE_NAME_SET = new Set<string>(CMS_TABLE_NAMES);

const resolveDefaultPostgresSource = () => {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.isDefault) ?? sources[0];

  if (!source || source.type !== 'PostgreSQL') {
    throw new Error('CMS Phase 1 requires a default PostgreSQL data source.');
  }

  return source;
};

const runSqlFile = async (sqlPath: string): Promise<void> => {
  const source = resolveDefaultPostgresSource();
  const sql = readFileSync(sqlPath, 'utf8');
  const pool = new Pool({
    host: source.host || 'localhost',
    port: Number(source.port) || 5432,
    user: source.username || 'postgres',
    password: source.password || '',
    database: source.database || 'AppEnd',
  });

  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
};

const associationId = () => `ea_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

const requireModel = (
  modelsByName: Map<string, EdgeModelDefinition>,
  objectName: string,
): EdgeModelDefinition => {
  const model = modelsByName.get(objectName);
  if (!model) {
    throw new Error(`Required edge model missing: ${objectName}`);
  }
  return model;
};

const findControlPlaneModel = (
  dataSourceId: string,
  objectName: string,
): EdgeModelDefinition => {
  const model = listEdgeModels().find(
    (item) => item.dataSourceId === dataSourceId && item.objectName === objectName,
  );
  if (!model) {
    throw new Error(
      `CMS Phase 1 requires edge model "${objectName}" on the default data source. Import it in Data Studio first.`,
    );
  }
  return model;
};

const belongsTo = (
  targetModelId: string,
  foreignKey: string,
  as: string,
): EdgeModelAssociation => ({
  id: associationId(),
  kind: 'belongsTo',
  targetModelId,
  foreignKey,
  as,
  source: 'manual',
});

const hasMany = (
  targetModelId: string,
  foreignKey: string,
  as: string,
): EdgeModelAssociation => ({
  id: associationId(),
  kind: 'hasMany',
  targetModelId,
  foreignKey,
  as,
  source: 'manual',
});

const wireCmsAssociations = async (
  edgeModelService: EdgeModelService,
  modelsByName: Map<string, EdgeModelDefinition>,
  dataSourceId: string,
): Promise<Map<string, EdgeModelDefinition>> => {
  const contents = requireModel(modelsByName, 'cms_contents');
  const revisions = requireModel(modelsByName, 'cms_content_revisions');
  const assets = requireModel(modelsByName, 'cms_content_assets');
  const tags = requireModel(modelsByName, 'cms_content_tags');
  const relations = requireModel(modelsByName, 'cms_content_relations');
  const settings = requireModel(modelsByName, 'cms_settings');
  const baseInfo = findControlPlaneModel(dataSourceId, 'base_info');
  const baseUsers = findControlPlaneModel(dataSourceId, 'base_users');

  const contentsAssociations: EdgeModelAssociation[] = [
    hasMany(revisions.id, 'content_id', 'revisions'),
    hasMany(assets.id, 'content_id', 'assets'),
    hasMany(tags.id, 'content_id', 'tags'),
    hasMany(contents.id, 'parent_content_id', 'childContents'),
    belongsTo(contents.id, 'parent_content_id', 'parentContent'),
    // Undirected self-M2M: ONE belongsToMany only (a < b is storage order, not two directions).
    {
      id: associationId(),
      kind: 'belongsToMany',
      targetModelId: contents.id,
      throughModelId: relations.id,
      foreignKey: 'content_id_a',
      otherKey: 'content_id_b',
      as: 'relatedContents',
      source: 'manual',
    },
    belongsTo(baseInfo.id, 'content_type_code', 'content_type'),
    belongsTo(baseInfo.id, 'language_code', 'language'),
    belongsTo(baseInfo.id, 'status_code', 'status'),
    belongsTo(baseInfo.id, 'body_format_code', 'body_format'),
    belongsTo(baseInfo.id, 'comments_policy_code', 'comments_policy'),
    belongsTo(baseInfo.id, 'comments_body_format_code', 'comments_body_format'),
    belongsTo(baseUsers.id, 'status_code_updated_by', 'statusUpdatedBy'),
    belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
    belongsTo(baseUsers.id, 'updated_by', 'updatedByUser'),
    belongsTo(baseUsers.id, 'moderated_by', 'moderatedByUser'),
  ];

  await edgeModelService.updateModel(contents.id, {
    associations: contentsAssociations,
    labels: { title: 'CMS Contents', icon: 'lucide:newspaper', color: 'text-sky-600' },
  });

  await edgeModelService.updateModel(revisions.id, {
    associations: [
      belongsTo(contents.id, 'content_id', 'content'),
      belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
    ],
    labels: { title: 'CMS Content Revisions', icon: 'lucide:history', color: 'text-amber-600' },
  });

  await edgeModelService.updateModel(assets.id, {
    associations: [
      belongsTo(contents.id, 'content_id', 'content'),
      belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
      belongsTo(baseUsers.id, 'updated_by', 'updatedByUser'),
    ],
    labels: { title: 'CMS Content Assets', icon: 'lucide:paperclip', color: 'text-violet-600' },
  });

  await edgeModelService.updateModel(tags.id, {
    associations: [
      belongsTo(contents.id, 'content_id', 'content'),
      belongsTo(baseInfo.id, 'tag_code', 'tag'),
    ],
    labels: { title: 'CMS Content Tags', icon: 'lucide:tags', color: 'text-emerald-700' },
  });

  await edgeModelService.updateModel(relations.id, {
    associations: [
      belongsTo(contents.id, 'content_id_a', 'contentA'),
      belongsTo(contents.id, 'content_id_b', 'contentB'),
    ],
    labels: { title: 'CMS Content Relations', icon: 'lucide:git-branch', color: 'text-rose-600' },
  });

  await edgeModelService.updateModel(settings.id, {
    associations: [
      belongsTo(baseInfo.id, 'comments_policy_code', 'comments_policy'),
      belongsTo(baseInfo.id, 'comments_body_format_code', 'comments_body_format'),
      belongsTo(baseUsers.id, 'updated_by', 'updatedByUser'),
    ],
    labels: { title: 'CMS Settings', icon: 'lucide:settings', color: 'text-slate-600' },
  });

  const refreshed = new Map<string, EdgeModelDefinition>();
  for (const objectName of CMS_TABLE_NAMES) {
    const previous = modelsByName.get(objectName);
    if (!previous) continue;
    const next = getEdgeModelById(previous.id);
    if (!next) {
      throw new Error(`Edge model disappeared after wiring: ${objectName}`);
    }
    refreshed.set(objectName, next);
  }
  return refreshed;
};

const createEdgeModelService = (): EdgeModelService => {
  const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
  return new EdgeModelService({
    settingsPath: SETTINGS_PATH,
    edgeDbQuery: createEdgeDbQueryExecutor({ getDataSources }),
    getDataSources,
  });
};

/**
 * Auto-import only classifies columns into string/number/integer/boolean —
 * `timestamp with time zone` lands as sequelizeType STRING. Patch it to DATE
 * explicitly so Data API / Sequelize reads it as a real Date, not text.
 */
const patchTimestampColumns = async (
  edgeModelService: EdgeModelService,
  model: EdgeModelDefinition,
): Promise<EdgeModelDefinition> => {
  const needsPatch = model.columns.some(
    (column) => column.dataType.startsWith('timestamp') && column.sequelizeType !== 'DATE',
  );
  if (!needsPatch) return model;

  const columns = model.columns.map((column) => (
    column.dataType.startsWith('timestamp') && column.sequelizeType !== 'DATE'
      ? { ...column, sequelizeType: 'DATE' as const }
      : column
  ));
  return edgeModelService.updateModel(model.id, { columns });
};

const patchBinaryColumns = async (
  edgeModelService: EdgeModelService,
  model: EdgeModelDefinition,
): Promise<EdgeModelDefinition> => {
  const columns = model.columns.map((column) => (
    ['bytea', 'blob', 'binary', 'varbinary'].some(
      (binaryType) => column.dataType.toLowerCase().includes(binaryType),
    ) && column.sequelizeType !== 'BLOB'
      ? { ...column, sequelizeType: 'BLOB' as const }
      : column
  ));
  const changed = columns.some(
    (column, index) => column.sequelizeType !== model.columns[index]?.sequelizeType,
  );
  return changed ? edgeModelService.updateModel(model.id, { columns }) : model;
};

const importCmsEdgeModels = async (): Promise<{
  edgeModelService: EdgeModelService;
  modelsByName: Map<string, EdgeModelDefinition>;
}> => {
  const dataSource = resolveDefaultPostgresSource();
  const edgeModelService = createEdgeModelService();
  const byName = new Map<string, EdgeModelDefinition>();

  for (const objectName of CMS_TABLE_NAMES) {
    const existingModels = listEdgeModels()
      .filter((model) => model.dataSourceId === dataSource.id && model.objectName === objectName)
      .sort((a, b) => b.columns.length - a.columns.length);

    const [primary, ...duplicates] = existingModels;
    for (const duplicate of duplicates) {
      edgeModelService.deleteModel(duplicate.id);
      console.log(`  edge model duplicate removed: ${objectName} (${duplicate.id})`);
    }

    const imported = primary
      ? await edgeModelService.refreshModel(primary.id)
      : await edgeModelService.importModel({
        dataSourceId: dataSource.id,
        objectName,
        objectType: 'TABLE',
      });
    const timestampPatched = await patchTimestampColumns(edgeModelService, imported);
    const model = await patchBinaryColumns(edgeModelService, timestampPatched);

    byName.set(objectName, model);
    console.log(`  edge model ${primary ? 'refreshed' : 'imported'}: ${objectName} (${model.id})`);
  }

  const wired = await wireCmsAssociations(edgeModelService, byName, dataSource.id);
  console.log('  edge model associations wired (domain + base_info + base_users)');
  return { edgeModelService, modelsByName: wired };
};

const removeCmsEdgeModels = (): number => {
  const dataSource = resolveDefaultPostgresSource();
  const edgeModelService = createEdgeModelService();

  let removed = 0;
  for (const model of listEdgeModels()) {
    if (model.dataSourceId === dataSource.id && CMS_TABLE_NAME_SET.has(model.objectName)) {
      edgeModelService.deleteModel(model.id);
      removed += 1;
      console.log(`  edge model removed: ${model.objectName}`);
    }
  }
  return removed;
};

const findCategoryItemId = async (
  categoryId: string,
  shortName: string,
): Promise<string> => {
  const item = await prisma().baseInfo.findFirst({
    where: { parentId: categoryId, shortName },
    select: { id: true },
  });
  if (!item) {
    throw new Error(`CMS Phase 1: Base Info item "${shortName}" missing under category ${categoryId}.`);
  }
  return item.id;
};

/** Idempotent singleton row (id=1) seed for cms_settings, defaults per the CMS package plan. */
const seedCmsSettingsRow = async (
  seedResult: { categories: Array<{ title: string; id: string }> },
): Promise<void> => {
  const categoryIdByTitle = new Map(seedResult.categories.map((category) => [category.title, category.id]));
  const policiesCategoryId = categoryIdByTitle.get('Comment Policies');
  // Comment body format reuses the content "Body Formats" category — no separate category.
  const bodyFormatsCategoryId = categoryIdByTitle.get('Body Formats');
  if (!policiesCategoryId || !bodyFormatsCategoryId) {
    throw new Error('CMS Phase 1: Comment Policies / Body Formats categories missing from seed result.');
  }

  const autoPolicyId = await findCategoryItemId(policiesCategoryId, 'auto');
  const plainFormatId = await findCategoryItemId(bodyFormatsCategoryId, 'plain');

  const source = resolveDefaultPostgresSource();
  const pool = new Pool({
    host: source.host || 'localhost',
    port: Number(source.port) || 5432,
    user: source.username || 'postgres',
    password: source.password || '',
    database: source.database || 'AppEnd',
  });
  try {
    await pool.query(
      `INSERT INTO cms_settings (id, comments_enabled, comments_policy_code, comments_body_format_code, public_cache_ttl_seconds)
       VALUES (1, true, $1, $2, 300)
       ON CONFLICT (id) DO NOTHING`,
      [autoPolicyId, plainFormatId],
    );
  } finally {
    await pool.end();
  }
};

const verifyTables = async (): Promise<string[]> => {
  const source = resolveDefaultPostgresSource();
  const pool = new Pool({
    host: source.host || 'localhost',
    port: Number(source.port) || 5432,
    user: source.username || 'postgres',
    password: source.password || '',
    database: source.database || 'AppEnd',
  });

  try {
    const result = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `, [CMS_TABLE_NAMES as unknown as string[]]);
    return result.rows.map((row) => row.table_name);
  } finally {
    await pool.end();
  }
};

const install = async (): Promise<void> => {
  console.log('[CMS Phase 1] Applying schema…');
  await runSqlFile(installSqlPath);

  console.log('[CMS Phase 1] Seeding Base Info LOVs…');
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const seedResult = await seedCmsBaseInfo(null);
  console.log(`  root CMS id=${seedResult.rootId}`);
  for (const category of seedResult.categories) {
    console.log(`  category "${category.title}" id=${category.id} items=${category.itemCount}`);
  }

  console.log('[CMS Phase 1] Seeding cms_settings singleton row…');
  await seedCmsSettingsRow(seedResult);

  console.log('[CMS Phase 1] Seeding AppEndO public-site guide, tags, and screenshots…');
  const { seedCmsSampleSite } = await import('./seed/seedCmsSampleSite');
  const sample = await seedCmsSampleSite(seedResult);
  console.log(
    `  contents upserted: ${sample.contentsUpserted}; assets: ${sample.assetsUpserted}; tags: ${sample.tagsLinked}; obsolete removed: ${sample.obsoleteRemoved}`,
  );

  console.log('[CMS Phase 1] Importing edge models + associations…');
  const { edgeModelService, modelsByName } = await importCmsEdgeModels();

  console.log('[CMS Phase 1] Seeding studio-meta…');
  const studioMeta = seedCmsStudioMeta(edgeModelService, modelsByName, seedResult);
  for (const model of studioMeta.models) {
    console.log(
      `  studio-meta ${model.objectName}: groups=${model.groupCount} columns=${model.columnMetaCount} relations=${model.associationMetaCount}`,
    );
  }

  const tables = await verifyTables();
  console.log('[CMS Phase 1] Done.');
  console.log(`  tables: ${tables.join(', ') || '(none)'}`);
  console.log('  Note: CMS is opt-in; fresh apps without this script have no CMS footprint.');
};

const rollback = async (): Promise<void> => {
  console.log('[CMS Phase 1 rollback] Removing edge models (+ studio-meta)…');
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  removeCmsEdgeModels();

  console.log('[CMS Phase 1 rollback] Dropping tables…');
  await runSqlFile(uninstallSqlPath);

  console.log('[CMS Phase 1 rollback] Removing Base Info CMS tree…');
  const { deletedRootId } = await unseedCmsBaseInfo();
  console.log(`  deleted root: ${deletedRootId ?? '(already absent)'}`);

  const tables = await verifyTables();
  console.log('[CMS Phase 1 rollback] Done.');
  console.log(`  remaining cms_* tables: ${tables.join(', ') || '(none)'}`);
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
    console.error(`[CMS Phase 1] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
