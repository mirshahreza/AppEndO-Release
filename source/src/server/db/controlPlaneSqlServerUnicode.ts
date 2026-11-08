import sql from 'mssql';

import type { ControlPlaneDbProvider } from './controlPlaneDatabase';
import { buildMssqlConfigFromControlPlaneUrl } from './mssqlControlPlaneConfig';
import { getPrismaControlPlane } from './prismaControlPlane';

export type SqlServerUnicodeTextColumn = {
  table: string;
  column: string;
  nullable: boolean;
  /** Re-applied after type change when the column had a SQL Server default constraint. */
  defaultSql?: string;
};

/** Prisma `@db.Text` maps to non-Unicode `text` on SQL Server — upgrade to `nvarchar(max)`. */
export const SQL_SERVER_UNICODE_TEXT_COLUMNS: readonly SqlServerUnicodeTextColumn[] = [
  { table: 'base_info', column: 'title_path_en', nullable: true },
  { table: 'base_info', column: 'title_path_fa', nullable: true },
  { table: 'base_info', column: 'title_path_ar', nullable: true },
  { table: 'base_info', column: 'note', nullable: true },
  { table: 'base_info', column: 'note_en', nullable: true },
  { table: 'base_info', column: 'note_fa', nullable: true },
  { table: 'base_info', column: 'note_ar', nullable: true },
  { table: 'base_info', column: 'metadata', nullable: true },
  { table: 'base_info', column: 'ui_html', nullable: true },
  { table: 'base_user_identities', column: 'profile_json', nullable: true },
  { table: 'base_roles', column: 'note', nullable: true },
  { table: 'base_users_attributes', column: 'value_text', nullable: true },
  { table: 'base_settings_sections', column: 'value', nullable: false },
  { table: 'base_roles_attributes', column: 'value_text', nullable: true },
  { table: 'base_auth_refresh_tokens', column: 'user_agent', nullable: true },
  { table: 'base_logs_auth_audit', column: 'reason', nullable: true },
  { table: 'base_logs_auth_audit', column: 'metadata_json', nullable: true },
  { table: 'base_logs_app', column: 'failure_reason', nullable: true },
  { table: 'base_logs_app', column: 'message', nullable: false },
  { table: 'base_logs_app', column: 'meta_json', nullable: true },
  { table: 'base_jobs', column: 'progress_message', nullable: true },
  { table: 'base_jobs', column: 'payload_json', nullable: true },
  { table: 'base_jobs', column: 'result_json', nullable: true },
  { table: 'base_jobs', column: 'error_message', nullable: true },
  {
    table: 'base_ai_chat_sessions',
    column: 'messages_json',
    nullable: false,
    defaultSql: "N'[]'",
  },
  { table: 'base_ai_chat_sessions', column: 'agent_capability_scope_json', nullable: true },
  { table: 'base_ai_chat_sessions', column: 'context_history_summary', nullable: true },
  { table: 'base_ai_agent_traces', column: 'error', nullable: true },
  { table: 'base_ai_agent_traces', column: 'summary', nullable: true },
  { table: 'base_ai_agent_apply_snapshots', column: 'change_sets_json', nullable: false },
  { table: 'base_ai_agent_apply_snapshots', column: 'snapshots_json', nullable: false },
  { table: 'base_ai_agent_apply_snapshots', column: 'summary', nullable: true },
] as const;

export const buildAlterColumnSql = ({ table, column, nullable, defaultSql }: SqlServerUnicodeTextColumn): string => `
IF OBJECT_ID(N'[${table}]', N'U') IS NOT NULL
AND EXISTS (
  SELECT 1
  FROM sys.columns c
  INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID(N'[${table}]')
    AND c.name = N'${column}'
    AND t.name IN (N'text', N'varchar', N'char')
)
BEGIN
  DECLARE @df_name sysname;
  SELECT @df_name = dc.name
  FROM sys.default_constraints dc
  INNER JOIN sys.columns c
    ON c.object_id = dc.parent_object_id
   AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID(N'[${table}]')
    AND c.name = N'${column}';

  IF @df_name IS NOT NULL
    EXEC(N'ALTER TABLE [${table}] DROP CONSTRAINT [' + @df_name + N']');

  ALTER TABLE [${table}] ALTER COLUMN [${column}] NVARCHAR(MAX) ${nullable ? 'NULL' : 'NOT NULL'};
  ${defaultSql ? `
  IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.object_id = dc.parent_object_id
     AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[${table}]')
      AND c.name = N'${column}'
  )
    ALTER TABLE [${table}] ADD CONSTRAINT [DF_${table}_${column}] DEFAULT ${defaultSql} FOR [${column}];
  ` : ''}
END
`;

export async function ensureSqlServerUnicodeTextColumnsFromUrl(url: string): Promise<void> {
  const pool = new sql.ConnectionPool(buildMssqlConfigFromControlPlaneUrl(url));
  await pool.connect();
  try {
    for (const column of SQL_SERVER_UNICODE_TEXT_COLUMNS) {
      await pool.request().query(buildAlterColumnSql(column));
    }
  } finally {
    await pool.close();
  }
}

/** Idempotent upgrade for databases created before SQL Server Unicode schema patching. */
export async function ensureSqlServerUnicodeTextColumns(
  provider: ControlPlaneDbProvider,
): Promise<void> {
  if (provider !== 'sqlserver') return;

  const prisma = getPrismaControlPlane();
  for (const column of SQL_SERVER_UNICODE_TEXT_COLUMNS) {
    await prisma.$executeRawUnsafe(buildAlterColumnSql(column));
  }
}
