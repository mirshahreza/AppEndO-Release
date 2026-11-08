import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildDefaultRuntimeSettings,
  ensureRuntimeSettings,
  invalidateSettingsObjectCache,
  readSettingsObject,
} from '../settingsFile';

const tempDirs: string[] = [];

const createSettingsDir = (body: Record<string, unknown> | string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-settings-'));
  tempDirs.push(dir);
  const settingsPath = path.join(dir, 'settings.json');
  fs.writeFileSync(
    settingsPath,
    typeof body === 'string' ? body : JSON.stringify(body, null, 2),
    'utf8',
  );
  return settingsPath;
};

afterEach(() => {
  invalidateSettingsObjectCache();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('settingsFile database provider', () => {
  it('defaults runtime databaseProvider to sqlserver', () => {
    expect(buildDefaultRuntimeSettings().databaseProvider).toBe('sqlserver');
  });

  it('does not rewrite a SQL Server install to postgres when runtime.databaseProvider is missing', () => {
    const settingsPath = createSettingsDir({
      database: {
        provider: 'sqlserver',
        url: 'sqlserver://localhost\\SQL2025;database=AppEnd;user=sa;encrypt=true;trustServerCertificate=true',
        engine: 'prisma',
      },
      runtime: {
        nodeEnv: 'development',
        port: 3000,
      },
    });

    const runtime = ensureRuntimeSettings(settingsPath);
    expect(runtime.databaseProvider).toBe('sqlserver');

    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      runtime?: { databaseProvider?: string };
    };
    expect(saved.runtime?.databaseProvider).toBe('sqlserver');
  });

  it('throws on corrupt settings.json instead of stamping empty PostgreSQL defaults', () => {
    const settingsPath = createSettingsDir('{ not-json');
    expect(() => readSettingsObject(settingsPath)).toThrow(/Failed to read/);
  });
});
