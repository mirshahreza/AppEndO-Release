import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readGitCredentials } from '../gitCredentialStore';
import { persistGitAuthCredentials } from '../gitAuthPersistence';
import { startGitCredentialVaultForTests, stopGitCredentialVaultForTests } from './gitCredentialVaultHarness';

describe('gitAuthPersistence', () => {
  let tempDir = '';
  let previousCwd = '';
  let sequelize: Sequelize;

  beforeEach(async () => {
    sequelize = await startGitCredentialVaultForTests();
    previousCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-git-auth-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd || process.cwd());
    const credentialPath = tempDir ? path.join(tempDir, '.appendo-git-credentials.json') : '';
    if (credentialPath && fs.existsSync(credentialPath)) {
      fs.unlinkSync(credentialPath);
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

  it('persists HTTPS auth in gitignored credential store', async () => {
    await persistGitAuthCredentials({
      kind: 'https_pat',
      username: 'octocat',
      token: 'gho_test_token',
    });

    const saved = await readGitCredentials();
    expect(saved.kind).toBe('https_pat');
    expect(saved.username).toBe('octocat');
    expect(saved.token).toBe('gho_test_token');

    const onDisk = fs.readFileSync(path.join(tempDir, '.appendo-git-credentials.json'), 'utf8');
    expect(onDisk).not.toContain('gho_test_token');
    expect(JSON.parse(onDisk).hasToken).toBe(true);
    expect(JSON.parse(onDisk).token).toBeUndefined();
  });
});
