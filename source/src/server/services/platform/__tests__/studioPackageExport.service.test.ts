import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdmZip from 'adm-zip';
import { validateManifest } from '../../../../core/packages/PackageManifestValidator';

const platformStore = vi.hoisted(() => ({
  mounts: [] as Array<{
    id: string;
    pathPrefix: string;
    name: string;
    defaultRoute: string;
    authProfile: { requireAuth?: boolean };
    experienceConfig?: { locale?: string } | null;
  }>,
  shells: [] as Array<{ shellKey: string; name: string; entry: string; surface: string; enabled: boolean }>,
  shellRules: [] as Array<{ id: number; mountId: string; pathPrefix: string; shellKey: string; priority: number; enabled: boolean }>,
  routeBindings: [] as Array<{
    id: number;
    mountId: string;
    routePattern: string;
    pageKey: string;
    enabled: boolean;
    auth?: { roles?: string[] } | null;
    nav?: { label: string; order?: number } | null;
  }>,
  pageModules: [] as Array<{
    pageKey: string;
    title: string;
    loaderKind: 'core' | 'designer' | 'package';
    loaderRef: string;
    enabled: boolean;
  }>,
}));

const designerDrafts = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const serverFunctions = vi.hoisted(() => [] as Array<{
  id: string;
  name: string;
  method: 'GET';
  metadata_json: string | null;
  code: string;
  timeout_ms: number;
}>);

vi.mock('../../../domain/platform', () => ({
  findPlatformMountById: async (id: string) => {
    const mount = platformStore.mounts.find((item) => item.id === id);
    return mount
      ? {
          ...mount,
          enabled: true,
          designerRoutePropagation: 'auto' as const,
        }
      : undefined;
  },
  listPlatformShellRuleRows: async () => platformStore.shellRules.map((rule) => ({ ...rule })),
  findPlatformShellByKey: async (shellKey: string) => {
    const shell = platformStore.shells.find((item) => item.shellKey === shellKey);
    return shell ? { ...shell } : undefined;
  },
  listPlatformRouteBindingRows: async () => platformStore.routeBindings.map((binding) => ({ ...binding, id: binding.id })),
  findPlatformPageModuleByKey: async (pageKey: string) => {
    const page = platformStore.pageModules.find((item) => item.pageKey === pageKey);
    return page ? { ...page } : undefined;
  },
}));

vi.mock('../../../domain/component-designer/draftIo', () => ({
  getDesignerDraft: (slug: string) => designerDrafts.get(slug) ?? null,
}));

vi.mock('../../../../core/functions/FunctionFileStore', () => ({
  listManagedFunctionsFromStore: () => serverFunctions,
  findManagedFunctionByIdFromStore: (functionId: string) =>
    serverFunctions.find((item) => item.id === functionId) ?? null,
}));

function resetStore() {
  platformStore.mounts = [{
    id: 'demo-mount',
    pathPrefix: '/demo',
    name: 'Demo Mount',
    defaultRoute: 'welcome',
    authProfile: { requireAuth: true },
    experienceConfig: { locale: 'en-US' },
  }];
  platformStore.shells = [{
    shellKey: 'admin',
    name: 'Admin Layout',
    entry: 'core:AdminLayout',
    surface: 'admin',
    enabled: true,
  }];
  platformStore.shellRules = [{
    id: 1,
    mountId: 'demo-mount',
    pathPrefix: '/demo',
    shellKey: 'admin',
    priority: 0,
    enabled: true,
  }];
  platformStore.pageModules = [{
    pageKey: 'welcome',
    title: 'Welcome',
    loaderKind: 'designer',
    loaderRef: 'welcome',
    enabled: true,
  }];
  platformStore.routeBindings = [{
    id: 1,
    mountId: 'demo-mount',
    routePattern: 'welcome',
    pageKey: 'welcome',
    enabled: true,
    nav: { label: 'Welcome', order: 1 },
  }];
  designerDrafts.clear();
  designerDrafts.set('welcome', {
    schema: 'component-designer-draft',
    id: 'welcome',
    name: 'Welcome',
    folder: 'pages',
    document: { schemaVersion: '1.0.0', nodes: [] },
    bindingDefinitions: {},
    metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  });
  serverFunctions.length = 0;
}

import { buildStudioMountExport } from '../studioPackageExport.service';

describe('studioPackageExport.service', () => {
  beforeEach(() => {
    resetStore();
  });

  it('builds a valid vertical-app ZIP from mount registry + designer draft', async () => {
    const built = await buildStudioMountExport('demo-mount', {
      packageId: 'demo-app',
      version: '1.0.0',
    });

    // 2026-07-13: fixed one confirmed bug upstream (verticalAppManifestValidator.ts was
    // validating this single-mount PACKAGE export as if it were a full platform manifest,
    // wrongly requiring all 3 built-in portals — see ValidateExperienceManifestOptions doc
    // comment "Package extensions do not [require them]" and the sibling
    // validatePackageExtensionPortals() helper that already does this correctly elsewhere).
    // That fix surfaced a second, more precisely isolated issue still unresolved here:
    // buildExperienceManifestFromMountContext (compileExperienceManifest.ts:226-241)
    // unconditionally does `portals: [defaultHomePortal(), studioPortal]` — the same
    // "home" + "studio" hardcoded pair decompileExperienceManifest (same file) uses to
    // reconstruct the FULL PLATFORM's own manifest. This service is that function's ONLY
    // caller (verified via repo-wide grep) — a single-mount PACKAGE export should never
    // claim the reserved "home"/"studio" segments as its own portal names. Not fixing
    // myself: the exported segment name is presumably read back by the install pipeline on
    // the target node, and there is no passing baseline here to confirm what naming
    // convention that side expects — an uninformed rename risks silently breaking
    // installability, the exact thing p-13 exists to guarantee.
    expect(built.ok, !built.ok ? `${built.error} :: ${JSON.stringify((built as any).details)}` : undefined).toBe(true);
    if (!built.ok) return;

    const validation = validateManifest(built.manifest);
    expect(validation.valid, validation.errors?.join('; ')).toBe(true);
    expect(built.manifest.kind).toBe('vertical-app');
    expect(built.manifest.$schemaVersion).toBe('1.2');
    expect(built.manifest.deployment.mount.pathPrefix).toBe('/demo');
    expect(built.manifest.capabilities.designer_layouts?.[0]?.slug).toBe('welcome');

    const zip = new AdmZip(built.buffer);
    expect(zip.getEntry('package.json')).toBeTruthy();
    expect(zip.getEntry('designer/welcome.json')).toBeTruthy();
    expect(zip.getEntry('ui/shell/AppShell.js')).toBeTruthy();
  });

  it('includes server functions tagged with mount id', async () => {
    serverFunctions.push({
      id: 'demo-fn',
      name: 'Demo Health',
      method: 'GET',
      metadata_json: JSON.stringify({ apiDoc: { tags: ['demo-mount'] } }),
      code: 'module.exports = async function handler() { return { ok: true }; };',
      timeout_ms: 5000,
    });

    const built = await buildStudioMountExport('demo-mount', {
      packageId: 'demo-app',
      version: '1.0.0',
    });

    expect(built.ok, !built.ok ? `${built.error} :: ${JSON.stringify((built as any).details)}` : undefined).toBe(true);
    if (!built.ok) return;
    expect(built.manifest.capabilities.apis).toHaveLength(1);
    expect(built.manifest.capabilities.apis[0]?.path).toBe('/api/demo-health');

    const zip = new AdmZip(built.buffer);
    expect(zip.getEntry('api/demo-health.ts')).toBeTruthy();
  });

  it('rejects reserved studio mount export', async () => {
    const built = await buildStudioMountExport('studio', {
      packageId: 'demo-app',
      version: '1.0.0',
    });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.details?.some((item) => item.includes('reserved'))).toBe(true);
  });

  it('exports extension-only ZIP when mount has tagged APIs but no exportable routes', async () => {
    platformStore.pageModules = [{
      pageKey: 'dashboard',
      title: 'Dashboard',
      loaderKind: 'core',
      loaderRef: 'core:Dashboard',
      enabled: true,
    }];
    platformStore.routeBindings = [{
      id: 1,
      mountId: 'demo-mount',
      routePattern: '',
      pageKey: 'dashboard',
      enabled: true,
    }];
    serverFunctions.push({
      id: 'demo-fn',
      name: 'Demo Health',
      method: 'GET',
      metadata_json: JSON.stringify({ apiDoc: { tags: ['demo-mount'] } }),
      code: 'module.exports = async function handler() { return { ok: true }; };',
      timeout_ms: 5000,
    });

    const built = await buildStudioMountExport('demo-mount', {
      packageId: 'demo-api-pack',
      version: '1.0.0',
      kind: 'extension',
    });

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.kind).toBe('extension');
    expect(built.manifest).toMatchObject({ id: 'demo-api-pack' });
    expect((built.manifest as { capabilities: { apis: unknown[] } }).capabilities.apis).toHaveLength(1);

    const zip = new AdmZip(built.buffer);
    expect(zip.getEntry('api/demo-health.ts')).toBeTruthy();
    expect(zip.getEntry('api/demo-health.meta.json')).toBeTruthy();
    expect(zip.getEntry('ui/shell/AppShell.js')).toBeFalsy();
  });

  it('rejects mounts with only core routes and no tagged APIs for vertical-app export', async () => {
    platformStore.pageModules = [{
      pageKey: 'dashboard',
      title: 'Dashboard',
      loaderKind: 'core',
      loaderRef: 'core:Dashboard',
      enabled: true,
    }];
    platformStore.routeBindings = [{
      id: 1,
      mountId: 'demo-mount',
      routePattern: '',
      pageKey: 'dashboard',
      enabled: true,
    }];

    const built = await buildStudioMountExport('demo-mount', {
      packageId: 'demo-app',
      version: '1.0.0',
      kind: 'vertical-app',
    });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain('at least one exportable route');
  });

  it('discovers exportable routes and tagged APIs for a mount', async () => {
    serverFunctions.push({
      id: 'demo-fn',
      name: 'Demo Health',
      method: 'GET',
      metadata_json: JSON.stringify({ apiDoc: { tags: ['demo-mount'] } }),
      code: 'module.exports = async function handler() { return { ok: true }; };',
      timeout_ms: 5000,
    });

    const { discoverStudioMountExport } = await import('../studioPackageExport.service');
    const discovered = await discoverStudioMountExport('demo-mount');
    expect('ok' in discovered).toBe(false);
    if ('ok' in discovered) return;

    expect(discovered.routes).toHaveLength(1);
    expect(discovered.routes[0]?.exportable).toBe(true);
    expect(discovered.apis).toHaveLength(1);
    expect(discovered.apis[0]?.tagged).toBe(true);
    expect(discovered.suggestedKind).toBe('vertical-app');
  });
});
