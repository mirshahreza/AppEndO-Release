import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureGitSettings,
  getGitSettingsFromFile,
  saveGitSettingsToFile,
} from '../gitSettingsStore';

describe('gitSettingsStore', () => {
  let tempDir = '';
  let settingsPath = '';

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createTempSettingsPath = () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-git-settings-'));
    settingsPath = path.join(tempDir, 'settings.json');
    fs.writeFileSync(settingsPath, '{}');
    return settingsPath;
  };

  it('seeds default git settings when missing', () => {
    const filePath = createTempSettingsPath();
    const settings = ensureGitSettings(filePath);
    expect(settings.enabled).toBe(false);
    expect(settings.commitMessage?.autoGenerateEnabled).toBe(true);
    expect(getGitSettingsFromFile(filePath).pr?.provider).toBe('github');
  });

  it('persists slim git settings updates', () => {
    const filePath = createTempSettingsPath();
    ensureGitSettings(filePath);
    const saved = saveGitSettingsToFile(filePath, {
      enabled: true,
      pr: { provider: 'github', owner: 'org', repo: 'repo' },
    });
    expect(saved.enabled).toBe(true);
    expect(saved.pr?.owner).toBe('org');
    expect(saved).not.toHaveProperty('remoteUrl');
    expect(saved).not.toHaveProperty('auth');
  });

  it('throws when leftover github oauth client secret remains on disk', () => {
    const filePath = createTempSettingsPath();
    fs.writeFileSync(filePath, JSON.stringify({
      git: {
        enabled: true,
        githubOAuth: { clientId: 'id', clientSecret: 'leftover-secret' },
      },
    }));

    expect(() => getGitSettingsFromFile(filePath)).toThrow(/migrate-settings-secrets/);
  });

  it('strips legacy persisted fields on read', () => {
    const filePath = createTempSettingsPath();
    fs.writeFileSync(filePath, JSON.stringify({
      git: {
        enabled: true,
        remoteUrl: 'https://github.com/org/repo.git',
        defaultBranch: 'main',
        auth: { kind: 'https_pat', tokenEnvKey: 'GIT_TOKEN' },
      },
    }, null, 2));

    const settings = getGitSettingsFromFile(filePath);
    expect(settings.enabled).toBe(true);
    expect(settings).not.toHaveProperty('remoteUrl');
    expect(settings).not.toHaveProperty('auth');
  });
});
