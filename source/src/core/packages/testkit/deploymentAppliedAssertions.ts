import type { PluginDeploymentPlatformRows } from '../../../server/services/platform/packageDeploymentToPlatformRows';
import {
  deploymentAppliedToPlatformRows,
} from '../../../server/services/platform/packageDeploymentToPlatformRows';
import { readDeploymentApplied } from '../PackageFileStore';

export function readAppliedDeploymentRows(packageId: string): PluginDeploymentPlatformRows | null {
  const applied = readDeploymentApplied(packageId);
  if (!applied) return null;
  return deploymentAppliedToPlatformRows(applied);
}

export function deploymentAppliedPath(packageId: string): string {
  return `packages-storage/deployments/${packageId}.deployment-applied.json`;
}
