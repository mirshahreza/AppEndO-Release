import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'node:child_process';

import {
  ensureSqliteControlPlaneDirectory,
  parseSqliteControlPlaneFilePath,
  type ControlPlaneDatabaseSettings,
  type ControlPlaneDbProvider,
} from './controlPlaneDatabase';
import {
  filterControlPlaneSchemaDiffSql,
  listPrismaMappedTableNames,
  readSchemaDiffTableNameListsFromEnv,
} from './controlPlaneSchemaDiff';
import { resolveControlPlaneSchemaProtectedTables } from './controlPlaneSchemaProtectedTables';
import { compileGeneratedPrismaClientForNode } from './generatedPrismaClientRuntime';
import { toPrismaCliDatabaseUrl } from './prismaCliSqlServerUrl';

const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');
const GENERATED_CLASS_PATH = path.join(process.cwd(), 'src', 'generated', 'prisma', 'internal', 'class.ts');

type ProviderSchemaSession = {
  schemaPath: string;
  cleanup: () => void;
};

export const readGeneratedPrismaActiveProvider = (): ControlPlaneDbProvider | undefined => {
  try {
    const content = fs.readFileSync(GENERATED_CLASS_PATH, 'utf8');
    const match = content.match(/"activeProvider":\s*"(postgresql|mysql|sqlite|sqlserver)"/);
    return match?.[1] as ControlPlaneDbProvider | undefined;
  } catch {
    return undefined;
  }
};

/** Generate a Prisma client for the runtime provider while keeping schema.prisma on postgresql. */
export const generatePrismaClientForRuntimeProvider = (
  settings: Pick<ControlPlaneDatabaseSettings, 'provider' | 'url'>,
  options?: { force?: boolean },
): void => {
  if (!options?.force && readGeneratedPrismaActiveProvider() === settings.provider) {
    return;
  }

  const session = createProviderSchemaSession(settings.provider);
  try {
    generatePrismaClient(settings.url, session.schemaPath);
  } finally {
    session.cleanup();
  }
};

const readActiveSchemaProvider = (schemaContent: string): ControlPlaneDbProvider | undefined => (
  schemaContent.match(
    /datasource db\s*\{\s*provider\s*=\s*"(postgresql|mysql|sqlite|sqlserver)"/,
  )?.[1] as ControlPlaneDbProvider | undefined
);

const PROVIDERS_WITHOUT_MULTIPLE_CASCADE_PATHS: ReadonlySet<ControlPlaneDbProvider> = new Set([
  'sqlserver',
  'mysql',
]);

/**
 * SQL Server / MySQL reject multiple cascade paths and cascading self-relations
 * (https://pris.ly/d/cyclic-referential-actions). PostgreSQL keeps SetNull / Cascade.
 */
const patchReferentialActionsForRestrictedProviders = (schemaContent: string): string => {
  let patched = schemaContent.replace(/onDelete:\s*SetNull\b/g, 'onDelete: NoAction');
  patched = patched.replace(/onUpdate:\s*Cascade\b/g, 'onUpdate: NoAction');

  // BaseSampleMockRecord is a self-relation; SQL Server also forbids CASCADE on its children.
  patched = patched.replace(
    /(onDelete:\s*)Cascade(\s*,\s*onUpdate:\s*NoAction)/g,
    (full, prefix: string, suffix: string, offset: number) => {
      const preceding = patched.slice(Math.max(0, offset - 500), offset);
      return preceding.includes('BaseSampleMock') ? `${prefix}NoAction${suffix}` : full;
    },
  );

  return patched;
};

/** SQL Server: Prisma `@db.Text` maps to non-Unicode `text` — use `nvarchar(max)` instead. */
export type PatchPrismaSchemaOptions = {
  /**
   * SQLite-only: emit Int PKs so `db push` creates INTEGER PRIMARY KEY AUTOINCREMENT.
   * Leave off when generating the runtime client so BigInt IDs still match app code.
   */
  sqliteIntegerIds?: boolean;
};

export const patchPrismaSchemaForProvider = (
  provider: ControlPlaneDbProvider,
  schemaContent: string,
  options: PatchPrismaSchemaOptions = {},
): string => {
  let patched = schemaContent;

  if (readActiveSchemaProvider(patched) !== provider) {
    const withProvider = patched.replace(
      /(datasource db\s*\{\s*provider\s*=\s*")(?:postgresql|mysql|sqlite|sqlserver)(")/,
      `$1${provider}$2`,
    );
    if (withProvider === patched) {
      throw new Error(`Failed to patch Prisma datasource provider to ${provider}.`);
    }
    patched = withProvider;
  }

  if (provider === 'sqlserver') {
    patched = patched.replace(/@db\.Text\b/g, '@db.NVarChar(Max)');
  }

  // SQLite has no native `@db.Text` attribute — keep the String fields unadorned.
  if (provider === 'sqlite') {
    patched = patched.replace(/\s+@db\.Text\b/g, '');
    if (options.sqliteIntegerIds) {
      patched = patched.replace(/\bBigInt\b/g, 'Int');
    }
  }

  if (PROVIDERS_WITHOUT_MULTIPLE_CASCADE_PATHS.has(provider)) {
    patched = patchReferentialActionsForRestrictedProviders(patched);
  }

  return patched;
};

const buildProviderPatchedSchemaContent = (
  provider: ControlPlaneDbProvider,
  original = fs.readFileSync(SCHEMA_PATH, 'utf8'),
  options: PatchPrismaSchemaOptions = {},
): string => {
  let patched = patchPrismaSchemaForProvider(provider, original, options);
  if (readActiveSchemaProvider(original) !== provider) {
    const absoluteOutput = path.join(process.cwd(), 'src', 'generated', 'prisma').replace(/\\/g, '/');
    patched = patched.replace(
      /output\s*=\s*"\.\.\/src\/generated\/prisma"/,
      `output   = "${absoluteOutput}"`,
    );
  }
  return patched;
};

/** Use a temp schema file so install-time provider switches do not touch tracked schema.prisma (Vite HMR). */
const createProviderSchemaSession = (
  provider: ControlPlaneDbProvider,
  options: PatchPrismaSchemaOptions = {},
): ProviderSchemaSession => {
  const original = fs.readFileSync(SCHEMA_PATH, 'utf8');
  if (readActiveSchemaProvider(original) === provider && !options.sqliteIntegerIds) {
    return { schemaPath: SCHEMA_PATH, cleanup: () => {} };
  }

  const tempPath = path.join(
    os.tmpdir(),
    `appendo-control-plane-${provider}-${options.sqliteIntegerIds ? 'sql-' : ''}${process.pid}.prisma`,
  );
  fs.writeFileSync(tempPath, buildProviderPatchedSchemaContent(provider, original, options), 'utf8');
  return {
    schemaPath: tempPath,
    cleanup: () => {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // Best-effort temp cleanup.
      }
    },
  };
};

const quoteCliArg = (value: string): string => JSON.stringify(value);

const AI_AGENT_ENV_KEYS = new Set([
  'CLAUDECODE',
  'CLAUDE_CODE',
  'ANTHROPIC_CLI',
  'REPL_ID',
  'REPLIT_CLI',
  'AIDER',
  'GEMINI_CLI',
  'QWEN_CODE',
]);

const isAiAgentEnvKey = (key: string): boolean => (
  AI_AGENT_ENV_KEYS.has(key)
  || key.startsWith('CURSOR_')
  || key.startsWith('COMPOSER_')
);

/** Operator-initiated schema apply — Prisma otherwise blocks `--accept-data-loss` when the Node process inherited Cursor/agent env. */
export const CONTROL_PLANE_SCHEMA_PUSH_CONSENT =
  'AppEndO control-plane schema apply: operator initialized the database.';

const buildPrismaCliEnv = (extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  for (const key of Object.keys(env)) {
    if (isAiAgentEnvKey(key)) {
      delete env[key];
    }
  }
  return env;
};

/** Force-reset only: drop platform `base_%` views, never customer/package views. */
const dropLegacyPostgresBaseViews = (
  url: string,
  provider: ControlPlaneDbProvider,
): void => {
  if (provider !== 'postgresql') return;
  try {
    execSync(`npx prisma db execute --stdin`, {
      input: `
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
              SELECT viewname FROM pg_views
              WHERE schemaname = 'public' AND viewname LIKE 'base_%'
            ) LOOP
                EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
            END LOOP;
        END $$;
      `,
      env: buildPrismaCliEnv({ DATABASE_URL: url }),
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true,
    });
  } catch {
    // Legacy view may not exist on greenfield databases.
  }
};

const writeTempPrismaConfig = (schemaPath: string, url: string): ProviderSchemaSession => {
  const configPath = path.join(os.tmpdir(), `appendo-control-plane-config-${process.pid}.ts`);
  const content = `export default {
  schema: ${JSON.stringify(schemaPath)},
  datasource: {
    url: ${JSON.stringify(url)},
  },
};
`;
  fs.writeFileSync(configPath, content, 'utf8');
  return {
    schemaPath: configPath,
    cleanup: () => {
      try {
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
        }
      } catch {
        // Best-effort temp cleanup.
      }
    },
  };
};

const isMissingDatabaseError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /\bP1003\b/.test(message) || /Database `.+` does not exist/i.test(message);
};

const ensureSqliteFileExists = (url: string): void => {
  ensureSqliteControlPlaneDirectory(url);
  const filePath = parseSqliteControlPlaneFilePath(url);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '');
  }
};

const migrateDiffToSchema = (
  url: string,
  schemaPath: string,
  configPath: string,
  from: 'datasource' | 'empty',
): string => {
  const fromArg = from === 'empty' ? '--from-empty' : '--from-config-datasource';
  return runPrismaCliCapture([
    'migrate',
    'diff',
    '--config',
    quoteCliArg(configPath),
    fromArg,
    '--to-schema',
    quoteCliArg(schemaPath),
    '--script',
  ], url);
};

export const CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE_ENV = 'CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE';

export const isDestructiveControlPlaneSchemaPushRequested = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const raw = env[CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE_ENV]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
};

export type ApplyAdditiveControlPlaneSchemaResult = {
  appliedSql: string;
  skippedCount: number;
};

/** Compare live DB to the Prisma schema and apply only additive / Prisma-owned changes. */
export const applyAdditiveControlPlaneSchema = (
  url: string,
  schemaPath: string,
  options?: { provider?: ControlPlaneDbProvider },
): ApplyAdditiveControlPlaneSchemaResult => {
  if (options?.provider === 'sqlite' || url.startsWith('file:')) {
    ensureSqliteFileExists(url);
  }

  const configSession = writeTempPrismaConfig(schemaPath, url);
  try {
    let script: string;
    try {
      script = migrateDiffToSchema(url, schemaPath, configSession.schemaPath, 'datasource');
    } catch (error) {
      if (!isMissingDatabaseError(error)) throw error;
      script = migrateDiffToSchema(url, schemaPath, configSession.schemaPath, 'empty');
    }

    const prismaTables = listPrismaMappedTableNames(fs.readFileSync(schemaPath, 'utf8'));
    const extraNames = readSchemaDiffTableNameListsFromEnv();
    const protectedTables = resolveControlPlaneSchemaProtectedTables();
    for (const name of extraNames.protectedTables) {
      protectedTables.add(name);
    }
    const filtered = filterControlPlaneSchemaDiffSql(script, {
      prismaTables,
      protectedTables,
      allowDropTables: extraNames.allowDropTables,
    });

    if (filtered.skipped.length > 0) {
      const preview = filtered.skipped
        .slice(0, 12)
        .map((item) => `  - ${item.header}${item.tables[0] ? ` ${item.tables[0]}` : ''} (${item.reason})`)
        .join('\n');
      process.stdout.write(
        `Control-plane schema sync skipped ${filtered.skipped.length} destructive statement(s) `
        + `that would drop or alter objects outside the Prisma schema:\n${preview}\n`,
      );
    }

    if (!filtered.appliedSql.trim()) {
      process.stdout.write('Control-plane schema already matches Prisma models (no additive changes).\n');
      return { appliedSql: '', skippedCount: filtered.skipped.length };
    }

    const sqlPath = path.join(os.tmpdir(), `appendo-control-plane-apply-${process.pid}.sql`);
    fs.writeFileSync(sqlPath, filtered.appliedSql, 'utf8');
    try {
      runPrismaCli([
        'db',
        'execute',
        '--config',
        quoteCliArg(configSession.schemaPath),
        '--file',
        quoteCliArg(sqlPath),
      ], url);
    } finally {
      try {
        if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
      } catch {
        // Best-effort temp cleanup.
      }
    }

    return { appliedSql: filtered.appliedSql, skippedCount: filtered.skipped.length };
  } finally {
    configSession.cleanup();
  }
};

type ExecSyncError = Error & {
  stdout?: string | Buffer;
  stderr?: string | Buffer;
};

const bufferToUtf8 = (value: string | Buffer | undefined): string => {
  if (!value) return '';
  return Buffer.isBuffer(value) ? value.toString('utf8') : value;
};

const formatPrismaCliFailure = (error: unknown, command: string): Error => {
  const execError = error as ExecSyncError;
  const combined = [bufferToUtf8(execError.stderr), bufferToUtf8(execError.stdout)]
    .filter((part) => part.trim())
    .join('\n')
    .trim();
  const firstError = combined.match(/^error: .+$/m)?.[0];
  const summary = firstError
    || combined.slice(0, 1500)
    || execError.message
    || `Command failed: ${command}`;
  return new Error(summary);
};

const runPrismaCliCapture = (
  args: string[],
  url: string,
  extraEnv?: NodeJS.ProcessEnv,
  options?: { input?: string },
): string => {
  const command = `npx prisma ${args.join(' ')}`;
  const prismaUrl = toPrismaCliDatabaseUrl(url);
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: buildPrismaCliEnv({ DATABASE_URL: prismaUrl, ...extraEnv }),
      shell: true,
      input: options?.input,
    }) ?? '';
  } catch (error) {
    throw formatPrismaCliFailure(error, command);
  }
};

const runPrismaCli = (
  args: string[],
  url: string,
  extraEnv?: NodeJS.ProcessEnv,
): void => {
  const output = runPrismaCliCapture(args, url, extraEnv);
  if (output.trim()) {
    process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
  }
};

const generatePrismaClient = (url: string, schemaPath = SCHEMA_PATH): void => {
  runPrismaCli(['generate', '--schema', quoteCliArg(schemaPath)], url);
  compileGeneratedPrismaClientForNode({ force: true });
};

const UNICODE_UPGRADE_SCRIPT = path.join(process.cwd(), 'scripts', 'sqlserver-unicode-upgrade.ts');

const prepareSqlServerDatabaseForSchemaPush = (url: string): void => {
  const settingsPath = process.env.APPENDO_SETTINGS_PATH?.trim();
  execSync(`npx tsx ${quoteCliArg(UNICODE_UPGRADE_SCRIPT)}`, {
    stdio: 'inherit',
    env: buildPrismaCliEnv(
      settingsPath
        ? { APPENDO_SETTINGS_PATH: settingsPath }
        : { CONTROL_PLANE_DATABASE_URL: url },
    ),
    shell: true,
  });
};

/** Destructive Prisma reconcile — drops tables that are not in the schema. Do not use as the upgrade default. */
const pushPrismaSchema = (
  url: string,
  schemaPath: string,
  options?: { forceReset?: boolean; dangerousActionConsent?: string },
): void => {
  const prismaUrl = toPrismaCliDatabaseUrl(url);
  const args = [
    'db',
    'push',
    '--schema',
    quoteCliArg(schemaPath),
    '--url',
    quoteCliArg(prismaUrl),
    '--accept-data-loss',
  ];
  if (options?.forceReset) {
    args.push('--force-reset');
  }
  const consent = options?.dangerousActionConsent?.trim() || CONTROL_PLANE_SCHEMA_PUSH_CONSENT;
  runPrismaCli(args, url, {
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: consent,
  });
};

/** User-facing install wizard consent for Prisma destructive CLI guardrails (PRM-4). */
export const INSTALL_WIZARD_SCHEMA_RESET_CONSENT =
  'Install wizard: user enabled replace existing schema.';

/** Force-reset control-plane schema via Prisma (MySQL / SQL Server install override path). */
export const forceResetControlPlaneSchemaWithPrisma = (
  settings: Pick<ControlPlaneDatabaseSettings, 'provider' | 'url'>,
  options?: { dangerousActionConsent?: string },
): void => {
  const sqliteIntegerIds = settings.provider === 'sqlite';
  const session = createProviderSchemaSession(settings.provider, { sqliteIntegerIds });
  try {
    if (settings.provider === 'sqlserver') {
      prepareSqlServerDatabaseForSchemaPush(settings.url);
    }
    dropLegacyPostgresBaseViews(settings.url, settings.provider);
    if (!sqliteIntegerIds) {
      generatePrismaClient(settings.url, session.schemaPath);
    }
    pushPrismaSchema(settings.url, session.schemaPath, {
      forceReset: true,
      dangerousActionConsent: options?.dangerousActionConsent,
    });
    if (sqliteIntegerIds) {
      generatePrismaClientForRuntimeProvider(settings, { force: true });
    }
  } finally {
    session.cleanup();
  }
};

export type PushControlPlaneSchemaOptions = {
  /**
   * DANGEROUS: `prisma db push --accept-data-loss` (drops tables not in the Prisma schema).
   * Default is additive migrate-diff apply, which preserves unknown tables.
   */
  destructive?: boolean;
};

/** Push control-plane schema for the resolved provider (p-45 PRM-4). Additive by default. */
export const pushControlPlaneSchema = (
  settings: Pick<ControlPlaneDatabaseSettings, 'provider' | 'url'>,
  options?: PushControlPlaneSchemaOptions,
): (() => void) => {
  const sqliteIntegerIds = settings.provider === 'sqlite';
  const session = createProviderSchemaSession(settings.provider, { sqliteIntegerIds });
  const destructive = options?.destructive === true
    || isDestructiveControlPlaneSchemaPushRequested();
  try {
    if (settings.provider === 'sqlserver') {
      prepareSqlServerDatabaseForSchemaPush(settings.url);
    }
    if (!sqliteIntegerIds) {
      generatePrismaClient(settings.url, session.schemaPath);
    }
    if (destructive) {
      process.stderr.write(
        'DANGER: control-plane schema apply is using prisma db push --accept-data-loss. '
        + 'This DROPS tables that are not in the Prisma schema (including domain/package tables).\n'
        + 'Safe default: npm run db:sync-schema (additive migrate-diff).\n',
      );
      pushPrismaSchema(settings.url, session.schemaPath, {
        dangerousActionConsent: CONTROL_PLANE_SCHEMA_PUSH_CONSENT,
      });
    } else {
      applyAdditiveControlPlaneSchema(settings.url, session.schemaPath, {
        provider: settings.provider,
      });
    }
    if (sqliteIntegerIds) {
      generatePrismaClientForRuntimeProvider(settings, { force: true });
    }
    return session.cleanup;
  } catch (error) {
    session.cleanup();
    throw error;
  }
};

export const restoreDefaultPrismaGenerate = (fallbackUrl?: string): void => {
  const url = fallbackUrl?.trim()
    || process.env.DATABASE_URL?.trim()
    || 'postgresql://postgres:postgres@localhost:5432/appendo_prisma_generate';
  generatePrismaClient(url);
};

/** After schema push/reset restores schema.prisma to postgresql, keep generated client on the runtime provider. */
export const reconcilePrismaClientAfterSchemaOperation = (
  settings: Pick<ControlPlaneDatabaseSettings, 'provider' | 'url'>,
): void => {
  if (settings.provider === 'postgresql') {
    restoreDefaultPrismaGenerate(settings.url);
    return;
  }
  generatePrismaClientForRuntimeProvider(settings);
};
