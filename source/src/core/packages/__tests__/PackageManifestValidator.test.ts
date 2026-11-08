import { describe, it, expect } from 'vitest';
import { validateManifest, normalizeArtifactManifestForValidation, type PackageManifest } from '../PackageManifestValidator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schemaVersion: '1.0',
    id: 'ecommerce-core',
    name: 'Ecommerce Core',
    version: '1.0.0',
    description: 'Core ecommerce functionality.',
    createdBy: 'AppEndO Team',
    requiredAppVersion: '>=1.0.0 <2.0.0',
    dependencies: [],
    capabilities: {
      apis: [
        {
          id: 'orders.list',
          method: 'GET',
          path: '/packages/ecommerce-core/orders',
          entry: 'edge/orders/list.ts',
          timeoutMs: 10000,
          auth: 'admin',
        },
      ],
      ui_components: [],
      db_objects: [],
      mcp_servers: [],
    },
    overridePolicy: {
      apis: 'deny',
      ui_components: 'deny',
      db_objects: 'deny',
    },
    integrity: {
      algorithm: 'sha256',
      artifactHash: 'a'.repeat(64),
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid manifest
// ---------------------------------------------------------------------------

describe('validateManifest – valid', () => {
  it('accepts a fully valid manifest', () => {
    const result = validateManifest(baseManifest());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.manifest).not.toBeNull();
  });

  it('accepts optional fields omitted', () => {
    const m = baseManifest();
    delete (m as any).description;
    delete (m as any).createdBy;
    delete (m as any).dependencies;
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
  });

  it('accepts all three non-empty capability types', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'GET', path: '/packages/ecommerce-core/x', entry: 'e.ts' }],
        ui_components: [{ componentKey: 'ck', slotId: 'sid', entry: 'ui/C.tsx', order: 0 }],
        db_objects: [{ objectType: 'table', objectName: 'my_table', installScript: 'db/up.sql' }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
  });

  it('accepts overridePolicy allow values', () => {
    const m = baseManifest({ overridePolicy: { apis: 'allow', ui_components: 'allow', db_objects: 'allow' } });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Top-level field rules
// ---------------------------------------------------------------------------

describe('validateManifest – top-level field violations', () => {
  it('rejects non-object input', () => {
    expect(validateManifest(null)).toMatchObject({ valid: false });
    expect(validateManifest('string')).toMatchObject({ valid: false });
    expect(validateManifest([])).toMatchObject({ valid: false });
  });

  it('rejects wrong $schemaVersion', () => {
    const result = validateManifest(baseManifest({ $schemaVersion: '2.0' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('$schemaVersion'))).toBe(true);
  });

  it('rejects invalid id patterns', () => {
    // 'ab-' is valid per regex ^[a-z][a-z0-9-]{2,63}$ (trailing dash is allowed by contract)
    const bad = ['AB', 'ab', '1abc', 'a', 'a_b', 'a'.repeat(65)];
    for (const id of bad) {
      const r = validateManifest(baseManifest({ id }));
      expect(r.valid, `id="${id}" should be invalid`).toBe(false);
    }
  });

  it('accepts valid id patterns', () => {
    const good = ['abc', 'ecommerce-core', 'my-package-123'];
    for (const id of good) {
      const r = validateManifest(baseManifest({ id }));
      expect(r.valid, `id="${id}" should be valid`).toBe(true);
    }
  });

  it('rejects name too short or too long', () => {
    expect(validateManifest(baseManifest({ name: 'ab' })).valid).toBe(false);
    expect(validateManifest(baseManifest({ name: 'a'.repeat(101) })).valid).toBe(false);
  });

  it('rejects invalid version (not x.y.z)', () => {
    const bad = ['1.0', '1', '1.0.0.0', 'v1.0.0', '1.0.0-beta'];
    for (const v of bad) {
      const r = validateManifest(baseManifest({ version: v }));
      expect(r.valid, `version="${v}" should be invalid`).toBe(false);
    }
  });

  it('rejects unknown top-level keys', () => {
    const r = validateManifest(baseManifest({ unknownField: true }));
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('unknownField'))).toBe(true);
  });

  it('rejects deprecated author field', () => {
    const r = validateManifest(baseManifest({ author: 'AppEndO Team' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('createdBy instead'))).toBe(true);
  });

  it('strips audit fields before artifact validation', () => {
    const r = validateManifest(normalizeArtifactManifestForValidation(baseManifest({
      createdAt: new Date().toISOString(),
      createdBy: 'AppEndO Team',
      author: 'Legacy Author',
    })));
    expect(r.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// capabilities
// ---------------------------------------------------------------------------

describe('validateManifest – capabilities', () => {
  it('rejects all-empty capabilities', () => {
    const m = baseManifest({
      capabilities: { apis: [], ui_components: [], db_objects: [], mcp_servers: [] },
    });
    const r = validateManifest(m);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('least one capability'))).toBe(true);
  });

  it('rejects duplicate method+path in apis', () => {
    const m = baseManifest({
      capabilities: {
        apis: [
          { id: 'a1', method: 'GET', path: '/packages/ecommerce-core/orders', entry: 'e1.ts' },
          { id: 'a2', method: 'GET', path: '/packages/ecommerce-core/orders', entry: 'e2.ts' },
        ],
        ui_components: [],
        db_objects: [],
      },
    });
    const r = validateManifest(m);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('duplicate method+path'))).toBe(true);
  });

  it('rejects api path not starting with /packages/', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'GET', path: '/other/path', entry: 'e.ts' }],
        ui_components: [],
        db_objects: [],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects api entry with path traversal', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'GET', path: '/packages/ecommerce-core/x', entry: '../evil.ts' }],
        ui_components: [],
        db_objects: [],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects invalid http method', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'CONNECT', path: '/packages/ecommerce-core/x', entry: 'e.ts' }],
        ui_components: [],
        db_objects: [],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects invalid timeoutMs range', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'GET', path: '/packages/ecommerce-core/x', entry: 'e.ts', timeoutMs: 999 }],
        ui_components: [],
        db_objects: [],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects duplicate slotId+componentKey in ui_components', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'GET', path: '/packages/ecommerce-core/x', entry: 'e.ts' }],
        ui_components: [
          { componentKey: 'ck', slotId: 'sid', entry: 'ui/A.tsx' },
          { componentKey: 'ck', slotId: 'sid', entry: 'ui/B.tsx' },
        ],
        db_objects: [],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects db_object with invalid objectName', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'GET', path: '/packages/ecommerce-core/x', entry: 'e.ts' }],
        ui_components: [],
        db_objects: [{ objectType: 'table', objectName: 'BadName', installScript: 'up.sql' }],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects db_object installScript with path traversal', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'GET', path: '/packages/ecommerce-core/x', entry: 'e.ts' }],
        ui_components: [],
        db_objects: [{ objectType: 'table', objectName: 'my_table', installScript: '../../etc/up.sql' }],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('accepts optional seed db_objects', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [{
          objectType: 'seed',
          objectName: 'cms_initial_records',
          installScript: 'db/seed/optional-records.sql',
          installMode: 'optional',
        }],
      },
    });
    expect(validateManifest(m).valid).toBe(true);
  });

  it('rejects optional installMode on non-seed db_objects', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [{
          objectType: 'table',
          objectName: 'cms_contents',
          installScript: 'db/install/schema.sql',
          installMode: 'optional',
        }],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
    expect(validateManifest(m).errors.some((error) => error.includes('installMode'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// overridePolicy
// ---------------------------------------------------------------------------

describe('validateManifest – overridePolicy', () => {
  it('rejects invalid override values', () => {
    const m = baseManifest({
      overridePolicy: { apis: 'merge', ui_components: 'deny', db_objects: 'deny' },
    });
    expect(validateManifest(m).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// integrity
// ---------------------------------------------------------------------------

describe('validateManifest – integrity', () => {
  it('rejects non-sha256 algorithm', () => {
    const m = baseManifest({ integrity: { algorithm: 'md5', artifactHash: 'a'.repeat(64) } });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects wrong-length artifactHash', () => {
    const m = baseManifest({ integrity: { algorithm: 'sha256', artifactHash: 'a'.repeat(63) } });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects uppercase hex in artifactHash', () => {
    const m = baseManifest({ integrity: { algorithm: 'sha256', artifactHash: 'A'.repeat(64) } });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('accepts lowercase 64-char hex', () => {
    const m = baseManifest({ integrity: { algorithm: 'sha256', artifactHash: '0'.repeat(64) } });
    expect(validateManifest(m).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dependencies
// ---------------------------------------------------------------------------

describe('validateManifest – dependencies', () => {
  it('rejects duplicate packageId in dependencies', () => {
    const m = baseManifest({
      dependencies: [
        { packageId: 'base-catalog', versionRange: '>=1.0.0' },
        { packageId: 'base-catalog', versionRange: '>=2.0.0' },
      ],
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('accepts dependency without versionRange', () => {
    const m = baseManifest({
      dependencies: [{ packageId: 'base-catalog' }],
    });
    expect(validateManifest(m).valid).toBe(true);
  });

  it('accepts empty requiredAppVersion', () => {
    const m = baseManifest({ requiredAppVersion: '' });
    expect(validateManifest(m).valid).toBe(true);
  });
});

describe('validateManifest – libraries', () => {
  it('accepts libraries with an optional versionRange', () => {
    const m = baseManifest({
      libraries: [{ name: 'xlsx', versionRange: '^0.18.5' }],
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
    expect(result.manifest?.libraries).toEqual([{ name: 'xlsx', versionRange: '^0.18.5' }]);
  });

  it('accepts a core library declaration', () => {
    const m = baseManifest({
      libraries: [{ name: 'react' }],
    });
    expect(validateManifest(m).valid).toBe(true);
  });

  it('rejects duplicate library names', () => {
    const m = baseManifest({
      libraries: [
        { name: 'xlsx', versionRange: '^0.18.5' },
        { name: 'xlsx' },
      ],
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects an invalid npm package name', () => {
    const m = baseManifest({
      libraries: [{ name: 'React' }],
    });
    expect(validateManifest(m).valid).toBe(false);
  });
});

describe('validateManifest – mcp_servers', () => {
  it('accepts mcp_servers-only manifest', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [{
          id: 'fs',
          label: 'Filesystem',
          transport: 'stdio',
          command: 'npx',
        }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
    expect(result.manifest?.capabilities.mcp_servers).toHaveLength(1);
  });

  it('rejects stdio MCP server without command', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [{
          id: 'fs',
          label: 'Filesystem',
          transport: 'stdio',
        }],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects global MCP id longer than slug limit', () => {
    const packageId = 'a'.repeat(60);
    const m = baseManifest({
      id: packageId,
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [{
          id: 'filesystem-tool',
          label: 'Filesystem',
          transport: 'stdio',
          command: 'npx',
        }],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });
});

describe('validateManifest – ui_routes', () => {
  it('accepts extension manifest with ui_routes', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        ui_routes: [{
          pageKey: 'hello-page',
          entry: 'ui/HelloPage.js',
          suggestedRoutePattern: 'packages/demo/hello-page',
        }],
        db_objects: [],
        mcp_servers: [],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
    const manifest = result.manifest as PackageManifest;
    expect(manifest.capabilities.ui_routes?.[0]?.pageKey).toBe('hello-page');
  });

  it('rejects unknown ui_routes fields', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        ui_routes: [{
          pageKey: 'hello-page',
          entry: 'ui/HelloPage.js',
          unknownField: true,
        }],
        db_objects: [],
        mcp_servers: [],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('unknown field'))).toBe(true);
  });

  it('rejects unknown capabilities fields', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        extraCapability: [],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('preserves portals and navigations in normalized manifest', () => {
    const m = baseManifest({
      capabilities: {
        apis: [{ id: 'a1', method: 'GET', path: '/packages/ecommerce-core/x', entry: 'e.ts' }],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        portals: [{ segment: 'admin', entry: 'platform/portals/admin.json' }],
        navigations: [{ id: 'main-nav', entry: 'platform/navigations/main-nav.json' }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
    const manifest = result.manifest as PackageManifest;
    expect(manifest.capabilities.portals).toEqual([
      { segment: 'admin', entry: 'platform/portals/admin.json' },
    ]);
    expect(manifest.capabilities.navigations).toEqual([
      { id: 'main-nav', entry: 'platform/navigations/main-nav.json' },
    ]);
  });

  it('rejects reserved builtin identity-provider package ids', () => {
    const result = validateManifest(baseManifest({ id: 'google-oauth' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('reserved for builtin identity-provider'))).toBe(true);
  });

  it('rejects identity-provider extension type declarations', () => {
    const result = validateManifest(baseManifest({ extensionType: 'identity-provider' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('cannot register identity-provider'))).toBe(true);
  });

  it('rejects auth OAuth API route capabilities', () => {
    const result = validateManifest(baseManifest({
      capabilities: {
        apis: [{
          id: 'auth.oauth',
          method: 'GET',
          path: '/api/auth/oauth/google-dev/callback',
          entry: 'edge/oauth.ts',
        }],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
      },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('cannot register auth OAuth/SAML'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// edge_models / edge_apis / edge_model_studio_meta / install_hooks
// ---------------------------------------------------------------------------

describe('validateManifest – edge data capabilities', () => {
  it('accepts a manifest with edge_models, edge_apis and edge_model_studio_meta', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [{ id: 'em_cms_contents', entry: 'edge/models/em_cms_contents.json' }],
        edge_apis: [{ id: 'ea_cms_contents', edgeModelId: 'em_cms_contents', entry: 'edge/apis/ea_cms_contents.json' }],
        edge_model_studio_meta: [{ edgeModelId: 'em_cms_contents', entry: 'edge/studio-meta/em_cms_contents.json' }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
    const manifest = result.manifest as PackageManifest;
    expect(manifest.capabilities.edge_models).toHaveLength(1);
    expect(manifest.capabilities.edge_apis).toHaveLength(1);
    expect(manifest.capabilities.edge_model_studio_meta).toHaveLength(1);
  });

  it('accepts a manifest with a single install_hooks entry', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        install_hooks: [{ id: 'cms_base_info_seed', entry: 'hooks/cms-base-info-seed.ts', timeoutMs: 30000 }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
    const manifest = result.manifest as PackageManifest;
    expect(manifest.capabilities.install_hooks).toHaveLength(1);
  });

  it('rejects edge_apis.edgeModelId not declared in edge_models', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [],
        edge_apis: [{ id: 'ea_cms_contents', edgeModelId: 'em_missing', entry: 'edge/apis/ea_cms_contents.json' }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('must reference a capabilities.edge_models'))).toBe(true);
  });

  it('rejects edge_model_studio_meta.edgeModelId not declared in edge_models', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [],
        edge_model_studio_meta: [{ edgeModelId: 'em_missing', entry: 'edge/studio-meta/em_missing.json' }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('must reference a capabilities.edge_models'))).toBe(true);
  });

  it('rejects duplicate ids within edge_models', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [
          { id: 'em_cms_contents', entry: 'edge/models/a.json' },
          { id: 'em_cms_contents', entry: 'edge/models/b.json' },
        ],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects more than one install_hooks entry', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        install_hooks: [
          { id: 'hook-one', entry: 'hooks/one.ts' },
          { id: 'hook-two', entry: 'hooks/two.ts' },
        ],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('at most 1 hook'))).toBe(true);
  });

  it('rejects install_hooks entry not ending in .ts', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        install_hooks: [{ id: 'hook-one', entry: 'hooks/one.js' }],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('accepts navigation_patches and culture_keys', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [{
          componentKey: 'crm/contacts',
          slotId: 'core.dashboard.widgets',
          entry: 'ui/crm/contacts.tsx',
        }],
        ui_routes: [{
          pageKey: 'crm-contacts',
          entry: 'ui/crm/contacts.tsx',
          suggestedMountId: 'studio',
        }],
        db_objects: [],
        mcp_servers: [],
        navigation_patches: [{
          navigationId: 'studio',
          entry: 'platform/navigation-patches/studio.json',
        }],
        culture_keys: [{ entry: 'culture/keys.json' }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
    const manifest = result.manifest as PackageManifest;
    expect(manifest.capabilities.navigation_patches).toEqual([{
      navigationId: 'studio',
      entry: 'platform/navigation-patches/studio.json',
    }]);
    expect(manifest.capabilities.culture_keys).toEqual([{ entry: 'culture/keys.json' }]);
  });

  it('accepts home_portal', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [{
          componentKey: 'cms/home',
          slotId: 'core.dashboard.widgets',
          entry: 'ui/cms/home.tsx',
        }],
        db_objects: [],
        mcp_servers: [],
        home_portal: [{ entry: 'platform/home-shell.json' }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(true);
    const manifest = result.manifest as PackageManifest;
    expect(manifest.capabilities.home_portal).toEqual([{ entry: 'platform/home-shell.json' }]);
  });

  it('rejects more than one home_portal entry', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        home_portal: [
          { entry: 'platform/home-shell.json' },
          { entry: 'platform/home-shell-2.json' },
        ],
      },
    });
    expect(validateManifest(m).valid).toBe(false);
  });

  it('rejects more than one culture_keys entry', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        culture_keys: [
          { entry: 'culture/keys.json' },
          { entry: 'culture/more.json' },
        ],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('culture_keys may declare at most 1'))).toBe(true);
  });

  it('accepts a manifest whose only non-empty capability is edge_models', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [{ id: 'em_cms_contents', entry: 'edge/models/em_cms_contents.json' }],
      },
    });
    expect(validateManifest(m).valid).toBe(true);
  });

  it('accepts a manifest whose only non-empty capability is workflows', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        workflows: [{
          scopeKey: 'global',
          key: 'order-approval',
          entry: 'workflows/global/order-approval.json',
        }],
      },
    });
    expect(validateManifest(m).valid).toBe(true);
  });

  it('rejects unknown fields on edge_apis entries', () => {
    const m = baseManifest({
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        mcp_servers: [],
        edge_models: [{ id: 'em_cms_contents', entry: 'edge/models/em_cms_contents.json' }],
        edge_apis: [{
          id: 'ea_cms_contents',
          edgeModelId: 'em_cms_contents',
          entry: 'edge/apis/ea_cms_contents.json',
          unknownField: true,
        }],
      },
    });
    const result = validateManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('unknown field'))).toBe(true);
  });
});
