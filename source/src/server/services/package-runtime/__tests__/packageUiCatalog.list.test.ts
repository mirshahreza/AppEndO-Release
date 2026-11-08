import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildPackageZipBuffer } from '../../../../core/packages/testkit/packageZipBuilder';

const EXTENSION_SPEC = {
  packageId: 'catalog-list-pack',
  name: 'Catalog List Pack',
  version: '1.0.0',
  uiComponents: [
    {
      componentKey: 'my-tests/widget',
      slotId: 'core.dashboard.widgets',
      entry: 'ui/my-tests/widget.tsx',
      order: 100,
    },
  ],
};

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-ui-catalog-list-'));
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

describe('packageUiCatalog list', () => {
  it('lists installed package UI components for Client Components catalog', async () => {
    const artifact = await import('../../../../core/packages/PackageArtifactService');
    const lifecycleModule = await import('../packageLifecycle.service');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    const upload = await artifact.uploadPackageArtifact(
      buildPackageZipBuffer(EXTENSION_SPEC),
      'catalog-list-pack.zip',
      'admin',
    );
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const installResult = await coordinator.install('catalog-list-pack', 'admin');
    expect(installResult.success, (installResult as { error?: string }).error).toBe(true);

    const {
      buildPackageUiCatalogId,
      getInstalledPackageUiDraftRecord,
      listInstalledPackageUiCatalogSummaries,
    } = await import('../packageUiCatalog.service');

    const summaries = listInstalledPackageUiCatalogSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: buildPackageUiCatalogId('catalog-list-pack', 'my-tests/widget'),
      name: 'widget',
      folder: 'my-tests',
      isPackageComponent: true,
      packageId: 'catalog-list-pack',
      packageDisplayName: 'Catalog List Pack',
      componentKey: 'my-tests/widget',
      packageVersion: '1.0.0',
    });

    const draft = getInstalledPackageUiDraftRecord(summaries[0].id);
    expect(draft?.companionTsx).toContain('catalog-list-pack');
    expect(draft?.document.nodes).toBeTruthy();
  });

  it('hides local designer drafts shadowed by an installed package UI component', async () => {
    const artifact = await import('../../../../core/packages/PackageArtifactService');
    const lifecycleModule = await import('../packageLifecycle.service');
    const { saveDesignerDraft } = await import('../../component-designer/draftCoordinator.service');
    const { createInitialDesignerState } = await import('../../../../domain/component-designer/state');
    lifecycleModule.resetDefaultPackageLifecycleCoordinator();
    const coordinator = lifecycleModule.getDefaultPackageLifecycleCoordinator();

    saveDesignerDraft({
      name: 'widget',
      folder: 'my-tests',
      document: createInitialDesignerState().document,
      bindingDefinitions: {},
      actor: 'tester',
    });

    const upload = await artifact.uploadPackageArtifact(
      buildPackageZipBuffer(EXTENSION_SPEC),
      'catalog-list-pack.zip',
      'admin',
    );
    expect(upload.success, (upload as { error?: string }).error).toBe(true);

    const installResult = await coordinator.install('catalog-list-pack', 'admin');
    expect(installResult.success, (installResult as { error?: string }).error).toBe(true);

    const { ComponentDesignerService } = await import('../../component-designer.service');
    const { buildPackageUiCatalogId } = await import('../packageUiCatalog.service');

    const service = new ComponentDesignerService({ serverPort: 3001 });
    const listResult = service.listDrafts();
    const packageCatalogId = buildPackageUiCatalogId('catalog-list-pack', 'my-tests/widget');
    const matchingItems = listResult.body.items.filter(
      (item) => item.folder === 'my-tests' && item.name === 'widget',
    );

    expect(matchingItems).toHaveLength(1);
    expect(matchingItems[0]).toMatchObject({
      id: packageCatalogId,
      isPackageComponent: true,
      packageId: 'catalog-list-pack',
    });
  });
});
