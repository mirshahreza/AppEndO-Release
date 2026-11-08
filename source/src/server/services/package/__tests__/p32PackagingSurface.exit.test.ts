/**
 * p-32 exit criteria — packaging surface parity (PSP-8).
 * Spec: plans/core/todo/p-32-packaging-surface-parity.md
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { validateManifest } from '../../../../core/packages/PackageManifestValidator';
import {
  buildPackageZipBuffer,
  buildStudioUploadParitySpec,
} from '../../../../core/packages/testkit/ecosystemFixtures';
import type { PackageImportPreview } from '../../../../shared/api/contracts/package/artifactPreview';

function parityPreviewFields(preview: PackageImportPreview) {
  const { fileName: _fileName, ...rest } = preview;
  return rest;
}

const serverFunctions = vi.hoisted(() => [] as Array<{
  id: string;
  name: string;
  method: 'GET' | 'POST';
  path: string;
  code: string;
  timeout_ms: number;
  engine_type: 'SANDBOX_JS';
  metadata_json: string | null;
  test_payload: string;
  access_control: {
    allowRoles: string[];
    allowUsers: string[];
    denyRoles: string[];
    denyUsers: string[];
  };
}>);

vi.mock('../../../../core/functions/FunctionFileStore', () => ({
  findManagedFunctionByIdFromStore: (functionId: string) => (
    serverFunctions.find((item) => item.id === functionId) ?? null
  ),
}));

vi.mock('../../../services/package-runtime/deploymentConflictScan', () => ({
  findEffectiveShellOwner: async () => null,
  findEffectivePageModuleOwner: async () => null,
  findEffectiveMountIdByPathPrefix: async () => null,
  findEffectiveMountOwnerById: async () => null,
  findEffectiveRouteBindingOwner: async () => null,
  listEffectiveMountPathPrefixes: async () => [],
  mountExistsInCoreOrDeployments: async () => false,
  CORE_PLATFORM_OWNER: '__core__',
}));

describe('p32PackagingSurface.exit — PSP-8', () => {
  let tmpDir = '';
  let origCwd = '';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p32-packaging-surface-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);
    vi.resetModules();

    serverFunctions.length = 0;
    serverFunctions.push(
      {
        id: 'fn-round-a',
        name: 'Round Trip A',
        method: 'GET',
        path: '/api/demo/round-a',
        code: 'export default async function handler() { return { ok: true }; }',
        timeout_ms: 5000,
        engine_type: 'SANDBOX_JS',
        metadata_json: null,
        test_payload: '{}',
        access_control: {
          allowRoles: [],
          allowUsers: [],
          denyRoles: [],
          denyUsers: [],
        },
      },
      {
        id: 'fn-round-b',
        name: 'Round Trip B',
        method: 'POST',
        path: '/api/demo/round-b',
        code: 'export default async function handler() { return { ok: true, b: true }; }',
        timeout_ms: 5000,
        engine_type: 'SANDBOX_JS',
        metadata_json: JSON.stringify({ apiDoc: { tags: ['p32'] } }),
        test_payload: '{}',
        access_control: {
          allowRoles: ['ADMIN'],
          allowUsers: [],
          denyRoles: [],
          denyUsers: [],
        },
      },
    );
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function loadPreviewService() {
    return import('../packageArtifactPreview.service');
  }

  async function loadExportServices() {
    return import('../packageFunctionExport.service');
  }

  describe('ST-04 upload preview parity', () => {
    it('returns identical package import preview across embed entry surfaces', async () => {
      const { previewZipImport } = await loadPreviewService();
      const buffer = buildPackageZipBuffer(buildStudioUploadParitySpec());

      const studioPreview = previewZipImport(buffer, 'eco-studio-upload-parity-1.0.0.zip');
      const pluginsEmbedPreview = previewZipImport(buffer, 'plugins-upload.zip');

      expect(parityPreviewFields(studioPreview)).toEqual(parityPreviewFields(pluginsEmbedPreview));
      expect(studioPreview.artifactType).toBe('package');
      expect(studioPreview.validationErrors).toEqual([]);
      expect(studioPreview.installPreview?.pluginKind).toBe('extension');
      expect(studioPreview.installPreview?.installBlocked).toBe(false);
      expect(studioPreview.manifest?.capabilities?.apis).toHaveLength(2);
    });
  });

  describe('function export round-trip', () => {
    it('exports ≥2 functions then passes import preview with install preview', async () => {
      const functionExport = await loadExportServices();
      const { previewZipImport } = await loadPreviewService();

      const built = functionExport.buildPackageFunctionExport({
        functionIds: ['fn-round-a', 'fn-round-b'],
        packageId: 'p32-round-trip',
        version: '1.0.0',
        name: 'P32 Round Trip Pack',
      });

      expect(built.ok, !built.ok ? built.error : undefined).toBe(true);
      if (!built.ok) return;

      const validation = validateManifest(built.manifest);
      expect(validation.valid, validation.errors?.join('; ')).toBe(true);
      expect(built.manifest.capabilities.apis).toHaveLength(2);

      const importPreview = previewZipImport(built.buffer, built.fileName);
      expect(importPreview.artifactType).toBe('package');
      expect(importPreview.validationErrors).toEqual([]);
      expect(importPreview.installPreview?.installBlocked).toBe(false);
      expect(importPreview.installPreview?.schema).toBe('package-install-preview');
    });
  });

  describe('artifact install wizard API chain', () => {
    it('upload preview → upload → install preview for ST-04 package', async () => {
      const { previewZipImport, previewPluginInstall } = await loadPreviewService();
      const { uploadPackageArtifact } = await import('../../../../core/packages/PackageArtifactService');

      const buffer = buildPackageZipBuffer(buildStudioUploadParitySpec());
      const spec = buildStudioUploadParitySpec();

      const importPreview = previewZipImport(buffer, 'wizard-package.zip');
      expect(importPreview.installPreview?.installBlocked).toBe(false);

      const upload = await uploadPackageArtifact(buffer, 'wizard-package.zip');
      expect(upload.success).toBe(true);
      if (!upload.success) return;

      const installPreview = previewPluginInstall({ packageId: spec.packageId });
      expect(installPreview.ok).toBe(true);
      if (!installPreview.ok) return;

      expect(installPreview.preview.packageId).toBe(spec.packageId);
      expect(installPreview.preview.installBlocked).toBe(false);
      expect(installPreview.preview.schema).toBe('package-install-preview');
    });
  });
});
