import type { ApplicationScopeRef } from './applicationScope.types';

/** Registry-driven change operations (Phase 14). */
export type ChangeOperationType =
  | 'CREATE_ENTITY'
  | 'MODIFY_ENTITY'
  | 'REMOVE_ENTITY'
  | 'CREATE_RELATION'
  | 'MODIFY_RELATION'
  | 'REMOVE_RELATION'
  | 'CREATE_SERVER_FUNCTION'
  | 'MODIFY_SERVER_FUNCTION'
  | 'REMOVE_SERVER_FUNCTION'
  | 'CREATE_PAGE'
  | 'MODIFY_PAGE'
  | 'REMOVE_PAGE'
  | 'CREATE_COMPONENT'
  | 'MODIFY_COMPONENT'
  | 'REMOVE_COMPONENT'
  | 'CREATE_PERMISSION'
  | 'MODIFY_PERMISSION'
  | 'REMOVE_PERMISSION'
  | 'CREATE_WORKFLOW'
  | 'MODIFY_WORKFLOW'
  | 'REMOVE_WORKFLOW'
  | 'CREATE_ROUTE'
  | 'MODIFY_ROUTE'
  | 'REMOVE_ROUTE'
  | 'UPDATE_CONFIGURATION'
  | 'RUN_MIGRATION'
  | 'UPDATE_PACKAGE_MANIFEST';

export type ChangeNodeState =
  | 'PLANNED'
  | 'READY'
  | 'BUILDING'
  | 'BUILT'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'FAILED';

export type ChangeReuseClassification = 'REUSED' | 'ADAPTED' | 'NEW_BUILD';

export type ChangeNodeTargetRef = {
  targetKind: 'entity' | 'relation' | 'function' | 'page' | 'component' | 'permission' | 'workflow' | 'route' | 'configuration' | 'migration' | 'package';
  targetId: string;
  ref?: string;
};

export type ChangeNodeFailure = {
  code: string;
  message: string;
  retryable: boolean;
  at: string;
};

export type ChangeNodeResult = {
  artifactRef?: string;
  fingerprint?: string;
  summary?: string;
};

export type ChangeNodeProviderBinding = {
  capabilityId: string;
  providerBindingId: string;
  providerPackageVersion?: string;
  capabilitySnapshotVersion: string;
  compositionPlanId?: string;
  compositionContractVersion?: string;
  capabilityContractVersion?: string;
  responsibilityIds?: string[];
};

/** Deterministic dependency-aware engineering operation (Phase 14). */
export type ChangeNode = {
  nodeId: string;
  operationId: string;
  changeSetId: string;
  operationType: ChangeOperationType;
  targetRef: ChangeNodeTargetRef;
  inputs: Record<string, unknown>;
  expectedOutputs: string[];
  dependencies: string[];
  requiredCapabilityIds: string[];
  capabilitySnapshotVersion?: string;
  providerBinding?: ChangeNodeProviderBinding;
  workspaceMutationScope: string[];
  verificationProfile?: string;
  rollbackProfile?: string;
  state: ChangeNodeState;
  attempts: number;
  builderType?: string;
  reuseClassification?: ChangeReuseClassification;
  result?: ChangeNodeResult;
  failure?: ChangeNodeFailure;
  createdAt: string;
  updatedAt: string;
};

export type ChangeGraph = {
  changeGraphId: string;
  changeSetId: string;
  applicationScopeRef: string;
  revision: number;
  nodes: ChangeNode[];
  compiledAt: string;
  compilerVersion: string;
};

export type CompileChangeGraphInput = {
  changeSetId: string;
  applicationScope: ApplicationScopeRef | null;
  nodes?: ChangeNode[];
};

export const CHANGE_GRAPH_COMPILER_VERSION = '1.0.0';
