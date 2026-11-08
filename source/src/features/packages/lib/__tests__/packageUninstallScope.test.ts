import { describe, expect, it } from 'vitest';
import type { PackageBundleManifest } from '../../../../shared/api/contracts/package-manifest/types';
import {
  buildDefaultPackageUninstallRemoveScope,
  isPackageUninstallScriptOptionRunnable,
  listVisiblePackageUninstallCapabilityOptions,
  listVisiblePackageUninstallScopeOptions,
  listVisiblePackageUninstallScriptOptions,
  packageHasEdgeData,
  packageHasPortalNavCapabilities,
  packageHasUninstallFileScope,
  resolvePackageUninstallScopeHint,
  resolvePackageUninstallScopeLabel,
} from '../../utils';

const extensionManifest: PackageBundleManifest = {
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  requiredAppVersion: '>=1.0.0',
  capabilities: {
    apis: [{ id: 'demo.health', method: 'GET', path: '/demo/health', entry: 'edge/health.ts' }],
    ui_components: [{ componentKey: 'widgets/demo', slotId: 'main', entry: 'ui/Demo.tsx' }],
    portals: [{ segment: 'crm', entry: 'portals/crm.json' }],
    navigations: [{ id: 'crm-nav', entry: 'nav/crm.json' }],
    db_objects: [{
      objectType: 'table',
      objectName: 'demo_items',
      installScript: 'db/install/schema.sql',
      uninstallScript: 'db/uninstall/schema.sql',
    }],
  },
};

const extensionWithRoutes = {
  ...extensionManifest,
  capabilities: {
    ...extensionManifest.capabilities,
    ui_routes: [{ pageKey: 'demo-page', entry: 'routes/DemoPage.tsx' }],
  },
} as PackageBundleManifest & {
  capabilities: PackageBundleManifest['capabilities'] & {
    ui_routes: Array<{ pageKey: string; entry: string }>;
  };
};

const manifestWithoutSql: PackageBundleManifest = {
  ...extensionManifest,
  capabilities: {
    ...extensionManifest.capabilities,
    db_objects: [],
  },
};

const extensionWithEdgeData = {
  ...extensionManifest,
  capabilities: {
    ...extensionManifest.capabilities,
    edge_models: [{ id: 'em_cms_contents', entry: 'edge/models/em_cms_contents.json' }],
    edge_apis: [{ id: 'ea_cms_contents', edgeModelId: 'em_cms_contents', entry: 'edge/apis/ea_cms_contents.json' }],
  },
} as PackageBundleManifest;

const extensionWithRoutesAndEdgeData = {
  ...extensionWithRoutes,
  capabilities: {
    ...extensionWithRoutes.capabilities,
    edge_models: extensionWithEdgeData.capabilities.edge_models,
    edge_apis: extensionWithEdgeData.capabilities.edge_apis,
  },
} as PackageBundleManifest;

describe('package uninstall scope UI helpers', () => {
  it('lists capabilities in wizard order', () => {
    expect(listVisiblePackageUninstallCapabilityOptions(extensionManifest)).toEqual([
      'portal_nav',
      'apis',
      'ui_components',
    ]);
  });

  it('always lists uninstall script option when manifest is available', () => {
    expect(listVisiblePackageUninstallScriptOptions(extensionManifest)).toEqual(['runDbUninstallScripts']);
    expect(listVisiblePackageUninstallScriptOptions(manifestWithoutSql)).toEqual(['runDbUninstallScripts']);
    expect(listVisiblePackageUninstallScriptOptions(null)).toEqual([]);
  });

  it('includes uninstall script option in full scope list', () => {
    expect(listVisiblePackageUninstallScopeOptions(manifestWithoutSql)).toEqual([
      'portal_nav',
      'apis',
      'ui_components',
      'runDbUninstallScripts',
    ]);
  });

  it('marks uninstall script option runnable only when SQL exists', () => {
    expect(isPackageUninstallScriptOptionRunnable(extensionManifest)).toBe(true);
    expect(isPackageUninstallScriptOptionRunnable(manifestWithoutSql)).toBe(false);
    expect(isPackageUninstallScriptOptionRunnable(manifestWithoutSql, {
      uninstallSql: 'DROP TABLE demo_items;',
    })).toBe(true);
  });

  it('includes files scope for ui routes and vertical apps', () => {
    expect(listVisiblePackageUninstallCapabilityOptions(extensionWithRoutes)).toContain('files');
    expect(packageHasUninstallFileScope(extensionManifest, { pluginKind: 'vertical-app' })).toBe(true);
    expect(packageHasUninstallFileScope(extensionManifest, { deploymentStatus: 'applied' })).toBe(true);
  });

  it('defaults uninstall script scope to false when SQL is unavailable', () => {
    expect(buildDefaultPackageUninstallRemoveScope(manifestWithoutSql)).toMatchObject({
      runDbUninstallScripts: false,
    });
    expect(buildDefaultPackageUninstallRemoveScope(extensionManifest)).toMatchObject({
      runDbUninstallScripts: true,
    });
  });

  it('defaults hidden capability scopes to false', () => {
    const manifest: PackageBundleManifest = {
      ...extensionManifest,
      capabilities: {
        apis: extensionManifest.capabilities.apis,
        ui_components: [],
        db_objects: [],
      },
    };
    expect(buildDefaultPackageUninstallRemoveScope(manifest)).toEqual({
      apis: true,
      ui_components: false,
      portal_nav: false,
      files: false,
      runDbUninstallScripts: false,
    });
  });

  it('uses wizard-aligned labels and contextual file labels', () => {
    expect(resolvePackageUninstallScopeLabel('apis')).toBe('Server Functions');
    expect(resolvePackageUninstallScopeLabel('portal_nav')).toBe('Portal');
    expect(resolvePackageUninstallScopeLabel('runDbUninstallScripts')).toBe('Uninstall Scripts');
    expect(resolvePackageUninstallScopeLabel('files', extensionWithRoutes)).toBe('UI routes');
    expect(resolvePackageUninstallScopeLabel('files', extensionManifest, { pluginKind: 'vertical-app' }))
      .toBe('App runtime');
  });

  it('uses wizard-aligned hints and unavailable script messages', () => {
    expect(resolvePackageUninstallScopeHint('ui_components')).toContain('designer components');
    expect(resolvePackageUninstallScopeHint('runDbUninstallScripts', extensionManifest)).toContain('uninstall scripts');
    expect(resolvePackageUninstallScopeHint('runDbUninstallScripts', manifestWithoutSql))
      .toContain('does not include uninstall SQL');
  });

  it('detects edge data capabilities and gates them on the shared "files" scope', () => {
    expect(packageHasEdgeData(extensionManifest)).toBe(false);
    expect(packageHasEdgeData(extensionWithEdgeData)).toBe(true);
    expect(packageHasUninstallFileScope(extensionWithEdgeData)).toBe(true);
    expect(listVisiblePackageUninstallCapabilityOptions(extensionWithEdgeData)).toContain('files');
  });

  it('labels and hints the files scope distinctly for edge-data-only, ui-routes-only, and both', () => {
    expect(resolvePackageUninstallScopeLabel('files', extensionWithEdgeData)).toBe('Edge data');
    expect(resolvePackageUninstallScopeLabel('files', extensionWithRoutes)).toBe('UI routes');
    expect(resolvePackageUninstallScopeLabel('files', extensionWithRoutesAndEdgeData)).toBe('UI routes & Edge data');

    expect(resolvePackageUninstallScopeHint('files', extensionWithEdgeData)).toContain('edge models/APIs');
    expect(resolvePackageUninstallScopeHint('files', extensionWithRoutesAndEdgeData)).toContain('edge models/APIs');
    expect(resolvePackageUninstallScopeHint('files', extensionWithRoutesAndEdgeData)).toContain('UI route sources');
  });

  it('treats navigation_patches as portal uninstall scope', () => {
    const remoteHubsLike = {
      id: 'remote-hubs',
      name: 'Remote Hubs',
      version: '1.0.0',
      requiredAppVersion: '>=1.0.0',
      capabilities: {
        apis: [],
        ui_components: [],
        db_objects: [],
        navigation_patches: [{ navigationId: 'studio', entry: 'platform/navigation-patches/studio.json' }],
      },
    } as PackageBundleManifest;
    expect(packageHasPortalNavCapabilities(remoteHubsLike)).toBe(true);
    expect(listVisiblePackageUninstallCapabilityOptions(remoteHubsLike)).toEqual(['portal_nav']);
    expect(buildDefaultPackageUninstallRemoveScope(remoteHubsLike)).toMatchObject({
      portal_nav: true,
      files: false,
    });
  });
});
