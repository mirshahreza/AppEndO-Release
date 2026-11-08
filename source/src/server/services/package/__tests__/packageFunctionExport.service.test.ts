import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdmZip from 'adm-zip';
import { validateManifest } from '../../../../core/packages/PackageManifestValidator';
import { validatePluginApiMetaSidecar } from '../../../../core/packages/packageApiMetaSidecar';

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

import { buildPackageFunctionExport } from '../packageFunctionExport.service';

describe('packageFunctionExport.service', () => {
  beforeEach(() => {
    serverFunctions.length = 0;
    serverFunctions.push({
      id: 'fn-public',
      name: 'Public Probe',
      method: 'GET',
      path: '/api/demo/public-probe',
      code: 'export default async function handler() { return { ok: true, source: "managed" }; }',
      timeout_ms: 5000,
      engine_type: 'SANDBOX_JS',
      metadata_json: JSON.stringify({ apiDoc: { tags: ['pkg-2'] } }),
      test_payload: '{"apiKey":"secret"}',
      access_control: {
        allowRoles: [],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    });
    serverFunctions.push({
      id: 'fn-admin',
      name: 'Admin Probe',
      method: 'POST',
      path: '/api/demo/admin-probe',
      code: 'export default async function handler() { return { ok: true, admin: true }; }',
      timeout_ms: 8000,
      engine_type: 'SANDBOX_JS',
      metadata_json: null,
      test_payload: '{}',
      access_control: {
        allowRoles: ['ADMIN'],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    });
  });

  it('builds a valid extension ZIP with api meta sidecars (PL-19 auth matrix)', async () => {
    const built = buildPackageFunctionExport({
      functionIds: ['fn-public', 'fn-admin'],
      packageId: 'demo-api-pack',
      version: '1.0.0',
      name: 'Demo API Pack',
    });

    expect(built.ok, !built.ok ? built.error : undefined).toBe(true);
    if (!built.ok) return;

    const validation = validateManifest(built.manifest);
    expect(validation.valid, validation.errors?.join('; ')).toBe(true);
    expect(built.manifest.capabilities.apis).toHaveLength(2);

    const authValues = built.manifest.capabilities.apis.map((api) => api.auth).sort();
    expect(authValues).toEqual(['admin', 'authenticated']);

    const zip = new AdmZip(built.buffer);
    expect(zip.getEntry('package.json')).toBeTruthy();
    expect(zip.getEntry('api/demo/public-probe.ts')).toBeTruthy();
    expect(zip.getEntry('api/demo/public-probe.meta.json')).toBeTruthy();
    expect(zip.getEntry('api/demo/admin-probe.ts')).toBeTruthy();
    expect(zip.getEntry('api/demo/admin-probe.meta.json')).toBeTruthy();

    expect(built.manifest.capabilities.apis.map((api) => api.path).sort()).toEqual([
      '/api/demo/admin-probe',
      '/api/demo/public-probe',
    ]);

    const publicMeta = JSON.parse(zip.readAsText('api/demo/public-probe.meta.json'));
    const publicMetaValidation = validatePluginApiMetaSidecar(publicMeta);
    expect(publicMetaValidation.valid, publicMetaValidation.errors?.join('; ')).toBe(true);
    expect(publicMeta.tags).toEqual(['pkg-2']);
    expect(publicMeta.testPayload).toContain('[REDACTED]');
  });

  it('rejects export when function ids are missing', () => {
    const built = buildPackageFunctionExport({
      functionIds: ['missing-fn'],
      packageId: 'demo-api-pack',
    });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain('No exportable managed functions');
  });

  it('preserves managed function api paths in package manifests', () => {
    serverFunctions.push({
      id: 'test.test',
      name: 'test',
      folder: 'pkg-test',
      method: 'GET',
      path: '/api/test/test',
      code: 'export default async function handler() { return { ok: true }; }',
      timeout_ms: 5000,
      engine_type: 'SANDBOX_JS',
      metadata_json: null,
      test_payload: '{}',
      access_control: {
        allowRoles: ['ADMIN'],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    });

    const built = buildPackageFunctionExport({
      functionIds: ['test.test'],
      packageId: 'pkg-test',
      version: '1.0.0',
    });

    expect(built.ok, !built.ok ? built.error : undefined).toBe(true);
    if (!built.ok) return;

    expect(built.manifest.capabilities.apis[0]).toMatchObject({
      path: '/api/test/test',
      entry: 'api/test/test.ts',
    });
  });
});
