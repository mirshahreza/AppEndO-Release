import type { ControlPlaneDbProvider } from './controlPlaneDatabase';
import { getPrismaControlPlane } from './prismaControlPlane';
import { logger } from '../../core/logging/Logger';

const TABLE = 'base_db_enrichment_runs';
const COLUMN = 'progress_log_json';

const STATEMENTS: Record<ControlPlaneDbProvider, string> = {
  postgresql: `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${COLUMN} TEXT;`,
  sqlite: `ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} TEXT;`,
  sqlserver: `
IF OBJECT_ID(N'${TABLE}', N'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.columns c
  WHERE c.object_id = OBJECT_ID(N'${TABLE}')
    AND c.name = N'${COLUMN}'
)
ALTER TABLE ${TABLE} ADD ${COLUMN} NVARCHAR(MAX) NULL;
`,
  mysql: `
SET @appendo_enrichment_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = '${TABLE}'
    AND column_name = '${COLUMN}'
);
SET @appendo_enrichment_col_sql := IF(
  @appendo_enrichment_col_exists = 0,
  'ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} TEXT NULL',
  'SELECT 1'
);
PREPARE appendo_enrichment_col_stmt FROM @appendo_enrichment_col_sql;
EXECUTE appendo_enrichment_col_stmt;
DEALLOCATE PREPARE appendo_enrichment_col_stmt;
`,
};

/** Prisma maps progress logs onto this column; older control-plane DBs never received the push. */
export async function ensureDbEnrichmentRunProgressLogColumn(
  provider: ControlPlaneDbProvider,
): Promise<void> {
  const prisma = getPrismaControlPlane();
  const sql = STATEMENTS[provider];
  if (!sql) {
    return;
  }
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (provider === 'sqlite' && /duplicate column name/i.test(message)) {
      return;
    }
    logger.warn('Server', `Could not ensure ${TABLE}.${COLUMN}: ${message}`);
  }
}
