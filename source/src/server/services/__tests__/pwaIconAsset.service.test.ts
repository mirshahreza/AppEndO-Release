import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_PWA_SETTINGS } from '../../../shared/api/contracts/settings/pwa';
import { resolvePwaIconFilePath } from '../pwaIconAsset.service';

describe('resolvePwaIconFilePath', () => {
  it('resolves built-in public icons', () => {
    const filePath = resolvePwaIconFilePath(DEFAULT_PWA_SETTINGS, '192');
    expect(filePath).toBe(path.join(process.cwd(), 'public', 'pwa-192x192.png'));
    expect(fs.existsSync(filePath!)).toBe(true);
  });

  it('resolves custom runtime icons', () => {
    const filePath = resolvePwaIconFilePath(
      {
        ...DEFAULT_PWA_SETTINGS,
        icon192Url: '/assets/platform/pwa/icon-192.png',
      },
      '192',
    );
    expect(filePath?.replace(/\\/g, '/')).toContain('workspace/platform/pwa/icon-192.png');
    expect(fs.existsSync(filePath!)).toBe(true);
  });
});
