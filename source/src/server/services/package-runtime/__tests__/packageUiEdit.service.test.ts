import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildPackageZipBuffer } from '../../../../core/packages/testkit/packageZipBuilder';

const EXTENSION_SPEC = {
  packageId: 'edit-ui-pack',
  name: 'Edit UI Pack',
  version: '1.0.0',
  uiComponents: [
    {
      componentKey: 'dashboard/summary-card',
      slotId: 'core.dashboard.widgets',
      entry: 'ui/dashboard/summary-card.tsx',
      order: 100,
    },
  ],
};

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-edit-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(origCwd);
  try {
    const lifecycleModule = await import('../packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
  } catch {
    // module may not be loaded
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // Windows may briefly lock package-storage handles
  }
  vi.resetModules();
});

describe('package UI edit helpers', () => {
  it('updates installed package UI runtime source by catalog id', async () => {
    const artifact = await import('../../../../core/packages/PackageArtifactService');
    const lifecycleModule = await import('../packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const upload = await artifact.uploadPackageArtifact(
      buildPackageZipBuffer(EXTENSION_SPEC),
      'edit-ui-pack.zip',
      'admin',
    );
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const installResult = await coordinator.install('edit-ui-pack', 'admin');
    expect(installResult.success, (installResult as { error?: string }).error).toBe(true);

    const {
      buildPackageUiCatalogId,
      readInstalledPackageUiComponentSource,
      resolvePackageUiCatalogEntry,
      updateInstalledPackageUiComponent,
    } = await import('../packageUiCatalog.service');

    const catalogId = buildPackageUiCatalogId('edit-ui-pack', 'dashboard/summary-card');
    const resolved = resolvePackageUiCatalogEntry(catalogId);
    expect(resolved?.packageId).toBe('edit-ui-pack');

    const updatedCode = 'export default function SummaryCard() { return <div>Edited</div>; }\n';
    const saveResult = updateInstalledPackageUiComponent(catalogId, updatedCode);
    expect(saveResult.ok).toBe(true);

    expect(readInstalledPackageUiComponentSource(
      'edit-ui-pack',
      resolved!.version,
      resolved!.ui.entry,
    )).toBe(updatedCode);
  });

  it('detects repack drift after installed package UI runtime is edited', async () => {
    const artifact = await import('../../../../core/packages/PackageArtifactService');
    const lifecycleModule = await import('../packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const upload = await artifact.uploadPackageArtifact(
      buildPackageZipBuffer(EXTENSION_SPEC),
      'edit-ui-pack.zip',
      'admin',
    );
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const installResult = await coordinator.install('edit-ui-pack', 'admin');
    expect(installResult.success, (installResult as { error?: string }).error).toBe(true);

    const {
      buildPackageUiCatalogId,
      updateInstalledPackageUiComponent,
    } = await import('../packageUiCatalog.service');
    const { previewPackageRepackDrift } = await import('../../package/packageRepack.service');

    const catalogId = buildPackageUiCatalogId('edit-ui-pack', 'dashboard/summary-card');
    const saveResult = updateInstalledPackageUiComponent(
      catalogId,
      'export default function SummaryCard() { return <div>Edited</div>; }\n',
    );
    expect(saveResult.ok).toBe(true);

    const drift = previewPackageRepackDrift('edit-ui-pack');
    expect('ok' in drift && drift.ok === false).toBe(false);
    if ('ok' in drift && drift.ok === false) return;

    expect(drift.hasChanges).toBe(true);
    expect(drift.changedByCategory.ui_components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'dashboard/summary-card',
          entryPath: 'ui/dashboard/summary-card.tsx',
        }),
      ]),
    );
  });
});
