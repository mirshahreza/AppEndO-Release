import { describe, expect, it } from 'vitest';
import {
  buildManagedFunctionApiRouteSuffix,
  buildManagedFunctionPackageApiMapping,
  buildPackageApiSlug,
  buildPluginApiMetaSidecar,
  redactTestPayloadSecrets,
  resolveInstalledPackageApiCatalogLocation,
  resolvePluginApiAuthFromAccessControl,
  validatePluginApiMetaSidecar,
} from '../packageApiMetaSidecar';

describe('packageApiMetaSidecar', () => {
  it('maps admin-only access control to admin auth', () => {
    expect(resolvePluginApiAuthFromAccessControl({
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    })).toBe('admin');
  });

  it('maps unrestricted access control to authenticated auth', () => {
    expect(resolvePluginApiAuthFromAccessControl({
      allowRoles: [],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    })).toBe('authenticated');
  });

  it('redacts secret-like keys in test payloads', () => {
    const redacted = redactTestPayloadSecrets(JSON.stringify({
      username: 'demo',
      apiKey: 'super-secret',
      nested: { password: '123' },
    }));

    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain('super-secret');
    expect(redacted).toContain('demo');
  });

  it('builds and validates a managed function sidecar', () => {
    const sidecar = buildPluginApiMetaSidecar({
      id: 'fn-demo',
      name: 'Demo Health',
      method: 'GET',
      path: '/api/demo/health',
      code: 'export default async function handler() { return { ok: true }; }',
      timeout_ms: 5000,
      engine_type: 'SANDBOX_JS',
      metadata_json: JSON.stringify({ apiDoc: { tags: ['demo'] } }),
      test_payload: '{"token":"abc"}',
      access_control: {
        allowRoles: ['ADMIN'],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    });

    const validation = validatePluginApiMetaSidecar(sidecar);
    expect(validation.valid, validation.errors?.join('; ')).toBe(true);
    expect(sidecar.tags).toEqual(['demo']);
    expect(sidecar.testPayload).toContain('[REDACTED]');
  });

  it('preserves managed function api paths in package manifests', () => {
    expect(buildPackageApiSlug({
      folder: 'test',
      name: 'test',
      path: '/api/test/test',
    })).toBe('test');

    expect(buildManagedFunctionPackageApiMapping({
      packageId: 'pkg-test',
      folder: 'test',
      name: 'test',
      method: 'GET',
      path: '/api/test/test',
    })).toEqual({
      apiSlug: 'test',
      manifestPath: '/api/test/test',
      entry: 'api/test/test.ts',
      metaEntry: 'api/test/test.meta.json',
      apiId: 'get-test',
    });
  });

  it('prefers managed path segments over a mismatched folder field', () => {
    expect(buildPackageApiSlug({
      folder: 'pkg-test',
      name: 'test',
      path: '/api/test/test',
    })).toBe('test');
  });

  it('derives installed package catalog folder/name from managed http paths', () => {
    expect(resolveInstalledPackageApiCatalogLocation(
      'pkg-test',
      '/api/test/test',
      'get-test',
    )).toEqual({
      folder: 'test',
      name: 'test',
    });
  });

  it('derives catalog folder/name from legacy package-scoped http paths', () => {
    expect(resolveInstalledPackageApiCatalogLocation(
      'pkg-test',
      '/api/packages/pkg-test/test',
      'get-test',
    )).toEqual({
      folder: 'packages/pkg-test',
      name: 'test',
    });
  });
});
