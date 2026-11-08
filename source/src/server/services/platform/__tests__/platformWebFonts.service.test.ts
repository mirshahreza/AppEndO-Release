import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlatformWebFontsConfig } from '../../../../shared/api/contracts/platform/webFonts';
import { PlatformWebFontsService } from '../platformWebFonts.service';

const FONT_BYTES = Buffer.concat([Buffer.from('wOF2', 'latin1'), Buffer.from('licensed-font-data')]);
const LICENSE = {
  packagePolicy: 'embed' as const,
  licenseName: 'SIL Open Font License 1.1',
  licenseUrl: 'https://openfontlicense.org/',
  licenseNotice: 'Copyright Example Authors. Licensed under the SIL OFL 1.1.',
};

describe('PlatformWebFontsService package profiles', () => {
  const roots: string[] = [];

  afterEach(() => {
    roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
  });

  const createService = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-web-fonts-'));
    roots.push(root);
    const settingsPath = path.join(root, 'settings.json');
    fs.writeFileSync(settingsPath, '{}');
    let config: PlatformWebFontsConfig = { fonts: [] };
    return new PlatformWebFontsService(settingsPath, path.join(root, 'fonts'), {
      read: () => structuredClone(config),
      write: (next) => {
        config = structuredClone(next);
        return structuredClone(config);
      },
    });
  };

  it('persists and strictly resolves a licensed local font profile', () => {
    const service = createService();
    const uploaded = service.uploadFont('portable.woff2', FONT_BYTES, {
      label: 'Portable Sans',
      family: 'Portable Sans',
      ...LICENSE,
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    expect(uploaded.font).toMatchObject({
      id: 'web-portable-sans',
      format: 'woff2',
      mime: 'font/woff2',
      fileSize: FONT_BYTES.length,
      contentHash: crypto.createHash('sha256').update(FONT_BYTES).digest('hex'),
      ...LICENSE,
    });
    expect(service.listFonts().fonts[0]).toMatchObject(uploaded.font);
    expect(service.resolvePackageFont(uploaded.font.id)?.content).toEqual(FONT_BYTES);
  });

  it.each([
    ['missing license notice', { packagePolicy: 'embed', licenseName: 'OFL', licenseNotice: '' }],
    ['insecure license URL', { ...LICENSE, licenseUrl: 'http://example.test/license' }],
  ])('rejects %s', (_label, metadata) => {
    const result = createService().uploadFont('portable.woff2', FONT_BYTES, {
      label: 'Portable Sans',
      family: 'Portable Sans',
      ...metadata,
    });
    expect(result).toMatchObject({ ok: false });
  });

  it('rejects extension/content mismatches', () => {
    const result = createService().uploadFont('not-a-font.woff2', Buffer.from('OTTOfake'), {
      label: 'Fake',
      family: 'Fake',
      ...LICENSE,
    });
    expect(result).toEqual({ ok: false, error: 'Uploaded file content is not a valid WOFF2 font.' });
  });

  it('installs embedded bytes and requires exact reference-only reuse', () => {
    const source = createService();
    const uploaded = source.uploadFont('portable.woff2', FONT_BYTES, {
      label: 'Portable Sans',
      family: 'Portable Sans',
      ...LICENSE,
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    const resolved = source.resolvePackageFont(uploaded.font.id)!;

    const target = createService();
    expect(target.installPackageFont(resolved.font, resolved.content)).toMatchObject({
      ok: true,
      installed: true,
    });
    expect(target.installPackageFont(
      { ...resolved.font, packagePolicy: 'reference-only' },
    )).toMatchObject({ ok: true, installed: false });

    const emptyTarget = createService();
    expect(emptyTarget.installPackageFont(
      { ...resolved.font, packagePolicy: 'reference-only' },
    )).toMatchObject({ ok: false, error: expect.stringContaining('exact installed content hash') });
  });
});
