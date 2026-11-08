import type { ChangeNode, ChangeOperationType } from './changeGraph.types';
import type { EngineeringKnowledgeRecord } from './knowledgeRegistry.types';

/** Builder lifecycle phases (Phase 16). */
export type BuilderPhase =
  | 'validate'
  | 'preview'
  | 'execute'
  | 'reconcile'
  | 'rollback';

export type BuilderType =
  | 'EntityRelationBuilder'
  | 'ServerFunctionBuilder'
  | 'PageComponentBuilder'
  | 'RouteBuilder'
  | 'PermissionBuilder'
  | 'PackageManifestBuilder'
  | 'MigrationBuilder'
  | 'ConfigurationBuilder'
  | 'WorkflowBuilder';

export type BuilderArtifactMutation = {
  artifactId: string;
  path?: string;
  fingerprint: string;
  mutation: 'created' | 'modified' | 'deleted';
};

export type BuilderCapabilityRef = {
  capabilityId: string;
  providerBindingId?: string;
  capabilitySnapshotVersion?: string;
};

export type BuilderKnowledgeRef = {
  recordId: string;
  sourceId: string;
  trust: EngineeringKnowledgeRecord['trust'];
};

/** Context passed to every Builder invocation (Phase 16). */
export type BuilderContext = {
  workspaceId: string;
  revisionId: string;
  operationId: string;
  changeSetId: string;
  correlationId?: string;
  changeNode: ChangeNode;
  applicableStandards: EngineeringKnowledgeRecord[];
  patternVersions: string[];
  validatedCapabilities: BuilderCapabilityRef[];
};

export type BuilderValidationResult = {
  ok: boolean;
  phase: 'validate';
  errors: string[];
  warnings: string[];
};

export type BuilderPreviewResult = {
  ok: boolean;
  phase: 'preview';
  plannedMutations: BuilderArtifactMutation[];
  warnings: string[];
};

export type BuilderExecuteResult = {
  ok: boolean;
  phase: 'execute';
  mutations: BuilderArtifactMutation[];
  semanticRelationships: string[];
  appliedKnowledgeRefs: BuilderKnowledgeRef[];
  usedCapabilityRefs: BuilderCapabilityRef[];
  warnings: string[];
  verificationHints: string[];
  rollbackData?: Record<string, unknown>;
};

export type BuilderReconcileResult = {
  ok: boolean;
  phase: 'reconcile';
  reconciledMutations: BuilderArtifactMutation[];
  driftDetected: boolean;
  warnings: string[];
};

export type BuilderRollbackResult = {
  ok: boolean;
  phase: 'rollback';
  restoredArtifacts: BuilderArtifactMutation[];
  warnings: string[];
};

export type BuilderResult =
  | BuilderValidationResult
  | BuilderPreviewResult
  | BuilderExecuteResult
  | BuilderReconcileResult
  | BuilderRollbackResult;

export type BuilderRegistryEntry = {
  builderType: BuilderType;
  supportedOperations: ChangeOperationType[];
  enabled: boolean;
  /** WorkflowBuilder enabled only when capability registry reports workflow support. */
  requiresCapability?: string;
  targetPrimitive: string;
};

export const BUILDER_PROTOCOL_VERSION = '1.0.0';

/** Maps change operations to responsible builder types (Phase 16 initial set). */
export const DEFAULT_BUILDER_REGISTRY: BuilderRegistryEntry[] = [
  {
    builderType: 'EntityRelationBuilder',
    supportedOperations: ['CREATE_ENTITY', 'MODIFY_ENTITY', 'REMOVE_ENTITY', 'CREATE_RELATION', 'MODIFY_RELATION', 'REMOVE_RELATION'],
    enabled: true,
    targetPrimitive: 'data-source/schema + Data API',
  },
  {
    builderType: 'ServerFunctionBuilder',
    supportedOperations: ['CREATE_SERVER_FUNCTION', 'MODIFY_SERVER_FUNCTION', 'REMOVE_SERVER_FUNCTION'],
    enabled: true,
    targetPrimitive: 'server-function author/version/registry',
  },
  {
    builderType: 'PageComponentBuilder',
    supportedOperations: ['CREATE_PAGE', 'MODIFY_PAGE', 'REMOVE_PAGE', 'CREATE_COMPONENT', 'MODIFY_COMPONENT', 'REMOVE_COMPONENT'],
    enabled: true,
    targetPrimitive: 'component-designer draft/publish',
  },
  {
    builderType: 'RouteBuilder',
    supportedOperations: ['CREATE_ROUTE', 'MODIFY_ROUTE', 'REMOVE_ROUTE'],
    enabled: true,
    targetPrimitive: 'culture/portal/page manifest',
  },
  {
    builderType: 'PermissionBuilder',
    supportedOperations: ['CREATE_PERMISSION', 'MODIFY_PERMISSION', 'REMOVE_PERMISSION'],
    enabled: true,
    targetPrimitive: 'RBAC/page/admin permissions',
  },
  {
    builderType: 'PackageManifestBuilder',
    supportedOperations: ['UPDATE_PACKAGE_MANIFEST'],
    enabled: true,
    targetPrimitive: 'package dependency/build/export',
  },
  {
    builderType: 'MigrationBuilder',
    supportedOperations: ['RUN_MIGRATION'],
    enabled: true,
    targetPrimitive: 'schema/script policy (no EdgeDbRouter base tables)',
  },
  {
    builderType: 'ConfigurationBuilder',
    supportedOperations: ['UPDATE_CONFIGURATION'],
    enabled: true,
    targetPrimitive: 'approved settings/config APIs',
  },
  {
    builderType: 'WorkflowBuilder',
    supportedOperations: ['CREATE_WORKFLOW', 'MODIFY_WORKFLOW', 'REMOVE_WORKFLOW'],
    enabled: false,
    requiresCapability: 'workflow',
    targetPrimitive: 'capability-gated workflow engine',
  },
];

export type ResolveBuilderInput = {
  operationType: ChangeOperationType;
  enabledCapabilities?: string[];
};

export type CreateBuilderContextInput = {
  workspaceId: string;
  revisionId: string;
  changeSetId: string;
  correlationId?: string;
  changeNode: ChangeNode;
  applicableStandards?: EngineeringKnowledgeRecord[];
  patternVersions?: string[];
  validatedCapabilities?: BuilderCapabilityRef[];
};
