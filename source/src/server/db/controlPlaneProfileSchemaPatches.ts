import type { ControlPlaneDbProvider } from './controlPlaneDatabase';
import { getPrismaControlPlane } from './prismaControlPlane';
import { logger } from '../../core/logging/Logger';

const PROFILE_LEGAL_ENTITY_COLUMNS = [
  { column: 'company_name', postgresType: 'TEXT', sqlServerType: 'NVARCHAR(MAX)' },
  { column: 'registration_number', postgresType: 'TEXT', sqlServerType: 'NVARCHAR(MAX)' },
  { column: 'website', postgresType: 'TEXT', sqlServerType: 'NVARCHAR(MAX)' },
] as const;

const buildPostgresAddColumnSql = (column: string, type: string): string => (
  `ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS ${column} ${type};`
);

const buildSqliteAddColumnSql = (column: string, type: string): string => (
  `ALTER TABLE base_user_profiles ADD COLUMN ${column} ${type};`
);

const buildSqlServerAddColumnSql = (column: string, type: string): string => `
IF OBJECT_ID(N'base_user_profiles', N'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.columns c
  WHERE c.object_id = OBJECT_ID(N'base_user_profiles')
    AND c.name = N'${column}'
)
ALTER TABLE base_user_profiles ADD ${column} ${type} NULL;
`;

const buildMysqlAddColumnSql = (column: string, type: string): string => `
SET @appendo_profile_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'base_user_profiles'
    AND column_name = '${column}'
);
SET @appendo_profile_col_sql := IF(
  @appendo_profile_col_exists = 0,
  'ALTER TABLE base_user_profiles ADD COLUMN ${column} ${type} NULL',
  'SELECT 1'
);
PREPARE appendo_profile_col_stmt FROM @appendo_profile_col_sql;
EXECUTE appendo_profile_col_stmt;
DEALLOCATE PREPARE appendo_profile_col_stmt;
`;

/** Idempotent profile columns for legal-entity fields (company_name, registration_number, website). */
export async function ensureUserProfileLegalEntityColumns(
  provider: ControlPlaneDbProvider,
): Promise<void> {
  const prisma = getPrismaControlPlane();

  for (const spec of PROFILE_LEGAL_ENTITY_COLUMNS) {
    const statements: string[] = [];

    switch (provider) {
      case 'postgresql':
        statements.push(buildPostgresAddColumnSql(spec.column, spec.postgresType));
        break;
      case 'sqlite':
        statements.push(buildSqliteAddColumnSql(spec.column, spec.postgresType));
        break;
      case 'sqlserver':
        statements.push(buildSqlServerAddColumnSql(spec.column, spec.sqlServerType));
        break;
      case 'mysql':
        statements.push(buildMysqlAddColumnSql(spec.column, 'TEXT'));
        break;
      default:
        break;
    }

    for (const sql of statements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (provider === 'sqlite' && /duplicate column name/i.test(message)) {
          continue;
        }
        logger.warn(
          'Server',
          `Could not ensure base_user_profiles.${spec.column}: ${message}`,
        );
      }
    }
  }
}

/** Drop legacy 10-digit national_code CHECK on existing PostgreSQL installs. */
export async function ensureNationalCodeCheckDropped(
  provider: ControlPlaneDbProvider,
): Promise<void> {
  if (provider !== 'postgresql') return;

  const prisma = getPrismaControlPlane();
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE base_user_profiles DROP CONSTRAINT IF EXISTS chk_user_profiles_national_code;',
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Server', `Could not drop chk_user_profiles_national_code: ${message}`);
  }
}
