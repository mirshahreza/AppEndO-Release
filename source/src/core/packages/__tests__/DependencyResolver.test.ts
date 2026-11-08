import { describe, expect, it } from 'vitest';
import {
  buildDependencyGraph,
  resolveInstallDependencies,
  satisfiesVersionRange,
  type InstalledPackageDependencyInput,
} from '../DependencyResolver';
import type { PackageManifest } from '../PackageManifestValidator';

function makeManifest(
  packageId: string,
  dependencies: Array<{ packageId: string; versionRange: string }> = [],
): PackageManifest {
  return {
    $schemaVersion: '1.0',
    id: packageId,
    name: `Package ${packageId}`,
    version: '1.0.0',
    requiredAppVersion: '>=1.0.0',
    dependencies,
    capabilities: {
      apis: [
        {
          id: `${packageId}.health`,
          method: 'GET',
          path: `/packages/${packageId}/health`,
          entry: 'edge/health.ts',
        },
      ],
      ui_components: [],
      db_objects: [],
      mcp_servers: [],
      edge_models: [],
      edge_apis: [],
      edge_model_studio_meta: [],
      install_hooks: [],
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
  };
}

function installed(
  packageId: string,
  version: string,
  manifest: PackageManifest,
): InstalledPackageDependencyInput {
  return { packageId, version, manifest };
}

describe('DependencyResolver', () => {
  it('supports semver range checks', () => {
    expect(satisfiesVersionRange('1.2.0', '>=1.0.0 <2.0.0')).toBe(true);
    expect(satisfiesVersionRange('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
    expect(satisfiesVersionRange('1.2.0', '*')).toBe(true);
  });

  it('detects missing dependencies', () => {
    const candidate = makeManifest('addon', [{ packageId: 'base', versionRange: '>=1.0.0' }]);
    const result = resolveInstallDependencies('addon', candidate, new Map(), []);
    expect(result.missing).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.cycles).toHaveLength(0);
  });

  it('detects dependency version conflicts', () => {
    const candidate = makeManifest('addon', [{ packageId: 'base', versionRange: '>=2.0.0 <3.0.0' }]);
    const result = resolveInstallDependencies(
      'addon',
      candidate,
      new Map([['base', '1.0.0']]),
      [installed('base', '1.0.0', makeManifest('base'))],
    );

    expect(result.missing).toHaveLength(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.cycles).toHaveLength(0);
  });

  it('detects cycles that include candidate package', () => {
    const candidate = makeManifest('addon', [{ packageId: 'base', versionRange: '>=1.0.0' }]);
    const baseManifest = makeManifest('base', [{ packageId: 'addon', versionRange: '>=1.0.0' }]);

    const result = resolveInstallDependencies(
      'addon',
      candidate,
      new Map([['base', '1.0.0']]),
      [installed('base', '1.0.0', baseManifest)],
    );

    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.cycles.some((x) => x.includes('addon') && x.includes('base'))).toBe(true);
  });

  it('builds dependency graph with reverse edges and cycle status', () => {
    const graph = buildDependencyGraph([
      installed('base', '1.0.0', makeManifest('base', [{ packageId: 'addon', versionRange: '>=1.0.0' }])),
      installed('addon', '1.0.0', makeManifest('addon', [{ packageId: 'base', versionRange: '>=1.0.0' }])),
    ]);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
    expect(graph.reverseEdges.some((x) => x.packageId === 'base')).toBe(true);
    expect(graph.hasCycle).toBe(true);
    expect(graph.issues.some((x) => x.includes('Dependency cycle detected'))).toBe(true);
  });
});
