import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_PWA_SETTINGS } from '../../../shared/api/contracts/settings/pwa';
import { hydratePwaSettingsIconUrls, resolveRuntimePwaIconUrl } from '../pwaAssets.service';

describe('hydratePwaSettingsIconUrls', () => {
  it('fills empty icon urls from runtime files when present', () => {
    const icon192Path = path.join(process.cwd(), 'runtime', 'platform', 'pwa', 'icon-192.png');
    if (!fs.existsSync(icon192Path)) {
      return;
    }

    const hydrated = hydratePwaSettingsIconUrls({
      ...DEFAULT_PWA_SETTINGS,
      icon192Url: '',
    });

    expect(hydrated.icon192Url).toBe('/assets/platform/pwa/icon-192.png');
    expect(resolveRuntimePwaIconUrl('192')).toBe('/assets/platform/pwa/icon-192.png');
  });

  it('keeps explicit icon urls', () => {
    const hydrated = hydratePwaSettingsIconUrls({
      ...DEFAULT_PWA_SETTINGS,
      icon192Url: '/assets/platform/pwa/custom.png',
    });

    expect(hydrated.icon192Url).toBe('/assets/platform/pwa/custom.png');
  });
});
