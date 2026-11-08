import { afterEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CREDENTIAL_KEY_VERSION_ENV,
  CREDENTIAL_MASTER_KEY_ENV,
  CREDENTIAL_PREVIOUS_KEY_ENV,
  encryptCredential,
  resetCredentialMasterKeyCacheForTests,
} from '../../domain/security/credentialVault/credentialCrypto';
import { writeSettingsObject } from '../settingsFile';
import {
  DEFAULT_DATA_SOURCE_PLAINTEXT_PASSWORD_ERROR,
  PREVIOUS_KEY_REQUIRED_FOR_ROTATE,
  dataSourceHasStoredPassword,
  parseDiskDataSourceSecretInput,
  readDefaultDataSourceSecretInputFromSettings,
  resolveDataSourcePassword,
  rotateDefaultDataSourcePasswordCipher,
  toPersistedDefaultSecretFields,
} from '../dataSourceSecrets';

describe('resolveDataSourcePassword', () => {
  const originalPassword = process.env.PGPASSWORD;
  const originalMaster = process.env[CREDENTIAL_MASTER_KEY_ENV];

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.PGPASSWORD;
    } else {
      process.env.PGPASSWORD = originalPassword;
    }
    if (originalMaster === undefined) {
      delete process.env[CREDENTIAL_MASTER_KEY_ENV];
    } else {
      process.env[CREDENTIAL_MASTER_KEY_ENV] = originalMaster;
    }
    resetCredentialMasterKeyCacheForTests();
  });

  it('returns inline password when set explicitly', () => {
    expect(resolveDataSourcePassword({ password: 'secret123' })).toBe('secret123');
  });

  it('reads PGPASSWORD env when password is placeholder', () => {
    process.env.PGPASSWORD = 'from-env';
    expect(resolveDataSourcePassword({ password: 'PGPASSWORD' })).toBe('from-env');
  });

  it('reads custom env key when passwordEnvKey is provided', () => {
    process.env.APPENDO_DB_PASSWORD = 'custom-env';
    expect(resolveDataSourcePassword({
      password: 'PGPASSWORD',
      passwordEnvKey: 'APPENDO_DB_PASSWORD',
    })).toBe('custom-env');
    delete process.env.APPENDO_DB_PASSWORD;
  });

  it('decrypts passwordCipher when env and inline password are empty', () => {
    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    resetCredentialMasterKeyCacheForTests();
    const passwordCipher = encryptCredential('cipher-secret');
    expect(resolveDataSourcePassword({ passwordCipher })).toBe('cipher-secret');
  });

  it('does not persist env-resolved passwords onto disk fields', () => {
    process.env.PGPASSWORD = 'from-env';
    const persisted = toPersistedDefaultSecretFields({
      password: 'from-env',
      passwordEnvKey: 'PGPASSWORD',
    });
    expect(persisted.passwordCipher).toBeUndefined();
    expect(persisted.passwordEnvKey).toBe('PGPASSWORD');
  });

  it('rejects leftover plaintext passwords on disk', () => {
    expect(() => parseDiskDataSourceSecretInput({ password: 'leftover-secret' })).toThrow(
      DEFAULT_DATA_SOURCE_PLAINTEXT_PASSWORD_ERROR,
    );
  });

  it('treats a cipher or env as a stored password', () => {
    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    resetCredentialMasterKeyCacheForTests();
    expect(dataSourceHasStoredPassword({
      passwordCipher: encryptCredential('x'),
    })).toBe(true);
    process.env.PGPASSWORD = 'from-env';
    expect(dataSourceHasStoredPassword({ passwordEnvKey: 'PGPASSWORD' })).toBe(true);
  });
});

describe('rotateDefaultDataSourcePasswordCipher', () => {
  const originalMaster = process.env[CREDENTIAL_MASTER_KEY_ENV];
  const originalVersion = process.env[CREDENTIAL_KEY_VERSION_ENV];
  const originalPrevious = process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
  const tempFiles: string[] = [];

  const restoreEnv = (): void => {
    if (originalMaster === undefined) delete process.env[CREDENTIAL_MASTER_KEY_ENV];
    else process.env[CREDENTIAL_MASTER_KEY_ENV] = originalMaster;
    if (originalVersion === undefined) delete process.env[CREDENTIAL_KEY_VERSION_ENV];
    else process.env[CREDENTIAL_KEY_VERSION_ENV] = originalVersion;
    if (originalPrevious === undefined) delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
    else process.env[CREDENTIAL_PREVIOUS_KEY_ENV] = originalPrevious;
    resetCredentialMasterKeyCacheForTests();
  };

  afterEach(() => {
    restoreEnv();
    for (const file of tempFiles.splice(0)) {
      fs.rmSync(file, { force: true });
    }
  });

  const writeTempSettings = (passwordCipher: unknown): string => {
    const settingsPath = path.join(os.tmpdir(), `appendo-ds-rotate-${process.pid}-${Date.now()}.json`);
    tempFiles.push(settingsPath);
    writeSettingsObject(settingsPath, {
      dataSources: [{ isDefault: true, name: 'control-plane', passwordCipher }],
    });
    return settingsPath;
  };

  it('re-encrypts a stale passwordCipher with the current key version', () => {
    const previous = crypto.randomBytes(32).toString('hex');
    const next = crypto.randomBytes(32).toString('hex');
    process.env[CREDENTIAL_MASTER_KEY_ENV] = previous;
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '1';
    delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
    resetCredentialMasterKeyCacheForTests();
    const settingsPath = writeTempSettings(encryptCredential('cipher-secret'));

    process.env[CREDENTIAL_MASTER_KEY_ENV] = next;
    process.env[CREDENTIAL_PREVIOUS_KEY_ENV] = previous;
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '2';
    resetCredentialMasterKeyCacheForTests();

    const result = rotateDefaultDataSourcePasswordCipher(settingsPath);
    expect(result).toEqual({ migrated: 1, failed: [] });
    const updated = readDefaultDataSourceSecretInputFromSettings(settingsPath);
    expect(updated.passwordCipher?.keyVersion).toBe(2);
    expect(resolveDataSourcePassword(updated)).toBe('cipher-secret');
  });

  it('skips a cipher that is already on the current key version', () => {
    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '1';
    delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
    resetCredentialMasterKeyCacheForTests();
    const settingsPath = writeTempSettings(encryptCredential('already-current'));

    const result = rotateDefaultDataSourcePasswordCipher(settingsPath);
    expect(result).toEqual({ migrated: 0, failed: [] });
    expect(resolveDataSourcePassword(readDefaultDataSourceSecretInputFromSettings(settingsPath))).toBe('already-current');
  });

  it('fails rotate when a previous-generation cipher exists without PREVIOUS', () => {
    const previous = crypto.randomBytes(32).toString('hex');
    process.env[CREDENTIAL_MASTER_KEY_ENV] = previous;
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '1';
    delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
    resetCredentialMasterKeyCacheForTests();
    const settingsPath = writeTempSettings(encryptCredential('needs-previous'));

    process.env[CREDENTIAL_MASTER_KEY_ENV] = crypto.randomBytes(32).toString('hex');
    process.env[CREDENTIAL_KEY_VERSION_ENV] = '2';
    delete process.env[CREDENTIAL_PREVIOUS_KEY_ENV];
    resetCredentialMasterKeyCacheForTests();

    expect(() => rotateDefaultDataSourcePasswordCipher(settingsPath)).toThrow(PREVIOUS_KEY_REQUIRED_FOR_ROTATE);
  });
});
