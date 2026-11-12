import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MONOREPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK_DIR = path.join(MONOREPO_ROOT, '.appendo-clone-work');
const SECRET_PATH = path.join(WORK_DIR, 'clone-sql-login.password');
export const CLONE_SQL_LOGIN = 'appendo_clone_dev';
const SQL_INSTANCE = process.env.APPENDO_CLONE_SQL_INSTANCE?.trim() || 'localhost\\SQL2025';

const sqlEscape = (value: string): string => value.replace(/'/g, "''");

function readOrCreatePassword(): string {
  const fromEnv = process.env.APPENDO_CLONE_SQL_PASSWORD?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  fs.mkdirSync(WORK_DIR, { recursive: true });
  if (fs.existsSync(SECRET_PATH)) {
    return fs.readFileSync(SECRET_PATH, 'utf8').trim();
  }
  const generated = crypto.randomBytes(18).toString('hex');
  fs.writeFileSync(SECRET_PATH, `${generated}\n`, { mode: 0o600 });
  console.log(`[clone:sql-login] Generated dev login password → ${SECRET_PATH}`);
  return generated;
}

function runSql(batch: string): void {
  const child = spawnSync(
    'sqlcmd',
    ['-S', SQL_INSTANCE, '-E', '-b', '-Q', batch],
    { encoding: 'utf8', shell: false, maxBuffer: 4 * 1024 * 1024 },
  );
  if (child.status !== 0) {
    const err = (child.stderr || child.stdout || '').trim();
    throw new Error(`sqlcmd failed: ${err.slice(-1500)}`);
  }
}

export function applyCloneSqlLoginUsernameToSettings(settingsPath: string): void {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
  const sources = settings.dataSources;
  if (!Array.isArray(sources) || sources.length === 0 || typeof sources[0] !== 'object') {
    throw new Error(`settings missing dataSources: ${settingsPath}`);
  }
  const ds = sources[0] as Record<string, unknown>;
  ds.username = CLONE_SQL_LOGIN;
  delete ds.password;
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

export function ensureCloneSqlLogin(database: string): string {
  const password = readOrCreatePassword();
  const login = sqlEscape(CLONE_SQL_LOGIN);
  const pass = sqlEscape(password);
  const db = sqlEscape(database);

  runSql(`
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'${login}')
  CREATE LOGIN [${CLONE_SQL_LOGIN}] WITH PASSWORD = N'${pass}', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
ELSE
  ALTER LOGIN [${CLONE_SQL_LOGIN}] WITH PASSWORD = N'${pass}', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
`);

  runSql(`
IF DB_ID(N'${db}') IS NULL
  CREATE DATABASE [${database}];
USE [${database}];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${login}')
  CREATE USER [${CLONE_SQL_LOGIN}] FOR LOGIN [${CLONE_SQL_LOGIN}];
IF IS_ROLEMEMBER('db_owner', '${login}') <> 1
  ALTER ROLE db_owner ADD MEMBER [${CLONE_SQL_LOGIN}];
`);

  console.log(`[clone:sql-login] Login ${CLONE_SQL_LOGIN} ready on ${database} (Windows setup via sqlcmd -E).`);
  return password;
}
