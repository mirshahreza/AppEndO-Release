import { DataSourceType } from '../../shared/api/contracts/data-sources/types';

export type SqlConsoleSampleQuery = {
  id: string;
  title: string;
  hint: string;
  sql: string;
};

const SQL_ENGINES = new Set<string>([
  DataSourceType.POSTGRES,
  DataSourceType.MYSQL,
  DataSourceType.SQLITE,
  DataSourceType.SQL_SERVER,
  DataSourceType.ORACLE,
]);

const applyRowLimit = (sourceType: string, sql: string, limit: number): string => {
  const trimmed = sql.trim().replace(/;\s*$/, '');
  if (sourceType === DataSourceType.SQL_SERVER) {
    return `${trimmed.replace(/^select\s+/i, `SELECT TOP ${limit} `)};`;
  }
  if (sourceType === DataSourceType.ORACLE) {
    return `${trimmed}\nFETCH FIRST ${limit} ROWS ONLY;`;
  }
  return `${trimmed}\nLIMIT ${limit};`;
};

const listTablesSql = (sourceType: string): string => {
  if (sourceType === DataSourceType.SQLITE) {
    return `SELECT name AS table_name
FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name;`;
  }
  if (sourceType === DataSourceType.MYSQL) {
    return `SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
ORDER BY TABLE_NAME;`;
  }
  if (sourceType === DataSourceType.SQL_SERVER) {
    return `SELECT TABLE_SCHEMA AS table_schema, TABLE_NAME AS table_name
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;`;
  }
  if (sourceType === DataSourceType.ORACLE) {
    return `SELECT table_name
FROM user_tables
ORDER BY table_name;`;
  }
  return `SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;`;
};

const platformUsersSql = (sourceType: string): string => applyRowLimit(
  sourceType,
  `SELECT
  id,
  username,
  email,
  is_builtin,
  last_login_at,
  created_at
FROM base_users
ORDER BY id`,
  50,
);

const usersAndRolesSql = (sourceType: string): string => applyRowLimit(
  sourceType,
  `SELECT
  u.id,
  u.username,
  u.email,
  ur.role_name
FROM base_users u
LEFT JOIN base_user_roles ur ON ur.user_id = u.id
ORDER BY u.id, ur.role_name`,
  50,
);

export const isSqlConsoleSampleEngine = (sourceType: string | null | undefined): boolean => (
  Boolean(sourceType && SQL_ENGINES.has(sourceType))
);

export const buildSqlConsoleSampleQueries = (
  sourceType: string | null | undefined,
): SqlConsoleSampleQuery[] => {
  if (!sourceType || !SQL_ENGINES.has(sourceType)) {
    return [];
  }

  return [
    {
      id: 'list-tables',
      title: 'List tables',
      hint: 'Tables in this database',
      sql: listTablesSql(sourceType),
    },
    {
      id: 'platform-users',
      title: 'Platform users',
      hint: 'Directory without secrets',
      sql: platformUsersSql(sourceType),
    },
    {
      id: 'users-and-roles',
      title: 'Users and roles',
      hint: 'Who has which role',
      sql: usersAndRolesSql(sourceType),
    },
  ];
};
