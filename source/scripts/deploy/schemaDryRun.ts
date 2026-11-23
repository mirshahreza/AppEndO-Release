#!/usr/bin/env tsx
/**
 * Print the filtered additive control-plane sync SQL for a settings.json or
 * deploy secrets file. Runs prisma migrate diff (read-only) and does not execute.
 *
 *   npm run deploy:schema-dry-run -- --settings ./settings.json
 *   npm run deploy:schema-dry-run -- --secrets ./deploy.bootstrap.local.json
 *   npm run deploy:schema-dry-run -- --file ./settings.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatSkippedSchemaDiffLog, sqlBatchBalanceIssues } from '../../src/server/db/controlPlaneSchemaDiff';
import {
  classifyControlPlaneInputFile,
  resolveSchemaDryRunDatabase,
  type SchemaDryRunConnection,
} from '../../src/server/db/controlPlaneSchemaDryRun';
import { planControlPlaneSchemaSync } from '../../src/server/db/controlPlaneSchemaPush';
import { parseDeploySecretsFile } from './bootstrapPlan';

const USAGE = `
Print the filtered control-plane schema sync SQL. Does not execute it.

  npm run deploy:schema-dry-run -- --settings ./settings.json
  npm run deploy:schema-dry-run -- --secrets ./deploy.bootstrap.local.json
  npm run deploy:schema-dry-run -- --file ./settings.json

--settings is an AppEndO settings.json. --secrets is a deploy bootstrap secrets
file (JSON or KEY=VALUE). --file is either; the shape is detected.
Pass both to start from settings.json and override the connection from secrets.

SQL is written to stdout. Notes about preserved tables go to stderr.
`.trim();

type CliArgs = {
  help: boolean;
  settingsPath?: string;
  secretsPath?: string;
  filePath?: string;
};

function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} needs a file path.`);
  }
  return value;
}

export function parseSchemaDryRunArgs(argv: string[]): CliArgs {
  return {
    help: argv.includes('--help') || argv.includes('-h'),
    settingsPath: readFlag(argv, '--settings'),
    secretsPath: readFlag(argv, '--secrets'),
    filePath: readFlag(argv, '--file'),
  };
}

function secretsFromFile(filePath: string): SchemaDryRunConnection {
  if (!fs.existsSync(filePath)) throw new Error(`Secrets file not found: ${filePath}`);
  return parseDeploySecretsFile(fs.readFileSync(filePath, 'utf8'));
}

export function resolveSchemaDryRunInputs(args: CliArgs): {
  settingsPath?: string;
  secrets?: SchemaDryRunConnection;
} {
  let settingsPath = args.settingsPath;
  let secretsPath = args.secretsPath;
  if (args.filePath) {
    if (!fs.existsSync(args.filePath)) throw new Error(`File not found: ${args.filePath}`);
    const kind = classifyControlPlaneInputFile(fs.readFileSync(args.filePath, 'utf8'));
    if (kind === 'settings') settingsPath = settingsPath ?? args.filePath;
    else secretsPath = secretsPath ?? args.filePath;
  }
  return {
    settingsPath,
    secrets: secretsPath ? secretsFromFile(secretsPath) : undefined,
  };
}

function main(): void {
  const args = parseSchemaDryRunArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const database = resolveSchemaDryRunDatabase(resolveSchemaDryRunInputs(args));
  process.stderr.write(
    `[deploy:schema-dry-run] ${database.provider} additive diff (not executed).\n`,
  );
  const plan = planControlPlaneSchemaSync(database);
  const skipLog = formatSkippedSchemaDiffLog(plan.skipped);
  if (skipLog) process.stderr.write(skipLog);
  if (!plan.appliedSql.trim()) {
    process.stderr.write('Control-plane schema already matches Prisma models (no additive changes).\n');
    return;
  }
  const balance = sqlBatchBalanceIssues(plan.appliedSql);
  if (balance.length > 0) {
    process.stderr.write(
      `[deploy:schema-dry-run] Filtered SQL is not a balanced batch (${balance.join('; ')}).\n`,
    );
  }
  process.stdout.write(plan.appliedSql.endsWith('\n') ? plan.appliedSql : `${plan.appliedSql}\n`);
}

const isMain = process.argv[1] != null
  && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[deploy:schema-dry-run] ${message}`);
    process.exit(1);
  }
}
