import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  classifyControlPlaneInputFile,
  resolveSchemaDryRunDatabase,
} from '../controlPlaneSchemaDryRun';
import { parseSchemaDryRunArgs, resolveSchemaDryRunInputs } from '../../../../scripts/deploy/schemaDryRun';

describe('controlPlaneSchemaDryRun', () => {
  it('classifies settings.json and deploy secrets files', () => {
    expect(classifyControlPlaneInputFile(JSON.stringify({
      database: { provider: 'sqlserver', url: 'sqlserver://localhost;database=AppEnd;user=sa' },
    }))).toBe('settings');
    expect(classifyControlPlaneInputFile(JSON.stringify({
      database: { host: 'db.internal', database: 'AppEnd', username: 'sa', password: 'secret' },
    }))).toBe('secrets');
    expect(classifyControlPlaneInputFile('APPENDO_DB_HOST=db.internal\n')).toBe('secrets');
  });

  it('builds a sqlserver URL from a secrets file without reading a settings password cipher', () => {
    const resolved = resolveSchemaDryRunDatabase({
      secrets: {
        provider: 'sqlserver',
        host: 'db.internal\\SQLEXPRESS',
        database: 'AppEnd',
        username: 'sa',
        password: 's;ecret',
        encrypt: true,
        trustServerCertificate: true,
      },
    });
    expect(resolved.provider).toBe('sqlserver');
    expect(resolved.url).toContain('database=AppEnd');
    expect(resolved.url).toContain('password={s;ecret}');
    expect(resolved.url).toContain('user=sa');
    expect(resolved.engine).toBe('prisma');
  });

  it('reads a settings file and lets secrets override the database name', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-dry-run-'));
    const settingsPath = path.join(dir, 'settings.json');
    const previousPassword = process.env.APPENDO_TEST_DB_PASSWORD;
    process.env.APPENDO_TEST_DB_PASSWORD = 'from-settings';
    fs.writeFileSync(settingsPath, JSON.stringify({
      database: {
        provider: 'sqlserver',
        url: 'sqlserver://localhost;database=OldDb;user=sa;encrypt=true;trustServerCertificate=true',
        engine: 'prisma',
      },
      dataSources: [{
        isDefault: true,
        type: 'SQL Server',
        host: 'localhost',
        port: 1433,
        database: 'OldDb',
        username: 'sa',
        passwordEnvKey: 'APPENDO_TEST_DB_PASSWORD',
      }],
    }), 'utf8');

    try {
      const fromSettings = resolveSchemaDryRunDatabase({ settingsPath });
      expect(fromSettings.url).toContain('database=OldDb');
      expect(fromSettings.url).toContain('password=from-settings');

      const overridden = resolveSchemaDryRunDatabase({
        settingsPath,
        secrets: { database: 'NewDb', password: 'from-secrets' },
      });
      expect(overridden.url).toContain('database=NewDb');
      expect(overridden.url).toContain('password=from-secrets');
      expect(overridden.url).toContain('user=sa');
    } finally {
      if (previousPassword === undefined) delete process.env.APPENDO_TEST_DB_PASSWORD;
      else process.env.APPENDO_TEST_DB_PASSWORD = previousPassword;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses --file as settings or secrets', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-dry-run-cli-'));
    const settingsPath = path.join(dir, 'settings.json');
    const secretsPath = path.join(dir, 'secrets.json');
    fs.writeFileSync(settingsPath, JSON.stringify({
      database: { provider: 'sqlserver', url: 'sqlserver://localhost;database=AppEnd;user=sa' },
      dataSources: [{ isDefault: true, password: 'pw', type: 'SQL Server', host: 'localhost', database: 'AppEnd', username: 'sa' }],
    }), 'utf8');
    fs.writeFileSync(secretsPath, JSON.stringify({
      database: { host: 'db.internal', database: 'AppEnd', username: 'sa', password: 'secret' },
    }), 'utf8');

    try {
      expect(parseSchemaDryRunArgs(['--settings', settingsPath, '--secrets', secretsPath])).toEqual({
        help: false,
        settingsPath,
        secretsPath,
        filePath: undefined,
      });
      const fromFile = resolveSchemaDryRunInputs(parseSchemaDryRunArgs(['--file', secretsPath]));
      expect(fromFile.settingsPath).toBeUndefined();
      expect(fromFile.secrets?.host).toBe('db.internal');
      expect(fromFile.secrets?.password).toBe('secret');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
