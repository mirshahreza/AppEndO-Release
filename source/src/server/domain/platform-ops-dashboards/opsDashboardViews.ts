import type { ControlPlaneDbProvider } from '../../db/controlPlaneDatabase';
import { OPS_DASHBOARD_VIEW_NAMES } from '../../../shared/lib/opsDashboardCatalog';

export type OpsDashboardSqlDialect = 'mssql' | 'postgres' | 'mysql' | 'sqlite';

export const opsDashboardSqlDialectForProvider = (
  provider: ControlPlaneDbProvider,
): OpsDashboardSqlDialect => {
  switch (provider) {
    case 'sqlserver':
      return 'mssql';
    case 'postgresql':
      return 'postgres';
    case 'mysql':
      return 'mysql';
    case 'sqlite':
      return 'sqlite';
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported control-plane provider for ops views: ${exhaustive}`);
    }
  }
};

const nowExpr = (dialect: OpsDashboardSqlDialect): string => {
  switch (dialect) {
    case 'mssql':
      return 'SYSUTCDATETIME()';
    case 'postgres':
      return 'NOW()';
    case 'mysql':
      return 'UTC_TIMESTAMP()';
    case 'sqlite':
      return `datetime('now')`;
  }
};

const dormantCutoffExpr = (dialect: OpsDashboardSqlDialect): string => {
  switch (dialect) {
    case 'mssql':
      return 'DATEADD(day, -30, SYSUTCDATETIME())';
    case 'postgres':
      return `NOW() - INTERVAL '30 days'`;
    case 'mysql':
      return 'DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)';
    case 'sqlite':
      return `datetime('now', '-30 days')`;
  }
};

const boolAsInt = (predicate: string): string => (
  `CASE WHEN ${predicate} THEN 1 ELSE 0 END`
);

const builtinAsInt = (dialect: OpsDashboardSqlDialect): string => (
  dialect === 'postgres' ? boolAsInt('u.is_builtin') : boolAsInt('u.is_builtin = 1')
);

const hasEmailPredicate = (dialect: OpsDashboardSqlDialect): string => (
  dialect === 'mssql'
    ? "u.email IS NOT NULL AND LTRIM(RTRIM(u.email)) <> ''"
    : "u.email IS NOT NULL AND TRIM(u.email) <> ''"
);

const workflowKeyColumn = (dialect: OpsDashboardSqlDialect): string => (
  dialect === 'mssql' ? 'def.[key]' : 'def.key'
);

const dropViewSql = (name: string, dialect: OpsDashboardSqlDialect): string => {
  if (dialect === 'mssql') {
    return `IF OBJECT_ID(N'${name}', N'V') IS NOT NULL DROP VIEW [${name}];`;
  }
  return `DROP VIEW IF EXISTS ${name};`;
};

const workItemQueueBody = (dialect: OpsDashboardSqlDialect): string => `
SELECT
  wi.id AS id,
  wi.status AS status,
  wi.work_item_type AS work_item_type,
  wi.priority AS priority,
  wi.claimed_by_user_id AS claimed_by_user_id,
  u.username AS claimed_by_username,
  wi.due_at AS due_at,
  wi.created_at AS created_at,
  wi.completed_at AS completed_at,
  wi.claimed_at AS claimed_at,
  wi.workflow_instance_id AS workflow_instance_id,
  inst.status AS workflow_instance_status,
  ${workflowKeyColumn(dialect)} AS workflow_key,
  def.lifecycle_status AS workflow_lifecycle_status,
  ${boolAsInt(
    `wi.due_at IS NOT NULL AND wi.status IN ('OPEN', 'CLAIMED') AND wi.due_at < ${nowExpr(dialect)}`,
  )} AS is_overdue
FROM base_work_items wi
JOIN base_workflow_instances inst ON inst.id = wi.workflow_instance_id
JOIN base_workflow_revisions rev ON rev.id = inst.workflow_revision_id
JOIN base_workflow_definitions def ON def.id = rev.workflow_definition_id
LEFT JOIN base_users u ON u.id = wi.claimed_by_user_id
`;

const userDirectoryBody = (dialect: OpsDashboardSqlDialect): string => `
SELECT
  u.id AS id,
  u.username AS username,
  u.locked AS locked,
  ${builtinAsInt(dialect)} AS is_builtin,
  u.login_fail_count AS login_fail_count,
  u.last_login_at AS last_login_at,
  u.created_at AS created_at,
  p.person_type_code AS person_type_code,
  (SELECT COUNT(*) FROM base_user_roles ur WHERE ur.user_id = u.id) AS role_count,
  ${boolAsInt('p.user_id IS NOT NULL')} AS has_profile,
  ${boolAsInt('(SELECT COUNT(*) FROM base_user_roles ur2 WHERE ur2.user_id = u.id) > 0')} AS has_role,
  ${boolAsInt('(SELECT COUNT(*) FROM base_user_identities ui WHERE ui.user_id = u.id) > 0')} AS has_identity,
  ${boolAsInt('(SELECT COUNT(*) FROM base_scope_memberships sm WHERE sm.user_id = u.id) > 0')} AS has_scope,
  ${boolAsInt(hasEmailPredicate(dialect))} AS has_email,
  ${boolAsInt('u.email_verified_at IS NOT NULL')} AS email_verified,
  ${boolAsInt('u.last_login_at IS NULL')} AS never_logged_in,
  ${boolAsInt(`u.last_login_at IS NOT NULL AND u.last_login_at < ${dormantCutoffExpr(dialect)}`)} AS is_dormant,
  ${boolAsInt('u.login_fail_count > 0')} AS has_fail_streak
FROM base_users u
LEFT JOIN base_user_profiles p ON p.user_id = u.id
`;

const peopleRolesBody = (dialect: OpsDashboardSqlDialect): string => `
SELECT
  u.id AS user_id,
  u.username AS username,
  ur.role_name AS role_name,
  u.locked AS locked,
  ${builtinAsInt(dialect)} AS is_builtin,
  p.person_type_code AS person_type_code,
  ${boolAsInt('u.last_login_at IS NULL')} AS never_logged_in,
  u.created_at AS created_at
FROM base_user_roles ur
JOIN base_users u ON u.id = ur.user_id
LEFT JOIN base_user_profiles p ON p.user_id = u.id
`;

const authEventsBody = (): string => `
SELECT
  a.id AS id,
  a.event_type AS event_type,
  a.success AS success,
  a.created_at AS created_at,
  a.user_id AS user_id,
  u.username AS username
FROM base_logs_auth_audit a
LEFT JOIN base_users u ON u.id = a.user_id
`;

const trimSql = (sql: string): string => sql.replace(/^\s+/gm, '  ').trim();

export type OpsDashboardViewStatement = {
  name: (typeof OPS_DASHBOARD_VIEW_NAMES)[number];
  /** CREATE OR ALTER / OR REPLACE — no DROP on server engines. */
  ensureSql: string;
  /** SQLite has no CREATE OR REPLACE VIEW — drop first when (re)building. */
  dropSql?: string;
};

export const buildOpsDashboardViewStatements = (
  dialect: OpsDashboardSqlDialect,
): OpsDashboardViewStatement[] => {
  const bodies: Record<(typeof OPS_DASHBOARD_VIEW_NAMES)[number], string> = {
    base_ops_work_item_queue: trimSql(workItemQueueBody(dialect)),
    base_ops_user_directory: trimSql(userDirectoryBody(dialect)),
    base_ops_people_roles: trimSql(peopleRolesBody(dialect)),
    base_ops_auth_events: trimSql(authEventsBody()),
  };

  return OPS_DASHBOARD_VIEW_NAMES.map((name) => {
    const body = bodies[name];
    if (dialect === 'sqlite') {
      return {
        name,
        dropSql: dropViewSql(name, dialect),
        ensureSql: `CREATE VIEW ${name} AS\n${body}`,
      };
    }
    if (dialect === 'mssql') {
      return {
        name,
        ensureSql: `CREATE OR ALTER VIEW [${name}] AS\n${body}`,
      };
    }
    return {
      name,
      ensureSql: `CREATE OR REPLACE VIEW ${name} AS\n${body}`,
    };
  });
};
