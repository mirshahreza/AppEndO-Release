import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_SHELL_KEY } from '../../../../shared/api/contracts/platform/mountConstants';
import { buildPublicSiteHomePortalPayload } from '../../../../core/packages/packageHomePortal';

const shellStore = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const zipStore = vi.hoisted(() => ({ text: '' }));

vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  readShellFile: vi.fn(() => shellStore.current),
  writeShellFile: vi.fn((shell: Record<string, unknown>) => {
    shellStore.current = shell;
  }),
  withPlatformRegistryLock: vi.fn((fn: () => void) => fn()),
  touchPlatformRegistryIndex: vi.fn(),
}));

vi.mock('../../../../core/platform-registry/loadPlatformRegistryDefaults', () => ({
  loadPlatformRegistryDefaultShells: vi.fn(() => [{
    shellKey: HOME_SHELL_KEY,
    name: 'Home Redirect',
    entry: '',
    surface: 'home',
    entryMode: 'redirect',
    redirectToSegment: 'studio',
    redirectToCulture: 'us',
    enabled: true,
  }]),
}));

vi.mock('../../platform/platformRuntimeConfig.service', () => ({
  invalidatePlatformRuntimeConfig: vi.fn(),
}));

vi.mock('../../../domain/platform/shellRepository', () => ({
  updatePlatformShell: vi.fn(async (_key: string, input: Record<string, unknown>) => {
    shellStore.current = {
      ...(shellStore.current ?? { shellKey: HOME_SHELL_KEY }),
      ...input,
    };
  }),
}));

vi.mock('../../package/packageWorkspaceAssetInstall.service', () => ({
  readPackageZipTextEntry: vi.fn(() => zipStore.text),
}));

describe('packageHomePortalClaim.service', () => {
  beforeEach(() => {
    shellStore.current = {
      shellKey: HOME_SHELL_KEY,
      name: 'Home Redirect',
      entry: '',
      surface: 'home',
      enabled: true,
      entryMode: 'redirect',
      redirectToSegment: 'studio',
      redirectToCulture: 'us',
    };
    zipStore.text = `${JSON.stringify(buildPublicSiteHomePortalPayload(), null, 2)}\n`;
  });

  afterEach(() => {
    const claimFile = path.join('packages-storage', 'installed', 'home-portal.claim.json');
    if (fs.existsSync(claimFile)) {
      fs.unlinkSync(claimFile);
    }
    vi.resetModules();
  });

  it('claims home-shell on apply and restores the Studio redirect on uninstall', async () => {
    const {
      applyPackageHomePortalClaimFromManifest,
      uninstallPackageHomePortalClaim,
    } = await import('../packageHomePortalClaim.service');
    const payload = buildPublicSiteHomePortalPayload();

    await applyPackageHomePortalClaimFromManifest('cms', '1.2.0', {
      $schemaVersion: '1.0',
      id: 'cms',
      name: 'CMS',
      version: '1.2.0',
      requiredAppVersion: '>=1.0.0',
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [],
        edge_apis: [],
        edge_model_studio_meta: [],
        install_hooks: [],
        home_portal: [{ entry: 'platform/home-shell.json' }],
      },
      overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny' },
      integrity: { algorithm: 'sha256', artifactHash: 'b'.repeat(64) },
    });

    expect(shellStore.current?.entryMode).toBe('shell');
    expect(shellStore.current?.entry).toBe(payload.entry);

    await uninstallPackageHomePortalClaim('cms');
    expect(shellStore.current?.entryMode).toBe('redirect');
    expect(shellStore.current?.redirectToSegment).toBe('studio');
  });

  it('restores home-shell when uninstalling cms even without a claim sidecar', async () => {
    shellStore.current = {
      shellKey: HOME_SHELL_KEY,
      name: 'Home',
      entry: 'designer:portal-layouts/site-shell',
      surface: 'home',
      enabled: true,
      entryMode: 'shell',
    };
    const { uninstallPackageHomePortalClaim } = await import('../packageHomePortalClaim.service');
    await uninstallPackageHomePortalClaim('cms');
    expect(shellStore.current?.entryMode).toBe('redirect');
    expect(shellStore.current?.redirectToSegment).toBe('studio');
  });
});
