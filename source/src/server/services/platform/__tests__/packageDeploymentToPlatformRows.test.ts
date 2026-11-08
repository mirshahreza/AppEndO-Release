import { describe, it, expect } from 'vitest';
import {
  deploymentAppliedToPlatformRows,
  mergeDeploymentPlatformRows,
} from '../packageDeploymentToPlatformRows';
import type {
  ExtensionUiRoutesDeploymentApplied,
  VerticalAppDeploymentApplied,
} from '../../../../shared/api/contracts/package-manifest/deploymentApplied';

describe('packageDeploymentToPlatformRows', () => {
  const verticalAppApplied: VerticalAppDeploymentApplied = {
    schema: 'package-deployment-applied',
    schemaVersion: '1.0.0',
    packageId: 'inventory',
    version: '1.0.0',
    appliedAt: '2026-06-17T12:00:00.000Z',
    kind: 'vertical-app',
    includeMount: true,
    deployment: {
      applyPolicy: 'propose',
      mount: {
        id: 'inventory',
        pathPrefix: '/inventory',
        name: 'Inventory',
        defaultRoute: 'dashboard',
      },
      shellRule: {
        pathPrefix: '/inventory',
        shellKey: 'inventory-shell',
        priority: 0,
      },
      routes: [
        {
          routePattern: 'dashboard',
          pageKey: 'dashboard',
          nav: { label: 'Dashboard', order: 1 },
        },
      ],
    },
    capabilities: {
      shell: {
        key: 'inventory-shell',
        name: 'Inventory Shell',
        entry: 'ui/shell/AppShell.js',
        surface: 'portal',
      },
      pages: [
        {
          pageKey: 'dashboard',
          title: 'Dashboard',
          entry: 'ui/pages/Dashboard.js',
        },
      ],
    },
  };

  it('maps vertical-app deployment file to platform rows', () => {
    const rows = deploymentAppliedToPlatformRows(verticalAppApplied);
    expect(rows.mounts).toHaveLength(1);
    expect(rows.mounts[0]?.pathPrefix).toBe('/inventory');
    expect(rows.shells[0]?.entry).toBe('package:inventory:shell');
    expect(rows.pageModules[0]?.loaderRef).toBe('inventory:dashboard');
    expect(rows.bindings[0]?.routePattern).toBe('dashboard');
    expect(rows.bindings[0]?.ownerPackageId).toBe('inventory');
  });

  it('merges overlays without duplicate keys', () => {
    const base = deploymentAppliedToPlatformRows(verticalAppApplied);
    const duplicate = deploymentAppliedToPlatformRows({
      ...verticalAppApplied,
      packageId: 'inventory-copy',
    });
    const merged = mergeDeploymentPlatformRows(base, duplicate);
    expect(merged.mounts).toHaveLength(1);
    expect(merged.pageModules).toHaveLength(1);
    expect(merged.bindings).toHaveLength(1);
  });

  it('applies Studio chrome to Remote Hubs ui_routes rows', () => {
    const applied: ExtensionUiRoutesDeploymentApplied = {
      schema: 'package-deployment-applied',
      schemaVersion: '1.0.0',
      kind: 'extension-ui-routes',
      packageId: 'remote-hubs',
      version: '1.0.0',
      appliedAt: '2026-08-27T00:00:00.000Z',
      routes: [
        {
          pageKey: 'ssh-hub',
          title: 'Ssh Hub',
          routePattern: 'ssh-hub/*',
          mountId: 'studio',
          loaderRef: 'remote-hubs:ssh-hub',
          entry: 'ui/ssh.tsx',
        },
      ],
    };
    const rows = deploymentAppliedToPlatformRows(applied);
    expect(rows.pageModules[0]?.title).toBe('SSH');
    expect(rows.bindings[0]?.routePattern).toBe('ssh/*');
    expect(rows.bindings[0]?.nav).toMatchObject({
      label: 'SSH',
      group: 'Remote Hubs',
      icon: 'tabler:IconTerminal2',
    });
  });
});
