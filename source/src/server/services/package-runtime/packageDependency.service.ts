import { resolveInstallDependencies } from '../../../core/packages/DependencyResolver';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import type { DependencyGraph } from '../../../core/packages/DependencyResolver';
import {
  detectReverseDependencies,
  getDependencyGraph as readDependencyGraph,
  getInstalledDependencyInputs,
  writeDependencyGraph,
} from '../../domain/package-domain/dependencyGraphRepository';
import { getInstalledVersionsMap } from '../../domain/package-domain/installStateRepository';
import type { PackageLifecycleResult } from '../../domain/package-domain/types';

export interface PackageDependencyService {
  checkInstallDependencies(packageId: string, manifest: PackageManifest): PackageLifecycleResult | null;
  checkReverseDependencies(packageId: string, installedVersion: string): PackageLifecycleResult | null;
  refreshGraph(): void;
  getGraph(): DependencyGraph;
}

export class DefaultPackageDependencyService implements PackageDependencyService {
  checkInstallDependencies(packageId: string, manifest: PackageManifest): PackageLifecycleResult | null {
    const resolution = resolveInstallDependencies(
      packageId,
      manifest,
      getInstalledVersionsMap(),
      getInstalledDependencyInputs(),
    );
    const depIssues = [...resolution.missing, ...resolution.conflicts, ...resolution.cycles];
    if (depIssues.length === 0) {
      return null;
    }

    const msg = resolution.missing.length > 0
      ? 'Dependency requirements were not satisfied.'
      : resolution.conflicts.length > 0
        ? 'Dependency version constraints were not satisfied.'
        : 'Dependency cycle was detected.';

    return {
      success: false,
      error: msg,
      code: resolution.missing.length > 0
        ? 'dependency_missing'
        : resolution.conflicts.length > 0
          ? 'dependency_conflict'
          : 'dependency_cycle',
      details: depIssues,
      operation: 'install',
    };
  }

  checkReverseDependencies(packageId: string, installedVersion: string): PackageLifecycleResult | null {
    const reverseDeps = detectReverseDependencies(packageId, installedVersion);
    if (reverseDeps.length === 0) {
      return null;
    }

    const msg = `Uninstall blocked. Required by: ${reverseDeps.join(', ')}`;
    return {
      success: false,
      error: msg,
      code: 'reverse_dependency_blocked',
      details: reverseDeps,
      operation: 'uninstall',
    };
  }

  refreshGraph(): void {
    writeDependencyGraph();
  }

  getGraph(): DependencyGraph {
    return readDependencyGraph();
  }
}

export const createPackageDependencyService = (): PackageDependencyService =>
  new DefaultPackageDependencyService();
