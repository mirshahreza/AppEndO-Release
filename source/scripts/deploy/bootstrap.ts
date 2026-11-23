#!/usr/bin/env tsx
/**
 * Unattended first boot for a release-cut deploy snapshot.
 * Prepares settings.json before any server module loads, so production
 * does not need APPENDO_LOCAL_PROD_PUBLISH and the HTTP wizard stays closed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeDeploySecrets,
  missingFreshInstallFields,
  parseDeploySecretsFile,
  secretsFromEnv,
  type DeployBootstrapSecrets,
} from './bootstrapPlan';
import {
  ensureDeploySettingsFile,
  prepareSettingsDocument,
  readSettingsDocument,
  writeSettingsDocument,
} from './prepareDeploySettings';

type CliOptions = {
  root: string;
  secrets: DeployBootstrapSecrets;
  postInstall: boolean;
  forcePostInstall: boolean;
};

function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  return argv[index + 1];
}

export function resolveDeployRoot(cwd: string, explicit?: string): string {
  if (explicit) {
    const root = path.resolve(explicit);
    if (!fs.existsSync(path.join(root, 'MANIFEST.json'))) {
      throw new Error(`No MANIFEST.json in ${root}`);
    }
    return root;
  }
  const candidates = [cwd, path.resolve(cwd, '..')];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'MANIFEST.json')) && fs.existsSync(path.join(candidate, 'packages'))) {
      return candidate;
    }
  }
  throw new Error('Could not find a deploy snapshot (MANIFEST.json + packages/). Pass --root.');
}

function loadSecrets(argv: string[]): DeployBootstrapSecrets {
  const fileArg = readFlag(argv, '--secrets') ?? process.env.APPENDO_DEPLOY_SECRETS_FILE?.trim();
  const fromFile = fileArg && fs.existsSync(fileArg)
    ? parseDeploySecretsFile(fs.readFileSync(fileArg, 'utf8'))
    : {};
  if (fileArg && !fs.existsSync(fileArg)) {
    throw new Error(`Secrets file not found: ${fileArg}`);
  }
  return mergeDeploySecrets(fromFile, secretsFromEnv(process.env));
}

export function parseBootstrapCli(argv: string[], cwd: string): CliOptions {
  return {
    root: resolveDeployRoot(cwd, readFlag(argv, '--root')),
    secrets: loadSecrets(argv),
    postInstall: argv.includes('--post-install') || process.env.APPENDO_DEPLOY_RUN_POST_INSTALL === '1',
    forcePostInstall: argv.includes('--force-post-install') || process.env.APPENDO_DEPLOY_FORCE_POST_INSTALL === '1',
  };
}

function installIsComplete(settings: Record<string, unknown>): boolean {
  const install = settings.install;
  if (!install || typeof install !== 'object') return false;
  return Boolean((install as { completedAt?: unknown }).completedAt);
}

async function main(): Promise<void> {
  const options = parseBootstrapCli(process.argv.slice(2), process.cwd());
  process.chdir(options.root);
  const settingsPath = ensureDeploySettingsFile(options.root);
  const current = readSettingsDocument(settingsPath);
  const installComplete = installIsComplete(current);
  if (!installComplete) {
    const missing = missingFreshInstallFields(options.secrets);
    if (missing.length > 0) {
      throw new Error(
        `Fresh install needs ${missing.join(', ')}. Put them in the environment or a gitignored --secrets file. Do not commit that file.`,
      );
    }
  }
  const prepared = prepareSettingsDocument({
    settings: current,
    secrets: options.secrets,
    installComplete,
  });
  const nextBody = `${JSON.stringify(prepared.settings, null, 2)}\n`;
  const previousBody = fs.readFileSync(settingsPath, 'utf8');
  if (previousBody !== nextBody) {
    writeSettingsDocument(settingsPath, prepared.settings);
  }
  if (prepared.rotatedJwtSecrets) {
    console.log('[deploy:bootstrap] Wrote production JWT secrets into settings.json.');
  }

  const { runDeployBootstrap } = await import('./runDeployBootstrap');
  await runDeployBootstrap({
    deployRoot: options.root,
    settingsPath,
    secrets: options.secrets,
    postInstall: options.postInstall,
    forcePostInstall: options.forcePostInstall,
  });
}

const isMain = process.argv[1] != null
  && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  main().then(() => {
    // Install completion starts background runtime. Exit once the CLI work is done.
    process.exit(0);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[deploy:bootstrap] ${message}`);
    process.exit(1);
  });
}
