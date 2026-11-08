import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PackageManifest } from '../../../../core/packages/PackageManifestValidator';

function buildManifest(packageId: string, version: string): PackageManifest {
  return {
    $schemaVersion: '1.0',
    id: packageId,
    name: `Package ${packageId}`,
    version,
    requiredAppVersion: '>=1.0.0',
    dependencies: [],
    capabilities: {
      apis: [],
      ui_components: [
        {
          componentKey: 'summary-widget',
          slotId: 'core.dashboard.widgets',
          entry: 'ui/SummaryWidget.js',
          order: 10,
        },
      ],
      db_objects: [],
      mcp_servers: [],
      edge_models: [],
      edge_apis: [],
      edge_model_studio_meta: [],
      install_hooks: [],
    },
    overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
    integrity: {
      algorithm: 'sha256',
      artifactHash: crypto.randomBytes(32).toString('hex'),
    },
  };
}

function seedPackageArtifact(packageId: string, version: string): void {
  const manifest = buildManifest(packageId, version);
  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify(manifest)));
  zip.addFile(
    'ui/SummaryWidget.js',
    Buffer.from('export default function SummaryWidget() { return null; }'),
  );

  const artifactRel = path.join('artifacts', packageId, `${version}.zip`).replace(/\\/g, '/');
  const manifestRel = path.join('manifests', packageId, `${version}.manifest.json`).replace(/\\/g, '/');
  const artifactAbs = path.join('packages-storage', artifactRel);
  const manifestAbs = path.join('packages-storage', manifestRel);

  fs.mkdirSync(path.dirname(artifactAbs), { recursive: true });
  fs.mkdirSync(path.dirname(manifestAbs), { recursive: true });
  fs.writeFileSync(artifactAbs, zip.toBuffer());
  fs.writeFileSync(manifestAbs, JSON.stringify(manifest, null, 2));

  const index = {
    schema: 'package-index',
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    plugins: [
      {
        packageId,
        displayName: packageId,
        latestVersion: version,
        versions: [
          {
            version,
            artifactPath: artifactRel,
            manifestPath: manifestRel,
            artifactSha256: crypto.randomBytes(32).toString('hex'),
            requiredAppVersion: '>=1.0.0',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join('packages-storage', 'index.json'), JSON.stringify(index, null, 2));
}

let tmpDir = '';
let origCwd = '';

describe('packageUiRuntime.service', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'package-ui-runtime-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync('packages-storage', { recursive: true });
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts UI entries into packages-storage/runtimes on install', async () => {
    seedPackageArtifact('demo-package', '1.0.0');
    const { extractPackageUiRuntime } = await import('../packageUiRuntime.service');
    const manifest = buildManifest('demo-package', '1.0.0');

    const result = extractPackageUiRuntime('demo-package', '1.0.0', manifest);
    expect(result.ok).toBe(true);

    const runtimePath = path.join(
      'packages-storage',
      'runtimes',
      'demo-package',
      '1.0.0',
      'ui',
      'SummaryWidget.js',
    );
    expect(fs.existsSync(runtimePath)).toBe(true);
    expect(fs.readFileSync(runtimePath, 'utf8')).toContain('export default function SummaryWidget');
  });

  it('lists active slot bindings from installed object registries', async () => {
    seedPackageArtifact('demo-package', '1.0.0');
    const manifest = buildManifest('demo-package', '1.0.0');

    fs.mkdirSync(path.join('packages-storage', 'installed'), { recursive: true });
    fs.writeFileSync(
      path.join('packages-storage', 'installed', 'demo-package.install-state.json'),
      JSON.stringify({
        schema: 'package-install-state',
        schemaVersion: '1.0.0',
        packageId: 'demo-package',
        status: 'installed',
        activeVersion: '1.0.0',
        enabled: true,
        updatedAt: new Date().toISOString(),
      }, null, 2),
    );

    fs.mkdirSync(path.join('packages-storage', 'objects'), { recursive: true });
    fs.writeFileSync(
      path.join('packages-storage', 'objects', 'demo-package.object-registry.json'),
      JSON.stringify({
        schema: 'package-object-registry',
        schemaVersion: '1.0.0',
        packageId: 'demo-package',
        activeVersion: '1.0.0',
        records: {
          apis: [],
          uiComponents: manifest.capabilities.ui_components.map((ui) => ({
            conflictKey: `${ui.slotId}::${ui.componentKey}`,
            slotId: ui.slotId,
            componentKey: ui.componentKey,
            entry: ui.entry,
            order: ui.order ?? 0,
            registeredAt: new Date().toISOString(),
          })),
          dbObjects: [],
          mcpServers: [],
        },
        updatedAt: new Date().toISOString(),
      }, null, 2),
    );

    const { extractPackageUiRuntime, listActiveSlotComponents, resolveUiComponentModule } = await import('../packageUiRuntime.service');
    extractPackageUiRuntime('demo-package', '1.0.0', manifest);

    const active = listActiveSlotComponents();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      packageId: 'demo-package',
      componentKey: 'summary-widget',
      slotId: 'core.dashboard.widgets',
      version: '1.0.0',
      moduleUrl: '/api/packages/demo-package/ui/summary-widget?v=1.0.0',
    });

    const resolved = resolveUiComponentModule('demo-package', 'summary-widget');
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.contentType).toContain('javascript');
      expect(fs.existsSync(resolved.absPath)).toBe(true);
    }
  });

  it('omits disabled packages from active slot bindings', async () => {
    seedPackageArtifact('demo-package', '1.0.0');
    const manifest = buildManifest('demo-package', '1.0.0');

    fs.mkdirSync(path.join('packages-storage', 'installed'), { recursive: true });
    fs.writeFileSync(
      path.join('packages-storage', 'installed', 'demo-package.install-state.json'),
      JSON.stringify({
        schema: 'package-install-state',
        schemaVersion: '1.0.0',
        packageId: 'demo-package',
        status: 'installed',
        activeVersion: '1.0.0',
        enabled: false,
        updatedAt: new Date().toISOString(),
      }, null, 2),
    );

    fs.mkdirSync(path.join('packages-storage', 'objects'), { recursive: true });
    fs.writeFileSync(
      path.join('packages-storage', 'objects', 'demo-package.object-registry.json'),
      JSON.stringify({
        schema: 'package-object-registry',
        schemaVersion: '1.0.0',
        packageId: 'demo-package',
        activeVersion: '1.0.0',
        records: {
          apis: [],
          uiComponents: manifest.capabilities.ui_components.map((ui) => ({
            conflictKey: `${ui.slotId}::${ui.componentKey}`,
            slotId: ui.slotId,
            componentKey: ui.componentKey,
            entry: ui.entry,
            order: ui.order ?? 0,
            registeredAt: new Date().toISOString(),
          })),
          dbObjects: [],
          mcpServers: [],
        },
        updatedAt: new Date().toISOString(),
      }, null, 2),
    );

    const { listActiveSlotComponents } = await import('../packageUiRuntime.service');
    expect(listActiveSlotComponents()).toHaveLength(0);
  });

  it('omits routed package pages from active slot bindings', async () => {
    seedPackageArtifact('demo-package', '1.0.0');
    const now = new Date().toISOString();

    fs.mkdirSync(path.join('packages-storage', 'installed'), { recursive: true });
    fs.writeFileSync(
      path.join('packages-storage', 'installed', 'demo-package.install-state.json'),
      JSON.stringify({
        schema: 'package-install-state',
        schemaVersion: '1.0.0',
        packageId: 'demo-package',
        status: 'installed',
        activeVersion: '1.0.0',
        enabled: true,
        updatedAt: now,
      }, null, 2),
    );

    fs.mkdirSync(path.join('packages-storage', 'objects'), { recursive: true });
    fs.writeFileSync(
      path.join('packages-storage', 'objects', 'demo-package.object-registry.json'),
      JSON.stringify({
        schema: 'package-object-registry',
        schemaVersion: '1.0.0',
        packageId: 'demo-package',
        activeVersion: '1.0.0',
        records: {
          apis: [],
          uiComponents: [
            {
              conflictKey: 'core.dashboard.widgets::general/cms-vocab-languages',
              slotId: 'core.dashboard.widgets',
              componentKey: 'general/cms-vocab-languages',
              entry: 'ui/general/cms-vocab-languages.tsx',
              order: 100,
              registeredAt: now,
            },
            {
              conflictKey: 'cms.site.brand::cms-site-brand',
              slotId: 'cms.site.brand',
              componentKey: 'cms-site-brand',
              entry: 'ui/cms-site-brand.tsx',
              order: 10,
              registeredAt: now,
            },
          ],
          uiRoutes: [
            {
              conflictKey: 'cms-vocab-languages',
              pageKey: 'cms-vocab-languages',
              entry: 'ui/general/cms-vocab-languages.tsx',
              registeredAt: now,
            },
          ],
          dbObjects: [],
          mcpServers: [],
        },
        updatedAt: now,
      }, null, 2),
    );

    const { listActiveSlotComponents } = await import('../packageUiRuntime.service');
    const active = listActiveSlotComponents();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      packageId: 'demo-package',
      componentKey: 'cms-site-brand',
      slotId: 'cms.site.brand',
      moduleUrl: '/api/packages/demo-package/ui/cms-site-brand?v=1.0.0',
    });
  });
});
