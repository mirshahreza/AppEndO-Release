import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureOriginRemote,
  ensureWorkspaceGitignore,
  initGitRepository,
  isGitRepository,
} from '../gitNativeConfig';

describe('gitNativeConfig', () => {
  let tempDir = '';
  let previousCwd = '';

  afterEach(() => {
    process.chdir(previousCwd || process.cwd());
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Windows may keep the temp directory locked briefly after chdir.
      }
      tempDir = '';
    }
  });

  const setupTempRepo = (withGit = false): string => {
    previousCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-git-native-'));
    process.chdir(tempDir);
    if (withGit) {
      execFileSync('git', ['init', '-b', 'main'], { encoding: 'utf8' });
      execFileSync('git', ['config', 'user.email', 'test@appendo.local'], { encoding: 'utf8' });
      execFileSync('git', ['config', 'user.name', 'AppEndO Test'], { encoding: 'utf8' });
    }
    return tempDir;
  };

  it('initializes a repository and writes gitignore', async () => {
    setupTempRepo(false);
    expect(isGitRepository()).toBe(false);

    await initGitRepository('main');
    expect(isGitRepository()).toBe(true);
    expect(ensureWorkspaceGitignore()).toBe(true);
    expect(fs.existsSync('.gitignore')).toBe(true);
    expect(ensureWorkspaceGitignore()).toBe(false);
  });

  it('adds and updates origin remote', async () => {
    setupTempRepo(true);

    const added = await ensureOriginRemote('https://github.com/org/repo.git');
    expect(added.action).toBe('added');

    const unchanged = await ensureOriginRemote('https://github.com/org/repo.git');
    expect(unchanged.action).toBe('unchanged');

    const updated = await ensureOriginRemote('https://github.com/org/other.git');
    expect(updated.action).toBe('updated');
    expect(updated.previousUrl).toBe('https://github.com/org/repo.git');
  });
});
