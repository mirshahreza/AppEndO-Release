import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE,
  parsePackageUninstallPayload,
  resolvePackageUninstallRemoveScope,
} from '../../../../shared/api/contracts/package/uninstall';
import {
  collectProtectedRuntimeEntries,
  collectRuntimeEntriesToRemove,
  resolveRegistryRecordsToRetain,
} from '../packageUninstallScope.service';

const extensionManifest = {
  $schemaVersion: '1.0',
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  requiredAppVersion: '>=1.0.0',
  capabilities: {
    apis: [{ id: 'demo.health', method: 'GET' as const, path: '/demo/health', entry: 'edge/health.ts' }],
    ui_components: [{ componentKey: 'widgets/demo', slotId: 'main', entry: 'ui/Demo.tsx' }],
    ui_routes: [{ pageKey: 'demo-page', entry: 'routes/DemoPage.tsx', suggestedMountId: 'admin' }],
    db_objects: [],
    mcp_servers: [],
    edge_models: [],
    edge_apis: [],
    edge_model_studio_meta: [],
    install_hooks: [],
  },
  overridePolicy: { apis: 'deny', ui_components: 'deny', db_objects: 'deny', mcp_servers: 'deny' },
  integrity: { algorithm: 'sha256' as const, artifactHash: '0'.repeat(64) },
};

describe('package uninstall scope', () => {
  it('defaults all removal flags to true', () => {
    expect(resolvePackageUninstallRemoveScope()).toEqual(DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE);
  });

  it('honors removeScope.runDbUninstallScripts=false payload', () => {
    expect(parsePackageUninstallPayload({
      removeScope: { runDbUninstallScripts: false },
    }).runDbUninstallScripts).toBe(false);
    expect(parsePackageUninstallPayload({
      removeScope: { runDbUninstallScripts: false },
    }).apis).toBe(true);
  });

  it('parses removeScope flags', () => {
    expect(parsePackageUninstallPayload({
      removeScope: { runDbUninstallScripts: false },
    }).runDbUninstallScripts).toBe(false);
  });

  it('collects api, ui component, and ui route entries separately', () => {
    const entries = collectRuntimeEntriesToRemove(extensionManifest, DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE);
    expect(entries).toEqual(expect.arrayContaining([
      'edge/health.ts',
      'ui/Demo.tsx',
      'routes/DemoPage.tsx',
    ]));
  });

  it('keeps ui routes protected when files scope is unchecked', () => {
    const protectedEntries = collectProtectedRuntimeEntries(extensionManifest, {
      ...DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE,
      files: false,
    });
    expect(protectedEntries.has('routes/DemoPage.tsx')).toBe(true);
    expect(protectedEntries.has('edge/health.ts')).toBe(false);
    expect(protectedEntries.has('ui/Demo.tsx')).toBe(false);
  });

  it('retains db object registry records when uninstall scripts are skipped', () => {
    const retain = resolveRegistryRecordsToRetain({
      ...DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE,
      runDbUninstallScripts: false,
    });
    expect(retain.dbObjects).toBe(true);
  });

  it('retains ui route registry records when files scope is unchecked', () => {
    const retain = resolveRegistryRecordsToRetain({
      ...DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE,
      files: false,
    });
    expect(retain.uiRoutes).toBe(true);
    expect(retain.uiComponents).toBe(false);
  });
});
