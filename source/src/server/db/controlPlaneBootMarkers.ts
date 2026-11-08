import type { ControlPlaneDbProvider } from './controlPlaneDatabase';
import { getPrismaControlPlane } from './prismaControlPlane';

const MARKER_TABLE = 'base_control_plane_boot_markers';

/** Bump when SQL Server unicode/index patches or profile/enrichment DDL change. */
export const CONTROL_PLANE_RUNTIME_PATCHES_VERSION = '7';

/** Bump when any Sequelize feature model in ensureControlPlaneFeatureTables changes. */
export const CONTROL_PLANE_SEQUELIZE_FEATURE_SCHEMA_VERSION = '10';

/** Bump when ops dashboard view SQL changes. */
export const CONTROL_PLANE_OPS_DASHBOARD_VIEWS_VERSION = '1';

export const CONTROL_PLANE_BOOT_MARKER_KEYS = {
  runtimePatches: 'runtime_patches',
  sequelizeFeatureTables: 'sequelize_feature_tables',
  opsDashboardViews: 'ops_dashboard_views',
} as const;

export type ControlPlaneBootMarkerKey =
  (typeof CONTROL_PLANE_BOOT_MARKER_KEYS)[keyof typeof CONTROL_PLANE_BOOT_MARKER_KEYS];

let markerTableReady = false;

const escapeMarkerKey = (key: string): string => key.replace(/'/g, "''");

const createMarkerTableStatements = (provider: ControlPlaneDbProvider): string[] => {
  switch (provider) {
    case 'postgresql':
      return [
        `CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (
          marker_key TEXT PRIMARY KEY,
          version TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
      ];
    case 'mysql':
      return [
        `CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (
          marker_key VARCHAR(64) NOT NULL PRIMARY KEY,
          version VARCHAR(32) NOT NULL,
          applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )`,
      ];
    case 'sqlite':
      return [
        `CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (
          marker_key TEXT PRIMARY KEY,
          version TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      ];
    case 'sqlserver':
      return [
        `IF OBJECT_ID(N'${MARKER_TABLE}', N'U') IS NULL
CREATE TABLE ${MARKER_TABLE} (
  marker_key NVARCHAR(64) NOT NULL PRIMARY KEY,
  version NVARCHAR(32) NOT NULL,
  applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
)`,
      ];
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported control-plane provider for boot markers: ${exhaustive}`);
    }
  }
};

export const ensureControlPlaneBootMarkerTable = async (
  provider: ControlPlaneDbProvider,
): Promise<void> => {
  if (markerTableReady) {
    return;
  }
  const prisma = getPrismaControlPlane();
  for (const statement of createMarkerTableStatements(provider)) {
    await prisma.$executeRawUnsafe(statement);
  }
  markerTableReady = true;
};

const readMarkerVersion = async (
  provider: ControlPlaneDbProvider,
  markerKey: ControlPlaneBootMarkerKey,
): Promise<string | null> => {
  await ensureControlPlaneBootMarkerTable(provider);
  const prisma = getPrismaControlPlane();
  const safeKey = escapeMarkerKey(markerKey);

  switch (provider) {
    case 'postgresql':
    case 'sqlite': {
      const rows = await prisma.$queryRawUnsafe<Array<{ version: string }>>(
        `SELECT version FROM ${MARKER_TABLE} WHERE marker_key = '${safeKey}' LIMIT 1`,
      );
      return rows[0]?.version ?? null;
    }
    case 'mysql': {
      const rows = await prisma.$queryRawUnsafe<Array<{ version: string }>>(
        `SELECT version FROM ${MARKER_TABLE} WHERE marker_key = '${safeKey}' LIMIT 1`,
      );
      return rows[0]?.version ?? null;
    }
    case 'sqlserver': {
      const rows = await prisma.$queryRawUnsafe<Array<{ version: string }>>(
        `SELECT TOP (1) version FROM ${MARKER_TABLE} WHERE marker_key = N'${safeKey}'`,
      );
      return rows[0]?.version ?? null;
    }
    default:
      return null;
  }
};

const writeMarkerVersion = async (
  provider: ControlPlaneDbProvider,
  markerKey: ControlPlaneBootMarkerKey,
  version: string,
): Promise<void> => {
  await ensureControlPlaneBootMarkerTable(provider);
  const prisma = getPrismaControlPlane();
  const safeKey = escapeMarkerKey(markerKey);
  const safeVersion = version.replace(/'/g, "''");

  switch (provider) {
    case 'postgresql':
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${MARKER_TABLE} (marker_key, version, applied_at)
         VALUES ('${safeKey}', '${safeVersion}', NOW())
         ON CONFLICT (marker_key) DO UPDATE SET version = EXCLUDED.version, applied_at = NOW()`,
      );
      return;
    case 'sqlite':
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${MARKER_TABLE} (marker_key, version, applied_at)
         VALUES ('${safeKey}', '${safeVersion}', datetime('now'))
         ON CONFLICT(marker_key) DO UPDATE SET version = excluded.version, applied_at = datetime('now')`,
      );
      return;
    case 'mysql':
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${MARKER_TABLE} (marker_key, version, applied_at)
         VALUES ('${safeKey}', '${safeVersion}', CURRENT_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE version = VALUES(version), applied_at = CURRENT_TIMESTAMP(3)`,
      );
      return;
    case 'sqlserver':
      await prisma.$executeRawUnsafe(
        `MERGE ${MARKER_TABLE} AS target
         USING (SELECT N'${safeKey}' AS marker_key, N'${safeVersion}' AS version) AS source
         ON target.marker_key = source.marker_key
         WHEN MATCHED THEN UPDATE SET version = source.version, applied_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN INSERT (marker_key, version, applied_at)
           VALUES (source.marker_key, source.version, SYSUTCDATETIME());`,
      );
      return;
    default:
      return;
  }
};

export const isControlPlaneBootMarkerCurrent = async (
  provider: ControlPlaneDbProvider,
  markerKey: ControlPlaneBootMarkerKey,
  expectedVersion: string,
): Promise<boolean> => {
  const stored = await readMarkerVersion(provider, markerKey);
  return stored === expectedVersion;
};

export const markControlPlaneBootApplied = async (
  provider: ControlPlaneDbProvider,
  markerKey: ControlPlaneBootMarkerKey,
  version: string,
): Promise<void> => {
  await writeMarkerVersion(provider, markerKey, version);
};

/** Test-only — marker table is process-global. */
export const resetControlPlaneBootMarkerTableCacheForTests = (): void => {
  markerTableReady = false;
};
