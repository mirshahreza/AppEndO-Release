/**
 * Canonical map: who owns which database objects and how operators upgrade them.
 * Machine index — prose: docs/standards/data-model.md (Schema ownership).
 */

export const CONTROL_PLANE_SCHEMA_LAYER_IDS = {
  prismaControlPlane: 'prisma-control-plane',
  sequelizeFeatureExtensions: 'sequelize-feature-extensions',
  hwyPackageCoreDdl: 'hwy-package-core-ddl',
  hwyPackageSatelliteDdl: 'hwy-package-satellite-ddl',
  hwyPackageDbObjects: 'hwy-package-db-objects',
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
    notes: 'Version marker: CONTROL_PLANE_SEQUELIZE_FEATURE_SCHEMA_VERSION in controlPlaneBootMarkers.ts.',
  },
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.hwyPackageCoreDdl,
    title: 'Hawiety core tables (hwy_schema.sqlserver.sql)',
    source: 'scripts/hwy-phase1/db/install/hwy_schema.sqlserver.sql',
    upgradeCommand: 'npm run schema:install-extensions:hwy',
    notes: 'Also: npm run hwy:phase1 for full phase-1 (seed + edge models).',
  },
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.hwyPackageSatelliteDdl,
    title: 'Hawiety satellite DDL patches',
    source: 'scripts/hwy-phase1/db/install/*.sql + inline ensureHwy*Schema.ts',
    upgradeCommand: 'npm run schema:install-extensions:hwy',
  },
  {
    id: CONTROL_PLANE_SCHEMA_LAYER_IDS.hwyPackageDbObjects,
    title: 'Hawiety procedures / views / functions',
    source: 'scripts/hwy-phase1/db/install/hwy_db_*.sqlserver.sql',
    upgradeCommand: 'npm run hwy:db-objects',
    notes: 'Ordered list: ensureHwyDbObjects SQL_INSTALL_ORDER.',
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
  'hwy_',
  'vw_hwy_',
  'cms_',
  'zz_',
] as const;

/** Extra standalone names merged into CONTROL_PLANE_SCHEMA_PROTECTED_TABLES during sync. */
export const CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES = [
  'base_control_plane_boot_markers',
  '_prisma_migrations',
] as const;

export const isNonPrismaProtectedTableName = (rawName: string): boolean => {
  const name = rawName.trim().toLowerCase();
  if (!name) return false;
  if (CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES.some((fixed) => fixed === name)) {
    return true;
  }
  return CONTROL_PLANE_NON_PRISMA_TABLE_PREFIXES.some((prefix) => name.startsWith(prefix));
};
