import { readManifestCapabilityArray } from '../../../core/packages/manifestCapabilityArrays';
import type { PackageRepackRemovalsPayload } from '../../../shared/api/contracts/package/repack';
import type { PackageBundleManifest } from '../../../shared/api/contracts/package-manifest/types';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import type { NavigationManifestSummary } from '../../../shared/api/contracts/platform/navigation';
import { packageWorkflowIdentity } from './packageWorkflows';
import { resolveNavigationsForPortals } from './resolvePortalPackageDependencies';

export type BuildPackageRepackRemovalsInput = {
  existingManifest: PackageBundleManifest | null;
  markedForRemovalApiIds: Record<string, boolean>;
  markedForRemovalComponentKeys: Record<string, boolean>;
  markedForRemovalPortalSegments: Record<string, boolean>;
  markedForRemovalWorkflowIds: Record<string, boolean>;
  selectedPortalSegments: Record<string, boolean>;
  catalogPortals: ExperienceManifestPortal[];
  catalogNavigations: NavigationManifestSummary[];
};

function readManifestPortals(manifest: PackageBundleManifest | null) {
  return (
    (manifest as PackageBundleManifest & {
      capabilities: { portals?: Array<{ segment: string }> };
    })?.capabilities.portals ?? []
  );
}

function readManifestNavigations(manifest: PackageBundleManifest | null) {
  return (
    (manifest as PackageBundleManifest & {
      capabilities: { navigations?: Array<{ id: string }> };
    })?.capabilities.navigations ?? []
  );
}

function readManifestWorkflows(manifest: PackageBundleManifest | null) {
  return manifest?.capabilities.workflows ?? [];
}

export function resolveRepackNavigationRemovalIds(input: {
  existingManifest: PackageBundleManifest | null;
  markedForRemovalPortalSegments: Record<string, boolean>;
  selectedPortalSegments: Record<string, boolean>;
  catalogPortals: ExperienceManifestPortal[];
  catalogNavigations: NavigationManifestSummary[];
}): string[] {
  const existingPortals = readManifestPortals(input.existingManifest);
  const existingNavigations = readManifestNavigations(input.existingManifest);
  const existingSegments = new Set(existingPortals.map((portal) => portal.segment));

  const remainingCatalogPortals = input.catalogPortals.filter((portal) => {
    if (input.markedForRemovalPortalSegments[portal.segment]) return false;
    if (existingSegments.has(portal.segment)) return true;
    if (input.selectedPortalSegments[portal.segment]) return true;
    return false;
  });

  const hasOrphanKeptPortals = existingPortals.some(
    (portal) => !input.markedForRemovalPortalSegments[portal.segment]
      && !input.catalogPortals.some((item) => item.segment === portal.segment),
  );

  if (hasOrphanKeptPortals) {
    return [];
  }

  const neededNavigationIds = new Set(
    resolveNavigationsForPortals(remainingCatalogPortals, input.catalogNavigations)
      .map((navigation) => navigation.id),
  );

  return existingNavigations
    .filter((navigation) => !neededNavigationIds.has(navigation.id))
    .map((navigation) => navigation.id);
}

export function countPackageRepackRemovals(input: BuildPackageRepackRemovalsInput): number {
  const apis = (input.existingManifest?.capabilities.apis ?? [])
    .filter((api) => input.markedForRemovalApiIds[api.id]).length;
  const uiComponents = readManifestCapabilityArray(input.existingManifest?.capabilities.ui_components)
    .filter((item) => input.markedForRemovalComponentKeys[item.componentKey]).length;
  const portals = readManifestPortals(input.existingManifest)
    .filter((portal) => input.markedForRemovalPortalSegments[portal.segment]).length;
  const navigations = resolveRepackNavigationRemovalIds(input).length;
  const workflows = readManifestWorkflows(input.existingManifest)
    .filter((workflow) => input.markedForRemovalWorkflowIds[packageWorkflowIdentity(workflow.scopeKey, workflow.key)])
    .length;

  return apis + uiComponents + portals + navigations + workflows;
}

export function buildPackageRepackRemovals(
  input: BuildPackageRepackRemovalsInput,
): PackageRepackRemovalsPayload | null {
  const apis = (input.existingManifest?.capabilities.apis ?? [])
    .filter((api) => input.markedForRemovalApiIds[api.id])
    .map((api) => api.id);
  const ui_components = readManifestCapabilityArray(input.existingManifest?.capabilities.ui_components)
    .filter((item) => input.markedForRemovalComponentKeys[item.componentKey])
    .map((item) => item.componentKey);
  const portals = readManifestPortals(input.existingManifest)
    .filter((portal) => input.markedForRemovalPortalSegments[portal.segment])
    .map((portal) => portal.segment);
  const navigations = resolveRepackNavigationRemovalIds(input);
  const workflows = readManifestWorkflows(input.existingManifest)
    .filter((workflow) => input.markedForRemovalWorkflowIds[packageWorkflowIdentity(workflow.scopeKey, workflow.key)])
    .map((workflow) => packageWorkflowIdentity(workflow.scopeKey, workflow.key));

  if (
    apis.length === 0
    && ui_components.length === 0
    && portals.length === 0
    && navigations.length === 0
    && workflows.length === 0
  ) {
    return null;
  }

  return {
    ...(apis.length > 0 ? { apis } : {}),
    ...(ui_components.length > 0 ? { ui_components } : {}),
    ...(portals.length > 0 ? { portals } : {}),
    ...(navigations.length > 0 ? { navigations } : {}),
    ...(workflows.length > 0 ? { workflows } : {}),
  };
}
