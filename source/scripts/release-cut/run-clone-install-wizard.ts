#!/usr/bin/env tsx
/**
 * Headless install wizard for a clone-line database (uses isolated work settings file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InstallDatabasePayload } from '../../src/shared/api/contracts/install/types';
import { readDefaultDataSourceSecretInputFromSettings } from '../../src/server/config/dataSourceSecrets';
import { readSettingsObject } from '../../src/server/config/settingsFile';
import { isInstallComplete, readInstallSettings } from '../../src/server/db/installSettingsStore';
import { readInstallDatabaseDraftFromSettings } from '../../src/server/db/controlPlaneInstall';
import { InstallService } from '../../src/server/services/install/install.service';
import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';
import { RELEASE_CUT_CLONE_PROFILES } from './releaseCutCloneProfiles';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { closeControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';
import { CLONE_SQL_LOGIN, applyCloneSqlLoginUsernameToSettings, ensureCloneSqlLogin } from './ensure-clone-sql-login';

const MONOREPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK_DIR = path.join(MONOREPO_ROOT, '.appendo-clone-work');

function parseProfile(argv: string[]): ReleaseCutCloneProfileId {
  const idx = argv.indexOf('--profile');
  const fromFlag = idx >= 0 ? argv[idx + 1] : undefined;
  const positional = argv.find((a) => a === 'oss' || a === 'hawiety');
  const profile = fromFlag ?? positional;
  if (!profile || !RELEASE_CUT_CLONE_PROFILES[profile as ReleaseCutCloneProfileId]) {
    throw new Error('Usage: run-clone-install-wizard.ts --profile oss|hawiety');
  }
  return profile as ReleaseCutCloneProfileId;
}

function clonePaths(profileId: ReleaseCutCloneProfileId): {
  repoName: string;
  sourceSettings: string;
  rootSettings: string;
} {
  const repoName = profileId === 'oss' ? 'AppEndO-Release' : 'AppEndO-Hawiety';
  const sourceSettings = path.join(MONOREPO_ROOT, '..', repoName, 'source', 'settings.json');
  const rootSettings = path.join(MONOREPO_ROOT, '..', repoName, 'settings.json');
  if (!fs.existsSync(sourceSettings)) {
    throw new Error(`Missing ${sourceSettings} — run clone:bootstrap with --inherit-credentials first`);
  }
  return { repoName, sourceSettings, rootSettings };
}

function buildDatabasePayload(settingsPath: string): InstallDatabasePayload {
  const secrets = readDefaultDataSourceSecretInputFromSettings(settingsPath, { allowPlaintext: true });
  const draft = readInstallDatabaseDraftFromSettings(settingsPath);
  if (draft) {
    return {
      provider: draft.provider,
      host: draft.host,
      port: draft.port,
      database: draft.database,
      username: draft.username,
      password: secrets.password ?? '',
      encrypt: draft.encrypt,
      trustServerCertificate: draft.trustServerCertificate,
      overrideExistingObjects: false,
      seedSampleData: false,
    };
  }

  const settings = readSettingsObject(settingsPath);
  const sources = settings.dataSources;
  const ds =
    Array.isArray(sources) && sources.length > 0 && typeof sources[0] === 'object'
      ? (sources[0] as Record<string, unknown>)
      : undefined;
  if (!ds) {
    throw new Error('settings missing database draft and dataSources');
  }

  return {
    provider: 'sqlserver',
    host: String(ds.host ?? 'localhost'),
    port: Number(ds.port ?? 0),
    database: String(ds.database ?? ''),
    username: String(ds.username ?? 'sa'),
    password: secrets.password ?? '',
    encrypt: ds.encrypt !== false,
    trustServerCertificate: ds.trustServerCertificate !== false,
    overrideExistingObjects: true,
    seedSampleData: false,
  };
}

export async function runCloneInstallWizard(profileId: ReleaseCutCloneProfileId): Promise<string> {
  const { sourceSettings, rootSettings } = clonePaths(profileId);
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const workSettings = path.join(WORK_DIR, `${profileId}.settings.json`);
  fs.copyFileSync(sourceSettings, workSettings);
  process.env.APPENDO_SETTINGS_PATH = workSettings;
  await closeControlPlaneSequelize().catch(() => undefined);
  if (isInstallComplete(workSettings)) {
    console.log(`[clone:install-wizard] ${profileId}: already complete — syncing settings to clone.`);
    fs.copyFileSync(workSettings, sourceSettings);
    if (fs.existsSync(path.dirname(rootSettings))) {
      fs.copyFileSync(workSettings, rootSettings);
    }
    return workSettings;
  }

  const install = readInstallSettings(workSettings);
  const provisionalPayload = buildDatabasePayload(workSettings);
  let provisionalDbPassword: string | undefined;
  if (!provisionalPayload.password?.trim() && process.platform === 'win32') {
    const cloneSqlPassword = ensureCloneSqlLogin(provisionalPayload.database);
    applyCloneSqlLoginUsernameToSettings(workSettings);
    provisionalDbPassword = cloneSqlPassword;
  }

  const service = new InstallService({ settingsPath: workSettings });
  let dbPayload = buildDatabasePayload(workSettings);
  if (provisionalDbPassword) {
    dbPayload = {
      ...dbPayload,
      username: CLONE_SQL_LOGIN,
      password: provisionalDbPassword,
    };
  }

  if (!install.databaseInitialized) {
    console.log(`[clone:install-wizard] ${profileId}: saveDatabase + initDatabase…`);
    await service.saveDatabase(dbPayload);
    await service.initDatabase();
  }

  console.log(`[clone:install-wizard] ${profileId}: capabilities + admin + skip email + complete…`);
  await service.saveCapabilities({
    capabilities: ['service', 'platform', 'worker'],
    nodeName: profileId === 'hawiety' ? 'clone-hawiety' : 'clone-oss',
  });
  await service.configureAdmin({
    username: 'admin',
    email: 'admin@append.os',
    password: 'admin123',
    confirmPassword: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
  });
  await service.skipEmail();
  await service.complete();

  fs.copyFileSync(workSettings, sourceSettings);
  fs.copyFileSync(workSettings, rootSettings);
  console.log(`[clone:install-wizard] ${profileId}: done → ${sourceSettings}`);
  return workSettings;
}

async function main(): Promise<void> {
  const profileId = parseProfile(process.argv.slice(2));
  try {
    await runCloneInstallWizard(profileId);
  } finally {
    await closePrismaControlPlane().catch(() => undefined);
  }
}

const isMain =
  process.argv[1] != null &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[clone:install-wizard] failed: ${message}`);
    process.exitCode = 1;
  });
}
