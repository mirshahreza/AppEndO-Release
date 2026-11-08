/** Independent verification grades (Phase 18). */
export type VerificationGrade = 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';

export type VerificationFailureClass =
  | 'BUILDER'
  | 'PLAN'
  | 'CONTEXT'
  | 'ENVIRONMENT'
  | 'TRANSIENT';

export type VerificationLayer =
  | 'contract_schema'
  | 'parse_compile'
  | 'lint_standards'
  | 'artifact_rules'
  | 'package_boundaries'
  | 'permissions_security'
  | 'database_migration'
  | 'integration_contracts'
  | 'acceptance_criteria'
  | 'package_integrity'
  | 'semantic_model';

export type VerificationGraderDefinition = {
  graderId: string;
  version: string;
  layer: VerificationLayer;
  supports: string[];
  enabled: boolean;
};

export type VerificationGraderResult = {
  graderId: string;
  version: string;
  layer: VerificationLayer;
  grade: VerificationGrade;
  evidence: string[];
  diagnostics: string[];
  sourceRefs: string[];
  durationMs: number;
};

export type VerificationRunState = 'RUNNING' | 'COMPLETED' | 'FAILED';

/** Evidence-backed verification run bound to exact workspace revision (Phase 18). */
export type VerificationRun = {
  verificationRunId: string;
  workspaceId: string;
  revisionId: string;
  revisionFingerprint: string;
  changeSetId: string;
  state: VerificationRunState;
  graderResults: VerificationGraderResult[];
  /** Computed only by Verification Engine — never set by model/worker/builder. */
  deployable: boolean;
  failureClass?: VerificationFailureClass;
  reuseRatios?: {
    capabilityReuseRatio?: number;
    artifactReuseRatio?: number;
    changeScopeReuseRatio?: number;
  };
  startedAt: string;
  completedAt?: string;
};

export type StartVerificationRunInput = {
  workspaceId: string;
  revisionId: string;
  revisionFingerprint: string;
  changeSetId: string;
  mutationPaths?: string[];
  enabledGraderIds?: string[];
};

export const VERIFICATION_ENGINE_VERSION = '1.0.0';

/** AppEndO-specific graders scaffold (Phase 18). */
export const DEFAULT_VERIFICATION_GRADERS: VerificationGraderDefinition[] = [
  { graderId: 'fsd-dependency', version: '1.0.0', layer: 'lint_standards', supports: ['package_boundaries'], enabled: true },
  { graderId: 'clean-architecture', version: '1.0.0', layer: 'lint_standards', supports: ['artifact_rules'], enabled: true },
  { graderId: 'edge-db-boundary', version: '1.0.0', layer: 'database_migration', supports: ['migration'], enabled: true },
  { graderId: 'shared-api-queries', version: '1.0.0', layer: 'contract_schema', supports: ['data_access'], enabled: true },
  { graderId: 'server-function-openapi', version: '1.0.0', layer: 'integration_contracts', supports: ['server_function'], enabled: true },
  { graderId: 'designer-registry-binding', version: '1.0.0', layer: 'artifact_rules', supports: ['component', 'page'], enabled: true },
  { graderId: 'experience-routing', version: '1.0.0', layer: 'integration_contracts', supports: ['route'], enabled: true },
  { graderId: 'rbac-enforcement', version: '1.0.0', layer: 'permissions_security', supports: ['permission'], enabled: true },
  { graderId: 'package-manifest-policy', version: '1.0.0', layer: 'package_integrity', supports: ['package'], enabled: true },
  { graderId: 'project-standards', version: '1.0.0', layer: 'lint_standards', supports: ['standards'], enabled: true },
  { graderId: 'active-root-mutation', version: '1.0.0', layer: 'artifact_rules', supports: ['workspace'], enabled: true },
  { graderId: 'capability-binding', version: '1.0.0', layer: 'contract_schema', supports: ['capability'], enabled: true },
  { graderId: 'workspace-drift', version: '1.0.0', layer: 'artifact_rules', supports: ['workspace'], enabled: true },
];
