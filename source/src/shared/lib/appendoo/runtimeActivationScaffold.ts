import type { BuilderArtifactMutation } from '../../api/contracts/appendoo/builderProtocol.types';
import type { RuntimeActivationBatchResult, RuntimeActivationRecord } from '../../api/contracts/appendoo/runtimeActivation.types';
import {
  activateDesignerDraftFromWorkspace,
  activateExperienceRouteFromWorkspace,
  activateGenericWorkspaceArtifact,
  activateServerFunctionFromWorkspace,
} from './runtimeActivationAdapters';

export type RuntimeActivationKind =
  | 'server_function'
  | 'designer_draft'
  | 'experience_route'
  | 'permission'
  | 'entity_schema'
  | 'package_manifest'
  | 'configuration'
  | 'unknown';

export type RuntimeActivationTarget = {
  targetId: string;
  kind: RuntimeActivationKind;
  workspacePath: string;
  activationApi: string;
  status: 'STAGED' | 'ACTIVATED' | 'FAILED';
};

export type RuntimeActivationResult = {
  targets: RuntimeActivationTarget[];
  records: RuntimeActivationRecord[];
  activatedCount: number;
  validatedCount: number;
  failedCount: number;
};

const classifyWorkspacePath = (workspacePath: string): RuntimeActivationKind => {
  if (workspacePath.includes('/workspace/server-functions/custom/')) return 'server_function';
  if (workspacePath.includes('/workspace/designer/drafts/')) return 'designer_draft';
  if (workspacePath.includes('/workspace/platform-registry/routes/')) return 'experience_route';
  if (workspacePath.includes('/workspace/platform-registry/permissions/')) return 'permission';
  if (workspacePath.includes('/runtime/data-sources/schema/')) return 'entity_schema';
  if (workspacePath.includes('/runtime/packages/manifest.json')) return 'package_manifest';
  if (workspacePath.includes('/runtime/config/')) return 'configuration';
  return 'unknown';
};

const activationApiForKind = (kind: RuntimeActivationKind): string => {
  switch (kind) {
    case 'server_function':
      return 'FunctionFileStore.activateFromWorkspace';
    case 'designer_draft':
      return 'ComponentDesigner.publishFromWorkspaceDraft';
    case 'experience_route':
      return 'PlatformRegistry.compileExperienceRoute';
    case 'permission':
      return 'RbacRegistry.activatePermissionFromWorkspace';
    case 'entity_schema':
      return 'DataSourceRegistry.applySchemaFromWorkspace';
    case 'package_manifest':
      return 'PackageManifestService.finalizeFromWorkspace';
    case 'configuration':
      return 'ConfigurationService.applyFromWorkspace';
    default:
      return 'EngineeringWorkspaceService.stageUnknownArtifact';
  }
};

/** AE-9.4 — map workspace mutations to existing AppEndO activation APIs. */
export const planRuntimeActivations = (
  mutations: Pick<BuilderArtifactMutation, 'path' | 'artifactId'>[],
): RuntimeActivationTarget[] => {
  const uniquePaths = [...new Set(mutations.map((mutation) => mutation.path).filter(Boolean) as string[])];

  return uniquePaths.map((workspacePath) => {
    const kind = classifyWorkspacePath(workspacePath);
    const segment = workspacePath.split('/').pop() ?? workspacePath;
    return {
      targetId: segment,
      kind,
      workspacePath,
      activationApi: activationApiForKind(kind),
      status: 'STAGED',
    };
  });
};

export const activateRuntimeTarget = (target: RuntimeActivationTarget): RuntimeActivationRecord => {
  switch (target.kind) {
    case 'server_function':
      return activateServerFunctionFromWorkspace(target);
    case 'designer_draft':
      return activateDesignerDraftFromWorkspace(target);
    case 'experience_route':
      return activateExperienceRouteFromWorkspace(target);
    default:
      return activateGenericWorkspaceArtifact(target);
  }
};

/** AE-9.5 — validate workspace artifacts against platform activation contracts. */
export const executeRuntimeActivation = (
  targets: RuntimeActivationTarget[],
): RuntimeActivationBatchResult => {
  const records = targets.map((target) => activateRuntimeTarget(target));

  return {
    records,
    activatedCount: records.filter((record) => record.status === 'ACTIVATED').length,
    validatedCount: records.filter((record) => record.status === 'VALIDATED').length,
    failedCount: records.filter((record) => record.status === 'FAILED').length,
  };
};

/** @deprecated Use executeRuntimeActivation. */
export const executeRuntimeActivationScaffold = (
  targets: RuntimeActivationTarget[],
): RuntimeActivationResult => {
  const batch = executeRuntimeActivation(targets);
  return {
    targets: targets.map((target, index) => ({
      ...target,
      status: batch.records[index]?.status === 'FAILED' ? 'FAILED' : 'ACTIVATED',
    })),
    records: batch.records,
    activatedCount: batch.activatedCount,
    validatedCount: batch.validatedCount,
    failedCount: batch.failedCount,
  };
};
