#!/usr/bin/env tsx
/**
 * Apply control-plane schema (and optional Hawiety package) to a clone-line database
 * using the operator monorepo toolchain + clone settings.json (with --inherit-credentials).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';
import { RELEASE_CUT_CLONE_PROFILES } from './releaseCutCloneProfiles';
import { runCloneInstallWizard } from './run-clone-install-wizard';
import { isInstallComplete } from '../../src/server/db/installSettingsStore';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { closeControlPlaneSequelize } from '../../src/server/db/controlPlaneSequelize';

const MONOREPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETTINGS_BACKUP = path.join(MONOREPO_ROOT, 'settings.json.provision-clone-backup');

function parseProfile(argv: string[]): ReleaseCutCloneProfileId {
  const idx = argv.indexOf('--profile');
  const fromFlag = idx >= 0 ? argv[idx + 1] : undefined;
  const positional = argv.find((a) => a === 'oss' || a === 'hawiety');
  const profile = fromFlag ?? positional;
  if (!profile || !RELEASE_CUT_CLONE_PROFILES[profile as ReleaseCutCloneProfileId]) {
    throw new Error(
      'Usage: npx tsx scripts/release-cut/provision-clone-database.ts --profile oss|hawiety',
    );
  }
  return profile as ReleaseCutCloneProfileId;
}

function cloneSettingsPath(profileId: ReleaseCutCloneProfileId): string {
  const repoName = profileId === 'oss' ? 'AppEndO-Release' : 'AppEndO-Hawiety';
  const settingsPath = path.join(MONOREPO_ROOT, '..', repoName, 'source', 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    throw new Error(`Missing ${settingsPath} — run clone:bootstrap -- --profile ${profileId} --inherit-credentials --force`);
  }
  return settingsPath;
}

function runNpm(script: string, extraArgs: string[] = []): void {
  const child = spawnSync('npm', ['run', script, '--', ...extraArgs], {
    cwd: MONOREPO_ROOT,
    encoding: 'utf8',
    shell: true,
    stdio: 'inherit',
  });
  if (child.status !== 0) {
    throw new Error(`npm run ${script} failed`);
  }
}

async function main(): Promise<void> {
  if (process.platform === 'win32') {
    process.env.APPENDO_CLONE_WINDOWS_SQL_TRUSTED =
      process.env.APPENDO_CLONE_WINDOWS_SQL_TRUSTED ?? '1';
  }

  const profileId = parseProfile(process.argv.slice(2));
  const skipHawietyInstall = process.argv.includes('--skip-hawiety-install');
  const cloneSettings = cloneSettingsPath(profileId);

  if (!isInstallComplete(cloneSettings)) {
    await runCloneInstallWizard(profileId);
  }

  if (fs.existsSync(path.join(MONOREPO_ROOT, 'settings.json'))) {
    fs.copyFileSync(path.join(MONOREPO_ROOT, 'settings.json'), SETTINGS_BACKUP);
  }
  fs.copyFileSync(cloneSettings, path.join(MONOREPO_ROOT, 'settings.json'));
  process.env.APPENDO_SETTINGS_PATH = path.join(MONOREPO_ROOT, 'settings.json');

  try {
    runNpm('schema:install-extensions', ['--force']);
    if (profileId === 'hawiety') {
      if (!skipHawietyInstall) {
        runNpm('hawiety:install', ['--skip-legacy-parity']);
      }
      runNpm('schema:install-extensions:hwy', ['--force']);
    }
    console.log(`[clone:provision] Done for profile=${profileId} (database from clone settings).`);
  } finally {
    if (fs.existsSync(SETTINGS_BACKUP)) {
      fs.copyFileSync(SETTINGS_BACKUP, path.join(MONOREPO_ROOT, 'settings.json'));
      fs.rmSync(SETTINGS_BACKUP, { force: true });
    }
    await closePrismaControlPlane().catch(() => undefined);
    await closeControlPlaneSequelize().catch(() => undefined);
    delete process.env.APPENDO_SETTINGS_PATH;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[clone:provision] failed: ${message}`);
  process.exitCode = 1;
});
