/**
 * Canonical map: who owns which database objects and how operators upgrade them.
 * Machine index — prose: docs/standards/data-model.md (Schema ownership).
 */

export const CONTROL_PLANE_SCHEMA_LAYER_IDS = {
  prismaControlPlane: 'prisma-control-plane',
  sequelizeFeatureExtensions: 'sequelize-feature-extensions',
  extxPackageCoreDdl: 'extx-package-core-ddl',
  extxPackageSatelliteDdl: 'extx-package-satellite-ddl',
  extxPackageDbObjects: 'extx-package-db-objects',
  edgePackageModels: 'edge-package-models',
} as const;

export type ControlPlaneSchemaLayerId =
  (typeof CONTROL_PLANE_SCHEMA_LAYER_IDS)[keyof typeof CONTROL_PLANE_SCHEMA_LAYER_IDS];

export type ControlPlaneSchemaLayer = {
  id: ControlPlaneSchemaLayerId;
  /** Human-readable owner for operators and agents. */
  title: string;
  /** Primary source file or directory (repo-relative). */
  source: string;
  /** Supported operator upgrade command (npm script). */
  upgradeCommand: string;
  /** Boot may still run idempotent ensures; CLI upgrade is canonical. */
  notes?: string;
};

export const CONTROL_PLANE_SCHEMA_OWNERSHIP_LAYERS: readonly ControlPlaneSchemaLayer[] = [
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.prismaControlPlane,
    title: 'Prisma control plane (base_* in schema.prisma)',
    source: 'prisma/schema.prisma',
    upgradeCommand: 'npm run db:sync-schema',
    notes: 'Legacy access path; new base_* tables target Sequelize per data-model.md.',
  },
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.sequelizeFeatureExtensions,
    title: 'Sequelize feature extensions (base_* not in Prisma)',
    source: 'src/server/db/ensureControlPlaneFeatureTables.ts',
    upgradeCommand: 'npm run schema:install-extensions',
    notes: 'Version marker: CONTROL_PLANE_SEQUELIZE_FEATURE_SCHEMA_VERSION in controlPlaneBootMarkers.ts. Names in CONTROL_PLANE_EXTERNALLY_MANAGED_TABLE_NAMES are passed to Prisma as tables.external so migrate diff does not emit DropTable for them.',
  },
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.extxPackageCoreDdl,
    title: 'Portalx core tables (extx_schema.sqlserver.sql)',
    source: 'scripts/extx-phase1/db/install/extx_schema.sqlserver.sql',
    upgradeCommand: 'npm run schema:install-extensions:extx',
    notes: 'Also: npm run extx:phase1 for full phase-1 (seed + edge models).',
  },
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.extxPackageSatelliteDdl,
    title: 'Portalx satellite DDL patches',
    source: 'scripts/extx-phase1/db/install/*.sql + inline ensureExtx*Schema.ts',
    upgradeCommand: 'npm run schema:install-extensions:extx',
  },
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.extxPackageDbObjects,
    title: 'Portalx procedures / views / functions',
    source: 'scripts/extx-phase1/db/install/extx_db_*.sqlserver.sql',
    upgradeCommand: 'npm run extx:db-objects',
    notes: 'Ordered list: ensureExtxDbObjects SQL_INSTALL_ORDER.',
  },
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.edgePackageModels,
    title: 'Edge / package tables (cms_*, designer data sources)',
    source: 'workspace/edge-models + package install SQL',
    upgradeCommand: 'Package-specific install / Data Studio deploy',
    notes: 'Not applied by db:sync-schema; never drop via destructive Prisma push.',
  },
] as const;

/** Table name prefixes that are never owned by prisma/schema.prisma. */
export const CONTROL_PLANE_NON_PRISMA_TABLE_PREFIXES = [
  'extx_',
  'cms_',
  'zz_',
] as const;

/** Extra standalone names merged into CONTROL_PLANE_SCHEMA_PROTECTED_TABLES during sync. */
export const CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES = [
  'base_control_plane_boot_markers',
  '_prisma_migrations',
] as const;

/**
 * Control-plane tables owned by Sequelize (or raw SQL), not by prisma/schema.prisma.
 * Prisma is locked, so these models are not added there. Additive sync declares them
 * as externally managed tables; migrate diff must not treat them as drift to drop.
 * Do not list tables that also have a Prisma model (for example base_logs_app).
 */
export const CONTROL_PLANE_EXTERNALLY_MANAGED_TABLE_NAMES = [
  'base_component_usage_summary',
  'base_control_plane_boot_markers',
  'base_credential_vault_secrets',
  'base_dashboard_page_access',
  'base_dashboard_snapshots',
  'base_dashboard_widget_comments',
  'base_data_sources',
  'base_direct_message_attachments',
  'base_direct_message_messages',
  'base_direct_message_participant_state',
  'base_direct_message_threads',
  'base_extx_business_rule_docs',
  'base_info_culture_text',
  'base_info_title_path',
  'base_personal_inbox_archived_items',
  'base_personal_inbox_correspondence',
  'base_personal_inbox_item_folder_tags',
  'base_personal_inbox_item_seen',
  'base_personal_inbox_projection_items',
  'base_personal_inbox_projection_meta',
  'base_personal_inbox_user_folders',
  'base_product_ideas',
  'base_record_event_holds',
  'base_record_events',
  'base_user_message_dispatches',
  'base_workbooks',
] as const;

export type ControlPlaneExternalTableProvider = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver';

/** Prisma `tables.external` names. SQL Server and PostgreSQL require a schema qualifier. */
export const qualifyExternallyManagedTableName = (
  provider: ControlPlaneExternalTableProvider,
  tableName: string,
): string => {
  const name = tableName.trim().toLowerCase();
  if (provider === 'sqlserver') return `dbo.${name}`;
  if (provider === 'postgresql') return `public.${name}`;
  return name;
};

export const listPrismaExternalTableNames = (
  provider: ControlPlaneExternalTableProvider,
): string[] => (
  CONTROL_PLANE_EXTERNALLY_MANAGED_TABLE_NAMES.map((name) => (
    qualifyExternallyManagedTableName(provider, name)
  ))
);

const EXTERNALLY_MANAGED_TABLE_NAME_SET = new Set<string>(
  CONTROL_PLANE_EXTERNALLY_MANAGED_TABLE_NAMES,
);

export const isExternallyManagedControlPlaneTableName = (rawName: string): boolean => (
  EXTERNALLY_MANAGED_TABLE_NAME_SET.has(rawName.trim().toLowerCase())
);

export const isNonPrismaProtectedTableName = (rawName: string): boolean => {
  const name = rawName.trim().toLowerCase();
  if (!name) return false;
  if (CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES.some((fixed) => fixed === name)) {
    return true;
  }
  if (isExternallyManagedControlPlaneTableName(name)) {
    return true;
  }
  return CONTROL_PLANE_NON_PRISMA_TABLE_PREFIXES.some((prefix) => name.startsWith(prefix));
};
