import type { ChangeOperationType } from '../../api/contracts/appendoo/changeGraph.types';

export const ENGINEERING_ORCHESTRATOR_VERSION = '1.0.0';

export type EngineeringWorkerRole =
  | 'DatabaseEngineering'
  | 'ServerEngineering'
  | 'UIEngineering'
  | 'SecurityPermission'
  | 'VerificationAnalyst';

export type EngineeringGateType =
  | 'clarification'
  | 'plan_approval'
  | 'destructive_approval'
  | 'governance_conflict'
  | 'capability_gap'
  | 'workspace_drift'
  | 'verification_failure'
  | 'deployment_policy';

export type EngineeringOrchestrationPolicy = {
  version: string;
  maxIterations: number;
  maxToolCallsPerWorker: number;
  requirePersistedState: boolean;
  stopOnGate: boolean;
};

export const DEFAULT_ENGINEERING_ORCHESTRATION_POLICY: EngineeringOrchestrationPolicy = {
  version: ENGINEERING_ORCHESTRATOR_VERSION,
  maxIterations: 8,
  maxToolCallsPerWorker: 12,
  requirePersistedState: true,
  stopOnGate: true,
};

const OPERATION_WORKER_MAP: Partial<Record<ChangeOperationType, EngineeringWorkerRole>> = {
  CREATE_ENTITY: 'DatabaseEngineering',
  MODIFY_ENTITY: 'DatabaseEngineering',
  REMOVE_ENTITY: 'DatabaseEngineering',
  CREATE_RELATION: 'DatabaseEngineering',
  MODIFY_RELATION: 'DatabaseEngineering',
  REMOVE_RELATION: 'DatabaseEngineering',
  RUN_MIGRATION: 'DatabaseEngineering',
  CREATE_SERVER_FUNCTION: 'ServerEngineering',
  MODIFY_SERVER_FUNCTION: 'ServerEngineering',
  REMOVE_SERVER_FUNCTION: 'ServerEngineering',
  CREATE_PAGE: 'UIEngineering',
  MODIFY_PAGE: 'UIEngineering',
  REMOVE_PAGE: 'UIEngineering',
  CREATE_COMPONENT: 'UIEngineering',
  MODIFY_COMPONENT: 'UIEngineering',
  REMOVE_COMPONENT: 'UIEngineering',
  CREATE_ROUTE: 'UIEngineering',
  MODIFY_ROUTE: 'UIEngineering',
  REMOVE_ROUTE: 'UIEngineering',
  CREATE_PERMISSION: 'SecurityPermission',
  MODIFY_PERMISSION: 'SecurityPermission',
  REMOVE_PERMISSION: 'SecurityPermission',
  UPDATE_PACKAGE_MANIFEST: 'ServerEngineering',
  UPDATE_CONFIGURATION: 'ServerEngineering',
};

export const resolveWorkerRoleForOperation = (
  operationType: ChangeOperationType,
): EngineeringWorkerRole => (
  OPERATION_WORKER_MAP[operationType] ?? 'ServerEngineering'
);

export const isWorkerAllowedForOperation = (
  role: EngineeringWorkerRole,
  operationType: ChangeOperationType,
): boolean => {
  const owner = resolveWorkerRoleForOperation(operationType);
  if (role === 'VerificationAnalyst') return false;
  return role === owner;
};

export const shouldStopAtGate = (
  gate: EngineeringGateType,
  policy: EngineeringOrchestrationPolicy = DEFAULT_ENGINEERING_ORCHESTRATION_POLICY,
): boolean => policy.stopOnGate && gate !== 'deployment_policy';

export const summarizeEngineeringOrchestration = (
  policy: EngineeringOrchestrationPolicy = DEFAULT_ENGINEERING_ORCHESTRATION_POLICY,
) => ({
  version: policy.version,
  maxIterations: policy.maxIterations,
  workerRoles: [
    'DatabaseEngineering',
    'ServerEngineering',
    'UIEngineering',
    'SecurityPermission',
    'VerificationAnalyst',
  ] as EngineeringWorkerRole[],
  gateTypes: [
    'clarification',
    'plan_approval',
    'destructive_approval',
    'governance_conflict',
    'capability_gap',
    'workspace_drift',
    'verification_failure',
    'deployment_policy',
  ] as EngineeringGateType[],
});
