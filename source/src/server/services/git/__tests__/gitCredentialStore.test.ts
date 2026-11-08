import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REDACTED_GIT_TOKEN } from '../../../../shared/api/contracts/git/constants';
import { getSecret } from '../../../domain/security/credentialVault/credentialVault';
import {
  GIT_CREDENTIAL_TOKEN_PURPOSE,
  GIT_CREDENTIAL_VAULT_OWNER_ID,
  GIT_CREDENTIAL_VAULT_OWNER_TYPE,
  LEGACY_GIT_SECRET_ERROR,
} from '../gitCredentialVault';
import { clearGitCredentials, readGitCredentials, writeGitCredentials } from '../gitCredentialStore';
import { startGitCredentialVaultForTests, stopGitCredentialVaultForTests } from './gitCredentialVaultHarness';

describe('gitCredentialStore vault', () => {
  let tempDir = '';
  let previousCwd = '';
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

  const enterTempCwd = (): string => {
    previousCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-git-cred-'));
    process.chdir(tempDir);
    return path.join(tempDir, '.appendo-git-credentials.json');
  };

  it('stores the PAT in the vault and keeps metadata only on disk', async () => {
    const credentialPath = enterTempCwd();
    await writeGitCredentials({
      kind: 'https_pat',
      username: 'octocat',
      token: 'gho_unit_test_token',
    });

    const saved = await readGitCredentials();
    expect(saved.token).toBe('gho_unit_test_token');
    expect(await getSecret(
      GIT_CREDENTIAL_VAULT_OWNER_TYPE,
      GIT_CREDENTIAL_VAULT_OWNER_ID,
      GIT_CREDENTIAL_TOKEN_PURPOSE,
    )).toBe('gho_unit_test_token');

    const onDisk = JSON.parse(fs.readFileSync(credentialPath, 'utf8')) as Record<string, unknown>;
    expect(onDisk.hasToken).toBe(true);
    expect(onDisk.token).toBeUndefined();
    expect(JSON.stringify(onDisk)).not.toContain('gho_unit_test_token');
  });

  it('keeps the vault token when the incoming token is blank or redacted', async () => {
    enterTempCwd();
    await writeGitCredentials({
      kind: 'https_pat',
      username: 'octocat',
      token: 'gho_original',
    });

    await writeGitCredentials({
      kind: 'https_pat',
      username: 'octocat',
      token: REDACTED_GIT_TOKEN,
    });
    expect((await readGitCredentials()).token).toBe('gho_original');

    await writeGitCredentials({
      kind: 'https_pat',
      username: 'octocat',
    });
    expect((await readGitCredentials()).token).toBe('gho_original');
  });

  it('throws when a leftover encrypted blob is still on disk', async () => {
    const credentialPath = enterTempCwd();
    fs.writeFileSync(
      credentialPath,
      `${JSON.stringify({
        kind: 'https_pat',
        username: 'octocat',
        token: { v: 1, iv: 'YQ==', authTag: 'Yg==', ciphertext: 'Yw==' },
      }, null, 2)}\n`,
      'utf8',
    );

    await expect(readGitCredentials()).rejects.toThrow(LEGACY_GIT_SECRET_ERROR);
  });

  it('throws when a leftover plaintext token is still on disk', async () => {
    const credentialPath = enterTempCwd();
    fs.writeFileSync(
      credentialPath,
      `${JSON.stringify({
        kind: 'https_pat',
        username: 'octocat',
        token: 'gho_legacy_plaintext',
      }, null, 2)}\n`,
      'utf8',
    );

    await expect(readGitCredentials()).rejects.toThrow(LEGACY_GIT_SECRET_ERROR);
  });
});
