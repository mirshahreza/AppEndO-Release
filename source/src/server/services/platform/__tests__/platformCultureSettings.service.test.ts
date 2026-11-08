import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapCultureRegistry, getDefaultCulturePackId, getEnabledCulturePackIds } from '../../../../core/culture/CultureRegistry';
import { DEFAULT_BUILTIN_CULTURE_PACKS } from '../../../../shared/api/contracts/platform/cultures';
import { PlatformCultureSettingsService } from '../platformCultureSettings.service';

describe('PlatformCultureSettingsService', () => {
  let tempDir = '';
  let settingsPath = '';

  beforeEach(() => {
    bootstrapCultureRegistry();
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createService = () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-platform-cultures-service-'));
    settingsPath = path.join(tempDir, 'settings.json');
    fs.writeFileSync(settingsPath, '{}');
    return new PlatformCultureSettingsService(settingsPath);
  };

  it('returns builtin culture packs with default config', () => {
    const service = createService();
    const result = service.getCultures();

    expect(result.body.success).toBe(true);
    expect(result.body.enabledCulturePackIds).toEqual(['us', 'ir', 'iq']);
    expect(result.body.defaultCultureId).toBe('us');
    expect(result.body.packs).toHaveLength(3);
    expect(result.body.availablePacks.map((pack) => pack.id).sort()).toEqual(['iq', 'ir', 'us']);
  });

  it('updates enabled culture packs and default culture id', () => {
    const service = createService();
    const result = service.updateCultures({
      packs: DEFAULT_BUILTIN_CULTURE_PACKS.map((pack) => ({ ...pack })),
      enabledCulturePackIds: ['us', 'iq'],
      defaultCultureId: 'iq',
    });

    expect(result.body.success).toBe(true);
    expect(getEnabledCulturePackIds()).toEqual(['us', 'iq']);
    expect(getDefaultCulturePackId()).toBe('iq');

    const loaded = service.getCultures().body;
    expect(loaded.enabledCulturePackIds).toEqual(['us', 'iq']);
    expect(loaded.defaultCultureId).toBe('iq');
  });

  it('rejects unknown culture pack ids', () => {
    const service = createService();
    expect(() => service.updateCultures({
      packs: DEFAULT_BUILTIN_CULTURE_PACKS.map((pack) => ({ ...pack })),
      enabledCulturePackIds: ['us', 'zz'],
      defaultCultureId: 'us',
    })).toThrow('Unknown culture pack id: zz');
  });

  it('persists custom culture packs and resolves them at runtime', () => {
    const service = createService();
    const result = service.updateCultures({
      packs: [
        ...DEFAULT_BUILTIN_CULTURE_PACKS.map((pack) => ({ ...pack })),
        {
          id: 'en-gregorian',
          label: 'English Gregorian',
          language: 'en',
          locale: 'en-GB',
          calendar: 'gregorian',
          direction: 'ltr',
          translationBundleId: 'us',
        },
      ],
      enabledCulturePackIds: ['us', 'en-gregorian'],
      defaultCultureId: 'us',
    });

    expect(result.body.success).toBe(true);
    expect(getEnabledCulturePackIds()).toEqual(['us', 'en-gregorian']);

    const loaded = service.getCultures().body;
    expect(loaded.packs).toHaveLength(4);
    expect(loaded.availablePacks.find((pack) => pack.id === 'en-gregorian')?.source).toBe('custom');
  });
});
