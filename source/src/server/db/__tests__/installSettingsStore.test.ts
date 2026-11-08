import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  hasInstallSection,
  isInstallComplete,
  readInstallSettings,
  writeInstallSettings,
} from '../installSettingsStore';

describe('installSettingsStore', () => {
  let tmpDir = '';
  let settingsPath = '';

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const seedSettings = (body: Record<string, unknown>) => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-install-'));
    settingsPath = path.join(tmpDir, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(body, null, 2));
  };

  it('treats legacy installs without an install section as complete', () => {
    seedSettings({ runtime: { capabilities: ['service', 'platform', 'worker'] } });
    expect(hasInstallSection(settingsPath)).toBe(false);
    expect(isInstallComplete(settingsPath)).toBe(true);
  });

  it('tracks pending and completed install wizard state', () => {
    seedSettings({ install: { pending: true } });
    expect(isInstallComplete(settingsPath)).toBe(false);

    writeInstallSettings(settingsPath, {
      pending: false,
      completedAt: new Date().toISOString(),
      capabilities: ['service', 'platform', 'worker'],
      nodeName: 'node-1',
    });

    const install = readInstallSettings(settingsPath);
    expect(install.completedAt).toBeTruthy();
    expect(isInstallComplete(settingsPath)).toBe(true);
  });

  it('does not treat partial wizard progress as complete', () => {
    seedSettings({
      install: {
        pending: true,
        databaseInitialized: true,
        emailConfigured: true,
        capabilities: ['service', 'platform', 'worker'],
        nodeName: 'node-1',
      },
    });
    expect(isInstallComplete(settingsPath)).toBe(false);
  });

  it('does not treat install section without completedAt as complete', () => {
    seedSettings({ install: { pending: false } });
    expect(isInstallComplete(settingsPath)).toBe(false);
  });
});
