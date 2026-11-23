import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { uploadPackageArtifact } from '../../src/core/packages/PackageArtifactService';
import { readInstallState } from '../../src/core/packages/PackageFileStore';
import { parseSqlServerConnectionUrl } from '../../src/server/db/sqlServerControlPlaneUrl';
import { isInstallComplete, writeInstallSettings } from '../../src/server/db/installSettingsStore';
import { ensureControlPlaneInitialized } from '../../src/server/db/controlPlaneInit';
import { readControlPlaneDatabaseSettings } from '../../src/server/db/controlPlaneDatabase';
import { controlPlaneHasSchema } from '../../src/server/db/controlPlaneInstall';
import { ensureControlPlaneFeatureTables } from '../../src/server/db/ensureControlPlaneFeatureTables';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { closeControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import { usesDefaultJwtSecrets } from '../../src/server/config/authSecrets';
import {
  getSecuritySettingsFromRuntime,
  saveSecuritySettings,
} from '../../src/server/db/securitySettingsStore';
import {
  flushPlatformBlobWrites,
  initializePlatformSettingsCache,
  isPlatformSettingsCacheInitialized,
} from '../../src/server/services/settings/platformSettingsCache';
import { InstallService } from '../../src/server/services/install/install.service';
import { getDefaultPackageLifecycleCoordinator } from '../../src/server/services/package-runtime/packageLifecycle.service';
import type { InstallDatabasePayload } from '../../src/shared/api/contracts/install/types';
import { isControlPlaneProviderId } from '../../src/shared/api/contracts/install/controlPlaneProviders';
import {
  controlPlaneKeyFromParts,
  decidePostInstallHook,
  hookForBundledPackages,
  orderBundledPackages,
  packageBootstrapAction,
  shouldQuarantineInstallState,
  verifyManifestPackageHashes,
  type BundledPackagePlan,
  type DeployBootstrapSecrets,
  type DeployBootstrapStamp,
  type DeployManifest,
  type DeployPostInstallHook,
} from './bootstrapPlan';

// Local copy: the public OSS snapshot ships scripts/deploy but not scripts/release-cut.
function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
import { listInstallStateFiles, quarantineInstallStateDir } from './installStateQuarantine';
import { readSettingsDocument } from './prepareDeploySettings';

const ACTOR = 'deploy-bootstrap';

export type RunDeployBootstrapInput = {
  deployRoot: string;
  settingsPath: string;
  secrets: DeployBootstrapSecrets;
  postInstall: boolean;
  forcePostInstall: boolean;
  /** Server boot keeps listening when the opt-in hook fails. The CLI exits. */
  hookFailure?: 'throw' | 'warn';
  /** Set when `node dist/server.cjs` is already the process that will serve traffic. */
  invokedFromServer?: boolean;
};

function readManifest(deployRoot: string): DeployManifest {
  const manifestPath = path.join(deployRoot, 'MANIFEST.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DeployManifest;
}

function readZipPlan(zipPath: string, artifact: { packageId: string; fileName: string; sha256: string }): BundledPackagePlan {
  const zip = new AdmZip(zipPath);
  const manifestText = zip.readAsText('package.json');
  if (!manifestText.trim()) {
    throw new Error(`${artifact.fileName} has no package.json.`);
  }
  const manifest = JSON.parse(manifestText) as {
    id?: string;
    version?: string;
    dependencies?: Array<{ packageId?: string }>;
  };
  const packageId = String(manifest.id ?? '').trim();
  const version = String(manifest.version ?? '').trim();
  if (!packageId || !version) {
    throw new Error(`${artifact.fileName} package.json needs id and version.`);
  }
  if (packageId !== artifact.packageId) {
    throw new Error(`${artifact.fileName} manifest id is "${packageId}", expected "${artifact.packageId}".`);
  }
  return {
    ...artifact,
    version,
    dependencyIds: (manifest.dependencies ?? [])
      .map((item) => String(item.packageId ?? '').trim())
      .filter(Boolean),
  };
}

function databasePayload(secrets: DeployBootstrapSecrets): InstallDatabasePayload {
  const providerRaw = (secrets.provider ?? 'sqlserver').trim().toLowerCase();
  const provider = isControlPlaneProviderId(providerRaw) ? providerRaw : 'sqlserver';
  const host = String(secrets.host ?? '').trim();
  const namedInstance = provider === 'sqlserver' && host.includes('\\') && !host.includes(',');
  const port = namedInstance
    ? 0
    : (secrets.port && secrets.port > 0 ? secrets.port : (provider === 'mysql' ? 3306 : provider === 'postgresql' ? 5432 : 1433));
  return {
    provider,
    host,
    port,
    database: String(secrets.database ?? '').trim(),
    username: String(secrets.username ?? '').trim(),
    password: secrets.password ?? '',
    encrypt: secrets.encrypt !== false,
    trustServerCertificate: secrets.trustServerCertificate !== false,
    overrideExistingObjects: false,
    seedSampleData: false,
  };
}

/**
 * Full startup creates Sequelize feature tables in ensureControlPlaneBootDataAndCaches,
 * after Prisma is up. First boot was installing packages before that, so CMS seed
 * queried dbo.base_info_title_path on a database that did not have it yet.
 * An empty database gets the greenfield Prisma push. A database that already has
 * tables (for example a 0.0.16 init) gets the additive sync, which keeps those tables.
 */
export async function ensureFirstBootControlPlaneSchema(settingsPath: string): Promise<void> {
  const settings = readControlPlaneDatabaseSettings(settingsPath);
  const existingSchema = await controlPlaneHasSchema(settings);
  const greenfield = settings.provider === 'sqlserver' && !existingSchema;
  console.log(
    `[deploy:bootstrap] Ensuring control-plane schema (${existingSchema ? 'existing database, additive sync' : 'empty database'}) and feature tables before package install…`,
  );
  await ensureControlPlaneInitialized(settingsPath, {
    pushSchema: true,
    sqlServerGreenfieldPush: greenfield,
  });
  await ensureControlPlaneFeatureTables(settingsPath);
}

/**
 * Platform cache seed reads settings.example.json, whose JWT values are development
 * placeholders. An older database can also still hold those placeholders. Production
 * boot then exits with "configure platform JWT secrets" even though settings.json
 * already has the secrets written for this deploy.
 */
async function publishSettingsJwtSecrets(settingsPath: string): Promise<void> {
  const runtimeSecrets = getSecuritySettingsFromRuntime(settingsPath);
  if (usesDefaultJwtSecrets(runtimeSecrets)) return;
  if (!isPlatformSettingsCacheInitialized()) {
    await initializePlatformSettingsCache({}, null);
  }
  saveSecuritySettings(settingsPath, runtimeSecrets);
  await flushPlatformBlobWrites();
  console.log('[deploy:bootstrap] Stored JWT secrets from settings.json.');
}

async function runPlatformInstall(settingsPath: string, secrets: DeployBootstrapSecrets): Promise<void> {
  if (isInstallComplete(settingsPath)) {
    console.log('[deploy:bootstrap] Platform install already complete.');
    return;
  }
  const service = new InstallService({ settingsPath });
  const install = readSettingsDocument(settingsPath).install as { databaseInitialized?: boolean } | undefined;
  if (!install?.databaseInitialized) {
    console.log('[deploy:bootstrap] Saving database settings and initializing schema…');
    await service.saveDatabase(databasePayload(secrets));
    await service.initDatabase();
  }
  console.log('[deploy:bootstrap] Creating admin and completing install…');
  await service.saveCapabilities({
    capabilities: ['service', 'platform', 'worker'],
    nodeName: secrets.nodeName?.trim() || 'production',
  });
  await service.configureAdmin({
    username: String(secrets.adminUsername ?? ''),
    email: String(secrets.adminEmail ?? ''),
    password: String(secrets.adminPassword ?? ''),
    confirmPassword: String(secrets.adminPassword ?? ''),
    firstName: 'Admin',
    lastName: 'User',
  });
  await service.skipEmail();
}

function readControlPlaneKey(settingsPath: string): string {
  const settings = readSettingsDocument(settingsPath);
  const database = settings.database as { provider?: string; url?: string } | undefined;
  const provider = String(database?.provider ?? 'sqlserver').trim().toLowerCase() || 'sqlserver';
  if (provider === 'sqlserver' && database?.url) {
    const parsed = parseSqlServerConnectionUrl(database.url);
    return controlPlaneKeyFromParts({
      provider,
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
    });
  }
  return controlPlaneKeyFromParts({
    provider,
    host: 'localhost',
    port: 0,
    database: '',
  });
}

function stampPath(deployRoot: string): string {
  return path.join(deployRoot, 'packages-storage', 'deploy-bootstrap.json');
}

function readStamp(filePath: string): DeployBootstrapStamp | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as DeployBootstrapStamp;
    if (parsed?.schema !== 'deploy-bootstrap' || !Array.isArray(parsed.packages)) return null;
    return {
      ...parsed,
      postInstallHookIds: Array.isArray(parsed.postInstallHookIds) ? parsed.postInstallHookIds : [],
    };
  } catch {
    return null;
  }
}

function writeStamp(filePath: string, stamp: DeployBootstrapStamp): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(stamp, null, 2)}\n`, 'utf8');
}

function installedVersion(packageId: string): string | null {
  const state = readInstallState(packageId);
  if (!state || state.status !== 'installed' || !state.activeVersion) return null;
  return state.activeVersion;
}

async function installBundledPackage(
  plan: BundledPackagePlan,
  zipPath: string,
  action: 'install' | 'reinstall',
): Promise<void> {
  const buffer = fs.readFileSync(zipPath);
  const uploaded = await uploadPackageArtifact(buffer, plan.fileName, ACTOR);
  if (!uploaded.success) {
    if (!uploaded.error.includes('already exists')) {
      throw new Error(uploaded.error);
    }
  } else if (uploaded.version !== plan.version) {
    throw new Error(`Uploaded ${plan.packageId} version ${uploaded.version}, manifest zip says ${plan.version}.`);
  }

  const coordinator = getDefaultPackageLifecycleCoordinator();
  const result = action === 'reinstall'
    ? await coordinator.reinstall(plan.packageId, ACTOR, { version: plan.version })
    : await coordinator.install(plan.packageId, ACTOR, { version: plan.version });
  if (!result.success) {
    throw new Error(result.error);
  }
  if (result.deploymentStatus === 'pending') {
    const applied = await coordinator.applyDeployment(plan.packageId, ACTOR, null);
    if (!applied.success) {
      throw new Error(applied.error);
    }
  }
  console.log(
    `[deploy:bootstrap] ${plan.packageId}@${plan.version} ${result.idempotent ? 'already installed' : 'installed'}.`,
  );
}

function readDeployHooks(deployRoot: string): DeployPostInstallHook[] {
  const filePath = path.join(deployRoot, 'deploy-hooks.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { hooks?: DeployPostInstallHook[] };
    return Array.isArray(parsed.hooks) ? parsed.hooks : [];
  } catch {
    return [];
  }
}

function sourceRootFor(deployRoot: string): string {
  const nestedPackageJson = path.join(deployRoot, 'source', 'package.json');
  if (fs.existsSync(nestedPackageJson)) return path.join(deployRoot, 'source');
  return deployRoot;
}

function runNpmScript(cwd: string, script: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const npmExec = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmExec, ['run', script, '--', ...args], {
      cwd,
      env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} exited with code ${code ?? 'null'}.`));
    });
  });
}

export async function runDeployBootstrap(input: RunDeployBootstrapInput): Promise<void> {
  try {
    await runPlatformInstall(input.settingsPath, input.secrets);
    await ensureFirstBootControlPlaneSchema(input.settingsPath);
    await publishSettingsJwtSecrets(input.settingsPath);
    const manifest = readManifest(input.deployRoot);
    const packagesDir = path.join(input.deployRoot, 'packages');
    const hashes = new Map<string, string>();
    for (const artifact of manifest.packageArtifacts ?? []) {
      const zipPath = path.join(packagesDir, artifact.fileName);
      if (fs.existsSync(zipPath)) {
        hashes.set(artifact.fileName, sha256File(zipPath));
      }
    }
    const verified = verifyManifestPackageHashes(manifest, hashes);
    if (!verified.ok) {
      throw new Error(verified.error);
    }

    const storageRoot = path.join(input.deployRoot, 'packages-storage');
    const stampFile = stampPath(input.deployRoot);
    const controlPlaneKey = readControlPlaneKey(input.settingsPath);
    let stamp = readStamp(stampFile);
    const installedDir = path.join(storageRoot, 'installed');
    if (shouldQuarantineInstallState({
      hasInstallStateFiles: listInstallStateFiles(installedDir).length > 0,
      stamp,
      controlPlaneKey,
    })) {
      const moved = quarantineInstallStateDir(storageRoot);
      console.log(`[deploy:bootstrap] Moved stale package install-state aside: ${moved}`);
      stamp = {
        schema: 'deploy-bootstrap',
        schemaVersion: 1,
        controlPlaneKey,
        packages: [],
        postInstallHookIds: [],
      };
    }

    const plans = orderBundledPackages(verified.artifacts.map((artifact) => (
      readZipPlan(path.join(packagesDir, artifact.fileName), artifact)
    )));
    const recorded = [...(stamp?.packages ?? [])];
    for (const plan of plans) {
      const action = packageBootstrapAction({
        packageId: plan.packageId,
        version: plan.version,
        sha256: plan.sha256,
        installedVersion: installedVersion(plan.packageId),
        stamp,
        controlPlaneKey,
      });
      if (action === 'skip') {
        console.log(`[deploy:bootstrap] ${plan.packageId}@${plan.version} matches this database. Skipping.`);
        continue;
      }
      await installBundledPackage(plan, path.join(packagesDir, plan.fileName), action);
      const next = { packageId: plan.packageId, version: plan.version, sha256: plan.sha256 };
      const index = recorded.findIndex((item) => item.packageId === plan.packageId);
      if (index >= 0) recorded[index] = next;
      else recorded.push(next);
      stamp = {
        schema: 'deploy-bootstrap',
        schemaVersion: 1,
        controlPlaneKey,
        packages: recorded,
        postInstallHookIds: stamp?.postInstallHookIds ?? [],
      };
      writeStamp(stampFile, stamp);
    }

    const hook = hookForBundledPackages(
      readDeployHooks(input.deployRoot),
      plans.map((plan) => plan.packageId),
    );
    const decision = decidePostInstallHook({
      hook,
      requested: input.postInstall,
      force: input.forcePostInstall,
      requiredEnvValue: hook ? process.env[hook.requiresEnv] : undefined,
      alreadyRan: Boolean(hook && stamp?.postInstallHookIds.includes(hook.id)),
    });
    let hookOk = decision.action !== 'run';
    if (decision.action === 'error') {
      hookOk = false;
      if (input.hookFailure === 'warn') {
        console.error(`[deploy:bootstrap] ${decision.error}`);
      } else {
        throw new Error(decision.error);
      }
    } else if (decision.action === 'skip') {
      console.log(`[deploy:bootstrap] ${decision.reason}`);
      hookOk = true;
    } else {
      try {
        const sourceRoot = sourceRootFor(input.deployRoot);
        const sourceSettings = path.join(sourceRoot, 'settings.json');
        if (path.resolve(sourceSettings) !== path.resolve(input.settingsPath)) {
          fs.copyFileSync(input.settingsPath, sourceSettings);
        }
        console.log(`[deploy:bootstrap] Running post-install hook ${decision.hook.npmScript}…`);
        await runNpmScript(sourceRoot, decision.hook.npmScript, decision.hook.args, process.env);
        const hookIds = new Set(stamp?.postInstallHookIds ?? []);
        hookIds.add(decision.hook.id);
        writeStamp(stampFile, {
          schema: 'deploy-bootstrap',
          schemaVersion: 1,
          controlPlaneKey,
          packages: recorded,
          postInstallHookIds: [...hookIds],
        });
        hookOk = true;
      } catch (error: unknown) {
        hookOk = false;
        const message = error instanceof Error ? error.message : String(error);
        if (input.hookFailure === 'warn') {
          console.error(`[deploy:bootstrap] Post-install hook failed: ${message}`);
        } else {
          throw error;
        }
      }
    }

    if (!hookOk) {
      throw new Error('Post-install hook did not finish. Install is still pending so the next boot can retry it.');
    }

    if (!isInstallComplete(input.settingsPath)) {
      writeInstallSettings(input.settingsPath, {
        pending: false,
        completedAt: new Date().toISOString(),
      });
    }

    if (input.invokedFromServer) {
      console.log('[deploy:bootstrap] First boot finished. Starting the full server.');
    } else {
      console.log('[deploy:bootstrap] Ready. Start the server from the deploy root with: node dist/server.cjs');
    }
  } finally {
    await closePrismaControlPlane().catch(() => undefined);
    await closeControlPlaneSequelize().catch(() => undefined);
  }
}
