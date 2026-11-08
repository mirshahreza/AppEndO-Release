import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BUILTIN_CULTURE_PACKS } from '../../../shared/api/contracts/platform/cultures';
import {
  ensurePlatformCulturesSettings,
  getPlatformCulturesConfigFromFile,
  savePlatformCulturesConfigToFile,
} from '../platformCultureSettingsStore';

describe('platformCultureSettingsStore', () => {
  let tempDir = '';
  let settingsPath = '';

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createTempSettingsPath = () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-platform-cultures-'));
    settingsPath = path.join(tempDir, 'settings.json');
    fs.writeFileSync(settingsPath, '{}');
    return settingsPath;
  };

  it('seeds default platform cultures when missing', () => {
    const filePath = createTempSettingsPath();
    const settings = ensurePlatformCulturesSettings(filePath);
    expect(settings.enabledCulturePackIds).toEqual(['us', 'ir', 'iq']);
    expect(settings.defaultCultureId).toBe('us');
    expect(settings.packs).toHaveLength(3);
    expect(getPlatformCulturesConfigFromFile(filePath)).toEqual(settings);
  });

  it('persists enabled culture pack ids and default culture id', () => {
    const filePath = createTempSettingsPath();
    ensurePlatformCulturesSettings(filePath);
    const saved = savePlatformCulturesConfigToFile(filePath, {
      packs: [
        ...DEFAULT_BUILTIN_CULTURE_PACKS.map((pack) => ({ ...pack })),
        {
          id: 'fa-gregorian',
          label: 'Persian Gregorian',
          language: 'fa',
          locale: 'fa-IR',
          calendar: 'gregorian',
          direction: 'rtl',
          translationBundleId: 'ir',
        },
      ],
      enabledCulturePackIds: ['us', 'ir'],
      defaultCultureId: 'ir',
    });
    expect(saved.enabledCulturePackIds).toEqual(['us', 'ir']);
    expect(saved.defaultCultureId).toBe('ir');
    expect(saved.packs).toHaveLength(4);
  });
});
