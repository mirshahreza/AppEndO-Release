import fs from 'node:fs';
import path from 'node:path';
import { loadAuthSecrets } from '../config/authSecrets';
import { readRuntimeSettings } from '../config/settingsFile';
import {
  deployBootstrapEnvIntent,
  mergeDeploySecrets,
  missingFreshInstallFields,
  parseDeploySecretsFile,
  postInstallHookForced,
  postInstallHookRequested,
  secretsFromEnv,
  type DeployBootstrapSecrets,
} from '../../../scripts/deploy/bootstrapPlan';
import {
  ensureDeploySettingsFile,
  prepareSettingsDocument,
  readSettingsDocument,
  writeSettingsDocument,
} from '../../../scripts/deploy/prepareDeploySettings';

let prepError: string | null = null;

export function isDeploySnapshotRoot(cwd: string): boolean {
  const manifest = path.join(cwd, 'MANIFEST.json');
  const packagesDir = path.join(cwd, 'packages');
  return fs.existsSync(manifest) && fs.existsSync(packagesDir) && fs.statSync(packagesDir).isDirectory();
}

/** Use settings.json secrets. The platform cache may still hold development placeholders. */
export function adoptSettingsFileJwtSecrets(settingsPath: string): void {
  const runtime = readRuntimeSettings(settingsPath);
  loadAuthSecrets({
    accessTokenSecret: runtime.accessTokenSecret,
    refreshTokenSecret: runtime.refreshTokenSecret,
  });
}

export function takeDeployBootstrapPrepError(): string | null {
  const message = prepError;
  prepError = null;
  return message;
}

function installIsComplete(settings: Record<string, unknown>): boolean {
  const install = settings.install;
  if (!install || typeof install !== 'object') return false;
  return Boolean((install as { completedAt?: unknown }).completedAt);
}

function loadSecrets(env: NodeJS.ProcessEnv, cwd: string): DeployBootstrapSecrets {
  const fileArg = env.APPENDO_DEPLOY_SECRETS_FILE?.trim();
  if (fileArg) {
    const filePath = path.resolve(cwd, fileArg);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Secrets file not found: ${filePath}`);
    }
    return mergeDeploySecrets(parseDeploySecretsFile(fs.readFileSync(filePath, 'utf8')), secretsFromEnv(env));
  }
  return secretsFromEnv(env);
}

/**
 * Runs before JWT validation. On a deploy snapshot this materializes settings.json
 * so a fresh tree is install-pending, and so production secrets exist before listen.
 * It does not open a database and it does not run a post-install hook.
 */
export function applyDeployBootstrapSettingsBeforeBoot(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): void {
  prepError = null;
  if (!isDeploySnapshotRoot(cwd)) return;

  const settingsPath = path.join(cwd, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    try {
      ensureDeploySettingsFile(cwd);
    } catch (error: unknown) {
      prepError = error instanceof Error ? error.message : String(error);
      console.error(`[deploy:bootstrap] ${prepError}`);
      return;
    }
  }

  const current = readSettingsDocument(settingsPath);
  if (installIsComplete(current)) return;

  const intent = deployBootstrapEnvIntent(env);
  const productionRequested = env.APPENDO_DEPLOY_NODE_ENV === 'production'
    || env.NODE_ENV === 'production'
    || (current.runtime && typeof current.runtime === 'object'
      && (current.runtime as { nodeEnv?: string }).nodeEnv === 'production');

  let secrets: DeployBootstrapSecrets = {};
  if (intent === 'ready') {
    try {
      secrets = loadSecrets(env, cwd);
      const missing = missingFreshInstallFields(secrets);
      if (missing.length > 0) {
        throw new Error(
          `Fresh install needs ${missing.join(', ')}. Set them in the environment or APPENDO_DEPLOY_SECRETS_FILE.`,
        );
      }
    } catch (error: unknown) {
      prepError = error instanceof Error ? error.message : String(error);
      console.error(`[deploy:bootstrap] ${prepError}`);
      secrets = {};
    }
  } else if (intent === 'partial') {
    const missing = missingFreshInstallFields(secretsFromEnv(env));
    prepError = `Fresh install needs ${missing.join(', ')}. Set them in the environment or APPENDO_DEPLOY_SECRETS_FILE.`;
    console.error(`[deploy:bootstrap] ${prepError}`);
  }

  if (productionRequested && !secrets.nodeEnv) {
    secrets = { ...secrets, nodeEnv: 'production' };
  }

  if (intent !== 'ready' && !productionRequested) return;

  const prepared = prepareSettingsDocument({
    settings: current,
    secrets,
    installComplete: false,
  });
  const nextBody = `${JSON.stringify(prepared.settings, null, 2)}\n`;
  if (fs.readFileSync(settingsPath, 'utf8') !== nextBody) {
    writeSettingsDocument(settingsPath, prepared.settings);
  }
  if (prepared.rotatedJwtSecrets) {
    console.log('[deploy:bootstrap] Wrote production JWT secrets into settings.json.');
  }
}

export async function runServerFirstBootBootstrap(settingsPath: string): Promise<'ready' | 'pending'> {
  const blocked = takeDeployBootstrapPrepError();
  if (blocked) {
    console.error(`[deploy:bootstrap] First boot did not run. The server is staying in install-pending. ${blocked}`);
    return 'pending';
  }

  const cwd = process.cwd();
  if (!isDeploySnapshotRoot(cwd)) return 'pending';
  if (deployBootstrapEnvIntent(process.env) !== 'ready') return 'pending';

  try {
    const secrets = loadSecrets(process.env, cwd);
    const { runDeployBootstrap } = await import('../../../scripts/deploy/runDeployBootstrap');
    await runDeployBootstrap({
      deployRoot: cwd,
      settingsPath,
      secrets,
      postInstall: postInstallHookRequested(process.env),
      forcePostInstall: postInstallHookForced(process.env),
      hookFailure: 'throw',
      invokedFromServer: true,
    });
    return 'ready';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[deploy:bootstrap] First boot failed. The server is staying in install-pending and will not exit. HTTP install stays closed in production. ${message}`,
    );
    return 'pending';
  }
}
