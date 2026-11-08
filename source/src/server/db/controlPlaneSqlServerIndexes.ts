import type { ControlPlaneDbProvider } from './controlPlaneDatabase';
import { getPrismaControlPlane } from './prismaControlPlane';
import { logger } from '../../core/logging/Logger';

export type SqlServerPerformanceIndexSpec = {
  name: string;
  table: string;
  columns: readonly string[];
};

/**
 * Postgres/MySQL/SQLite control-plane installs get these via `@@index` in prisma/schema.prisma
 * automatically. SQL Server needs them applied out-of-band (see buildCreateIndexSql below) —
 * this used to only happen if an admin remembered to run `npm run db:apply-performance-indexes`
 * by hand; MSSQL installs otherwise silently ran auth/audit queries without them indefinitely.
 */
export const SQL_SERVER_PERFORMANCE_INDEXES: readonly SqlServerPerformanceIndexSpec[] = [
  { name: 'idx_base_user_profiles_firstname', table: 'base_user_profiles', columns: ['firstname'] },
  { name: 'idx_base_user_profiles_lastname', table: 'base_user_profiles', columns: ['lastname'] },
  { name: 'idx_base_auth_refresh_tokens_user_id', table: 'base_auth_refresh_tokens', columns: ['user_id'] },
  { name: 'idx_base_logs_auth_audit_created_at', table: 'base_logs_auth_audit', columns: ['created_at'] },
  { name: 'idx_base_logs_auth_audit_user_created', table: 'base_logs_auth_audit', columns: ['user_id', 'created_at'] },
  { name: 'idx_base_logs_auth_audit_event_created', table: 'base_logs_auth_audit', columns: ['event_type', 'created_at'] },
] as const;

export const buildCreateIndexSql = ({ name, table, columns }: SqlServerPerformanceIndexSpec): string => {
  const columnList = columns.map((column) => `[${column}]`).join(', ');
  return `
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes i
  INNER JOIN sys.tables t ON i.object_id = t.object_id
  WHERE i.name = N'${name}' AND t.name = N'${table}'
)
CREATE INDEX [${name}] ON [${table}](${columnList});
`;
};

/**
 * Idempotent — safe to call on every boot. Failures are logged, not thrown: a missing index is
 * a performance issue, not a correctness one, and shouldn't block the server from starting
 * (e.g. a DB user without ALTER/index-create permission should still be able to run the app).
 */
export async function ensureSqlServerPerformanceIndexes(
  provider: ControlPlaneDbProvider,
): Promise<void> {
  if (provider !== 'sqlserver') return;

  const prisma = getPrismaControlPlane();
  for (const index of SQL_SERVER_PERFORMANCE_INDEXES) {
    try {
      await prisma.$executeRawUnsafe(buildCreateIndexSql(index));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Server', `Could not ensure SQL Server performance index "${index.name}": ${message}`);
    }
  }
}
