/**
 * CRM domain — Phase 1 (schema + Base Info + edge associations + studio-meta).
 * v2: customer = base_users + base_user_profiles + `crm_customers` extension
 * (v1 `crm_parties` design was rolled back — see plans/packages/todo/crm-package/p-packages-crm.md).
 *
 * Opt-in only. Does NOT run during app bootstrap / controlPlaneSeed.
 * Not a Package Manager zip install. Runtime data access (Phase 2+) uses Sequelize Edge models.
 *
 * Usage:
 *   npm run crm:phase1
 *   npm run crm:phase1:rollback
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
import { EdgeModelService } from '../../src/server/services/data-api/edgeModelService';
import {
  getEdgeModelById,
  listEdgeModels,
} from '../../src/server/services/data-api/edgeModelStore';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../src/shared/api/contracts/data-api';
import {
  CRM_TABLE_NAMES,
  seedCrmBaseInfo,
  seedCrmStudioMeta,
  unseedCrmBaseInfo,
} from './index';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const installSqlPath = path.join(scriptDir, 'db', 'install', 'crm_schema.sql');
const uninstallSqlPath = path.join(scriptDir, 'db', 'uninstall', 'crm_schema.sql');

const isRollback = process.argv.includes('--rollback');
const CRM_TABLE_NAME_SET = new Set<string>(CRM_TABLE_NAMES);

const resolveDefaultPostgresSource = () => {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.isDefault) ?? sources[0];

  if (!source || source.type !== 'PostgreSQL') {
    throw new Error('CRM Phase 1 requires a default PostgreSQL data source.');
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

/**
 * Platform control-plane tables (`base_users`, `base_info`) may not have an
 * Edge model imported into this workspace yet even though the physical table
 * exists — auto-import on demand instead of requiring a manual Studio step.
 */
const requireOrImportControlPlaneModel = async (
  edgeModelService: EdgeModelService,
  dataSourceId: string,
  objectName: string,
): Promise<EdgeModelDefinition> => {
  const existing = listEdgeModels().find(
    (item) => item.dataSourceId === dataSourceId && item.objectName === objectName,
  );
  if (existing) {
    return existing;
  }
  const imported = await edgeModelService.importModel({
    dataSourceId,
    objectName,
    objectType: 'TABLE',
  });
  console.log(`  edge model imported (control plane): ${objectName} (${imported.id})`);
  return imported;
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

const wireCrmAssociations = async (
  edgeModelService: EdgeModelService,
  modelsByName: Map<string, EdgeModelDefinition>,
  dataSourceId: string,
): Promise<Map<string, EdgeModelDefinition>> => {
  const customers = requireModel(modelsByName, 'crm_customers');
  const customerTags = requireModel(modelsByName, 'crm_customer_tags');
  const opportunities = requireModel(modelsByName, 'crm_opportunities');
  const stageHistory = requireModel(modelsByName, 'crm_opportunity_stage_history');
  const activities = requireModel(modelsByName, 'crm_activities');
  const tickets = requireModel(modelsByName, 'crm_tickets');
  const messages = requireModel(modelsByName, 'crm_ticket_messages');
  const baseInfo = await requireOrImportControlPlaneModel(edgeModelService, dataSourceId, 'base_info');
  const baseUsers = await requireOrImportControlPlaneModel(edgeModelService, dataSourceId, 'base_users');
  const baseUserProfiles = await requireOrImportControlPlaneModel(edgeModelService, dataSourceId, 'base_user_profiles');

  await edgeModelService.updateModel(customers.id, {
    associations: [
      belongsTo(baseUsers.id, 'user_id', 'user'),
      belongsTo(baseUserProfiles.id, 'user_id', 'profile'),
      belongsTo(baseInfo.id, 'lifecycle_stage_code', 'lifecycle_stage'),
      belongsTo(baseInfo.id, 'source_code', 'source'),
      belongsTo(baseUsers.id, 'owner_id', 'owner'),
      belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
      belongsTo(baseUsers.id, 'updated_by', 'updatedByUser'),
      hasMany(customerTags.id, 'user_id', 'tags'),
    ],
    labels: { title: 'CRM Customers', icon: 'lucide:contact', color: 'text-sky-600' },
  });

  await edgeModelService.updateModel(customerTags.id, {
    associations: [
      belongsTo(baseUsers.id, 'user_id', 'customer'),
      belongsTo(baseInfo.id, 'tag_code', 'tag'),
    ],
    labels: { title: 'CRM Customer Tags', icon: 'lucide:tags', color: 'text-emerald-600' },
  });

  await edgeModelService.updateModel(opportunities.id, {
    associations: [
      belongsTo(baseUsers.id, 'customer_user_id', 'customer'),
      belongsTo(baseUserProfiles.id, 'customer_user_id', 'customerProfile'),
      belongsTo(baseInfo.id, 'stage_code', 'stage'),
      belongsTo(baseUsers.id, 'owner_id', 'owner'),
      belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
      belongsTo(baseUsers.id, 'updated_by', 'updatedByUser'),
      hasMany(stageHistory.id, 'opportunity_id', 'stageHistory'),
      hasMany(activities.id, 'opportunity_id', 'activities'),
    ],
    labels: { title: 'CRM Opportunities', icon: 'lucide:target', color: 'text-indigo-600' },
  });

  await edgeModelService.updateModel(stageHistory.id, {
    associations: [
      belongsTo(opportunities.id, 'opportunity_id', 'opportunity'),
      belongsTo(baseInfo.id, 'from_stage_code', 'fromStage'),
      belongsTo(baseInfo.id, 'to_stage_code', 'toStage'),
      belongsTo(baseUsers.id, 'changed_by', 'changedByUser'),
    ],
    labels: {
      title: 'CRM Opportunity Stage History',
      icon: 'lucide:history',
      color: 'text-amber-600',
    },
  });

  await edgeModelService.updateModel(activities.id, {
    associations: [
      belongsTo(baseUsers.id, 'customer_user_id', 'customer'),
      belongsTo(baseUserProfiles.id, 'customer_user_id', 'customerProfile'),
      belongsTo(opportunities.id, 'opportunity_id', 'opportunity'),
      belongsTo(baseInfo.id, 'activity_type_code', 'activity_type'),
      belongsTo(baseUsers.id, 'owner_id', 'owner'),
      belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
      belongsTo(baseUsers.id, 'updated_by', 'updatedByUser'),
    ],
    labels: { title: 'CRM Activities', icon: 'lucide:activity', color: 'text-violet-600' },
  });

  await edgeModelService.updateModel(tickets.id, {
    associations: [
      belongsTo(baseUsers.id, 'customer_user_id', 'customer'),
      belongsTo(baseUserProfiles.id, 'customer_user_id', 'customerProfile'),
      belongsTo(baseInfo.id, 'status_code', 'status'),
      belongsTo(baseInfo.id, 'priority_code', 'priority'),
      belongsTo(baseInfo.id, 'channel_code', 'channel'),
      belongsTo(baseUsers.id, 'assigned_to', 'assignedToUser'),
      belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
      belongsTo(baseUsers.id, 'updated_by', 'updatedByUser'),
      hasMany(messages.id, 'ticket_id', 'messages'),
    ],
    labels: { title: 'CRM Tickets', icon: 'lucide:life-buoy', color: 'text-rose-600' },
  });

  await edgeModelService.updateModel(messages.id, {
    associations: [
      belongsTo(tickets.id, 'ticket_id', 'ticket'),
      belongsTo(baseUsers.id, 'author_id', 'author'),
    ],
    labels: {
      title: 'CRM Ticket Messages',
      icon: 'lucide:message-square',
      color: 'text-orange-600',
    },
  });

  const refreshed = new Map<string, EdgeModelDefinition>();
  for (const objectName of CRM_TABLE_NAMES) {
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
    (column) => (
      (column.dataType.startsWith('timestamp') || column.dataType === 'date')
      && column.sequelizeType !== 'DATE'
    ),
  );
  if (!needsPatch) return model;

  const columns = model.columns.map((column) => (
    (column.dataType.startsWith('timestamp') || column.dataType === 'date')
    && column.sequelizeType !== 'DATE'
      ? { ...column, sequelizeType: 'DATE' as const }
      : column
  ));
  return edgeModelService.updateModel(model.id, { columns });
};

const importCrmEdgeModels = async (): Promise<{
  edgeModelService: EdgeModelService;
  modelsByName: Map<string, EdgeModelDefinition>;
}> => {
  const dataSource = resolveDefaultPostgresSource();
  const edgeModelService = createEdgeModelService();
  const byName = new Map<string, EdgeModelDefinition>();

  for (const objectName of CRM_TABLE_NAMES) {
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
    const model = await patchTimestampColumns(edgeModelService, imported);

    byName.set(objectName, model);
    console.log(`  edge model ${primary ? 'refreshed' : 'imported'}: ${objectName} (${model.id})`);
  }

  const wired = await wireCrmAssociations(edgeModelService, byName, dataSource.id);
  console.log('  edge model associations wired (domain + base_info + base_users + base_user_profiles)');
  return { edgeModelService, modelsByName: wired };
};

const removeCrmEdgeModels = (): number => {
  const dataSource = resolveDefaultPostgresSource();
  const edgeModelService = createEdgeModelService();

  let removed = 0;
  for (const model of listEdgeModels()) {
    if (model.dataSourceId === dataSource.id && CRM_TABLE_NAME_SET.has(model.objectName)) {
      edgeModelService.deleteModel(model.id);
      removed += 1;
      console.log(`  edge model removed: ${model.objectName}`);
    }
  }
  return removed;
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
    `, [CRM_TABLE_NAMES as unknown as string[]]);
    return result.rows.map((row) => row.table_name);
  } finally {
    await pool.end();
  }
};

const install = async (): Promise<void> => {
  console.log('[CRM Phase 1] Applying schema…');
  await runSqlFile(installSqlPath);

  console.log('[CRM Phase 1] Seeding Base Info LOVs…');
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const seedResult = await seedCrmBaseInfo(null);
  console.log(`  root CRM id=${seedResult.rootId}`);
  for (const category of seedResult.categories) {
    console.log(`  category "${category.title}" id=${category.id} items=${category.itemCount}`);
  }

  console.log('[CRM Phase 1] Importing edge models + associations…');
  const { edgeModelService, modelsByName } = await importCrmEdgeModels();

  console.log('[CRM Phase 1] Seeding studio-meta…');
  const studioMeta = await seedCrmStudioMeta(edgeModelService, modelsByName, seedResult);
  for (const model of studioMeta.models) {
    console.log(
      `  studio-meta ${model.objectName}: groups=${model.groupCount} columns=${model.columnMetaCount} relations=${model.associationMetaCount}`,
    );
  }

  const tables = await verifyTables();
  console.log('[CRM Phase 1] Done.');
  console.log(`  tables: ${tables.join(', ') || '(none)'}`);
  console.log('  Note: CRM is opt-in; fresh apps without this script have no CRM footprint.');
};

const rollback = async (): Promise<void> => {
  console.log('[CRM Phase 1 rollback] Removing edge models (+ studio-meta)…');
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  removeCrmEdgeModels();

  console.log('[CRM Phase 1 rollback] Dropping tables…');
  await runSqlFile(uninstallSqlPath);

  console.log('[CRM Phase 1 rollback] Removing Base Info CRM tree…');
  const { deletedRootId } = await unseedCrmBaseInfo();
  console.log(`  deleted root: ${deletedRootId ?? '(already absent)'}`);

  const tables = await verifyTables();
  console.log('[CRM Phase 1 rollback] Done.');
  console.log(`  remaining crm_* tables: ${tables.join(', ') || '(none)'}`);
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
    console.error(`[CRM Phase 1] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
