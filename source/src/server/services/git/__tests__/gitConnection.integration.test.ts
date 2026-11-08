import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GIT_SETTINGS } from '../../../../shared/api/contracts/git/constants';
import { saveGitSettingsToFile } from '../../../db/gitSettingsStore';
import { clearGitCredentials, writeGitCredentials } from '../gitCredentialStore';
import { readGitRemoteOrigin } from '../gitNativeConfig';
import { resolveGitStatusSnapshot, evaluateNativeGitIntegrationReadiness, shouldAutoEnableGitFromNative } from '../gitConnection';
import { startGitCredentialVaultForTests, stopGitCredentialVaultForTests } from './gitCredentialVaultHarness';
import type { Sequelize } from 'sequelize';

describe('gitConnection integration', () => {
  let tempDir = '';
  let previousCwd = '';
  let settingsPath = '';
  let sequelize: Sequelize;

  beforeEach(async () => {
    sequelize = await startGitCredentialVaultForTests();
  });

  afterEach(async () => {
    if (tempDir) {
      await clearGitCredentials();
      process.chdir(previousCwd || process.cwd());
    }
    await stopGitCredentialVaultForTests(sequelize);
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Windows may keep the temp directory locked briefly after chdir.
      }
      tempDir = '';
    }
  });

  const initGitUser = (cwd: string): void => {
    execFileSync('git', ['config', 'user.email', 'test@appendo.local'], { cwd, encoding: 'utf8' });
    execFileSync('git', ['config', 'user.name', 'AppEndO Test'], { cwd, encoding: 'utf8' });
  };

  const setupWorkspaceRepo = (): void => {
    previousCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-git-status-'));
    process.chdir(tempDir);
    settingsPath = path.join(tempDir, 'settings.json');
    fs.writeFileSync(settingsPath, `${JSON.stringify({ git: { enabled: false } }, null, 2)}\n`, 'utf8');
    execFileSync('git', ['init', '-b', 'main'], { encoding: 'utf8' });
    initGitUser(tempDir);
  };

  const readOriginFromGitCli = (): string => (
    execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim()
  );

  it('reports status remoteUrl matching git config origin', async () => {
    setupWorkspaceRepo();
    const remoteUrl = 'https://github.com/org/repo.git';
    execFileSync('git', ['remote', 'add', 'origin', remoteUrl], { encoding: 'utf8' });

    const settings = saveGitSettingsToFile(settingsPath, {
      ...DEFAULT_GIT_SETTINGS,
      enabled: true,
    });

    const snapshot = await resolveGitStatusSnapshot(settings);
    const origin = await readGitRemoteOrigin();
    const cliUrl = readOriginFromGitCli();

    expect(cliUrl).toBe(remoteUrl);
    expect(origin?.remoteUrl).toBe(cliUrl);
    expect(snapshot.remoteUrl).toBe(cliUrl);
    expect(snapshot.remoteName).toBe('origin');
  });

  it('reports defaultBranch from native git config', async () => {
    setupWorkspaceRepo();
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/org/repo.git'], { encoding: 'utf8' });
    execFileSync('git', ['config', 'init.defaultBranch', 'develop'], { encoding: 'utf8' });

    const settings = saveGitSettingsToFile(settingsPath, {
      ...DEFAULT_GIT_SETTINGS,
      enabled: true,
    });

    const snapshot = await resolveGitStatusSnapshot(settings);

    expect(snapshot.defaultBranch).toBe('develop');
    expect(snapshot.isRepository).toBe(true);
  });

  it('derives hasCredential from credential store not settings.json', async () => {
    setupWorkspaceRepo();
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/org/repo.git'], { encoding: 'utf8' });
    await writeGitCredentials({ kind: 'https_pat', token: 'gho_test', username: 'octocat' });

    const settings = saveGitSettingsToFile(settingsPath, {
      ...DEFAULT_GIT_SETTINGS,
      enabled: true,
    });

    const snapshot = await resolveGitStatusSnapshot(settings);

    expect(snapshot.hasCredential).toBe(true);
    expect(snapshot.usesNativeAuth).toBe(false);
    expect(JSON.stringify(settings)).not.toContain('gho_test');
  });

  it('marks usesNativeAuth when remote is reachable without AppEndO credentials', async () => {
    setupWorkspaceRepo();
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/org/repo.git'], { encoding: 'utf8' });

    const settings = saveGitSettingsToFile(settingsPath, {
      ...DEFAULT_GIT_SETTINGS,
      enabled: true,
    });

    const snapshot = await resolveGitStatusSnapshot(settings);

    expect(snapshot.hasCredential).toBe(false);
    expect(snapshot.usesNativeAuth).toBe(false);
    expect(snapshot.isConfigured).toBe(false);
  });

  it('auto-enables integration for local-only native repositories', async () => {
    setupWorkspaceRepo();

    const readiness = await evaluateNativeGitIntegrationReadiness();

    expect(readiness.isRepository).toBe(true);
    expect(readiness.hasRemote).toBe(false);
    expect(readiness.shouldAutoEnable).toBe(true);
    expect(shouldAutoEnableGitFromNative(DEFAULT_GIT_SETTINGS, readiness)).toBe(true);
    expect(shouldAutoEnableGitFromNative({
      ...DEFAULT_GIT_SETTINGS,
      integrationSuppressed: true,
    }, readiness)).toBe(false);
  });
});
