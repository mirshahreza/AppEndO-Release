import { QueryTypes, Sequelize } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpsDashboardViewStatements } from '../opsDashboardViews';

const STUB_TABLES = [
  `CREATE TABLE base_users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    locked INTEGER,
    is_builtin INTEGER,
    login_fail_count INTEGER,
    last_login_at TEXT,
    created_at TEXT,
    email TEXT,
    email_verified_at TEXT
  )`,
  `CREATE TABLE base_user_profiles (
    user_id INTEGER PRIMARY KEY,
    person_type_code TEXT
  )`,
  `CREATE TABLE base_user_roles (
    user_id INTEGER,
    role_name TEXT
  )`,
  `CREATE TABLE base_user_identities (
    id INTEGER PRIMARY KEY,
    user_id INTEGER
  )`,
  `CREATE TABLE base_scope_memberships (
    id INTEGER PRIMARY KEY,
    user_id INTEGER
  )`,
  `CREATE TABLE base_workflow_definitions (
    id INTEGER PRIMARY KEY,
    key TEXT,
    lifecycle_status TEXT
  )`,
  `CREATE TABLE base_workflow_revisions (
    id INTEGER PRIMARY KEY,
    workflow_definition_id INTEGER
  )`,
  `CREATE TABLE base_workflow_instances (
    id INTEGER PRIMARY KEY,
    workflow_revision_id INTEGER,
    status TEXT
  )`,
  `CREATE TABLE base_work_items (
    id INTEGER PRIMARY KEY,
    status TEXT,
    work_item_type TEXT,
    priority INTEGER,
    claimed_by_user_id INTEGER,
    due_at TEXT,
    created_at TEXT,
    completed_at TEXT,
    claimed_at TEXT,
    workflow_instance_id INTEGER
  )`,
  `CREATE TABLE base_logs_auth_audit (
    id INTEGER PRIMARY KEY,
    event_type TEXT,
    success INTEGER,
    created_at TEXT,
    user_id INTEGER
  )`,
];

describe('opsDashboardViews', () => {
  let sequelize: Sequelize;

  beforeAll(async () => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    for (const ddl of STUB_TABLES) {
      await sequelize.query(ddl);
    }
    for (const statement of buildOpsDashboardViewStatements('sqlite')) {
      if (statement.dropSql) {
        await sequelize.query(statement.dropSql, { type: QueryTypes.RAW });
      }
      await sequelize.query(statement.ensureSql, { type: QueryTypes.RAW });
    }

    await sequelize.query(`INSERT INTO base_users (id, username, locked, is_builtin, login_fail_count, last_login_at, created_at, email)
      VALUES (1, 'admin', 0, 1, 0, '2026-09-01', '2026-01-01', 'admin@example.com')`);
    await sequelize.query(`INSERT INTO base_users (id, username, locked, is_builtin, login_fail_count, last_login_at, created_at, email)
      VALUES (2, 'norole', 0, 0, 0, NULL, '2026-01-02', NULL)`);
    await sequelize.query(`INSERT INTO base_user_roles (user_id, role_name) VALUES (1, 'ADMIN')`);
    await sequelize.query(`INSERT INTO base_workflow_definitions (id, key, lifecycle_status) VALUES (10, 'onboard', 'ACTIVE')`);
    await sequelize.query(`INSERT INTO base_workflow_revisions (id, workflow_definition_id) VALUES (20, 10)`);
    await sequelize.query(`INSERT INTO base_workflow_instances (id, workflow_revision_id, status) VALUES (30, 20, 'RUNNING')`);
    await sequelize.query(`INSERT INTO base_work_items (
        id, status, work_item_type, priority, claimed_by_user_id, due_at, created_at, workflow_instance_id
      ) VALUES (40, 'OPEN', 'TASK', 1, NULL, '2000-01-01', '2026-09-01', 30)`);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('marks overdue OPEN work items and exposes workflow_key', async () => {
    const [rows] = await sequelize.query(
      'SELECT id, is_overdue, workflow_key FROM base_ops_work_item_queue WHERE id = 40',
    ) as [Array<{ id: number; is_overdue: number; workflow_key: string }>, unknown];
    expect(rows[0]).toMatchObject({ id: 40, is_overdue: 1, workflow_key: 'onboard' });
  });

  it('sets has_role=0 for a user without role grants', async () => {
    const [rows] = await sequelize.query(
      'SELECT username, has_role FROM base_ops_user_directory WHERE id = 2',
    ) as [Array<{ username: string; has_role: number }>, unknown];
    expect(rows[0]).toEqual({ username: 'norole', has_role: 0 });
  });

  it('lists ADMIN users in people roles', async () => {
    const [rows] = await sequelize.query(
      "SELECT username, role_name FROM base_ops_people_roles WHERE role_name = 'ADMIN'",
    ) as [Array<{ username: string; role_name: string }>, unknown];
    expect(rows).toEqual([{ username: 'admin', role_name: 'ADMIN' }]);
  });

  it('does not expose email on the user directory view', async () => {
    const [columns] = await sequelize.query('PRAGMA table_info(base_ops_user_directory)') as [
      Array<{ name: string }>,
      unknown,
    ];
    expect(columns.map((column) => column.name)).not.toContain('email');
  });

  it('emits SQL Server CREATE OR ALTER and Postgres CREATE OR REPLACE', () => {
    const mssql = buildOpsDashboardViewStatements('mssql');
    const postgres = buildOpsDashboardViewStatements('postgres');
    expect(mssql[0]?.ensureSql).toMatch(/CREATE OR ALTER VIEW/);
    expect(mssql[0]?.ensureSql).toContain('SYSUTCDATETIME()');
    expect(mssql[0]?.dropSql).toBeUndefined();
    expect(postgres[0]?.ensureSql).toMatch(/CREATE OR REPLACE VIEW/);
    expect(postgres.find((item) => item.name === 'base_ops_user_directory')?.ensureSql)
      .toContain("NOW() - INTERVAL '30 days'");
  });
});
