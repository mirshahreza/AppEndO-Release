import type { ChangeNode } from '../../api/contracts/appendoo/changeGraph.types';
import { DEFAULT_BUILDER_REGISTRY } from '../../api/contracts/appendoo/builderProtocol.types';
import {
  createBuilderContextScaffold,
  validateBuilderMutationPaths,
  validateChangeNodeProviderBinding,
} from './builderProtocolScaffold';
import { runOrchestratedBuilderPhases } from './builderOrchestrationRunner';
import { summarizeBuilderOrchestration } from './builderOrchestrationScaffold';
import { summarizeEngineeringOrchestration } from './engineeringOrchestratorScaffold';
import {
  resolveBuilderPrimitivePaths,
  resolveBuilderTypeForOperation,
} from './builderPrimitivePaths';
import { runExecuteScaffold, runPreviewScaffold } from './builderExecuteScaffold';
import { runReconcileScaffold } from './builderReconcileScaffold';
export type BuilderOrchestrationHealthProbe = {
  ok: boolean;
  builderOrchestrationVersion: string;
  engineeringOrchestratorVersion: string;
  failures: string[];
};

const sampleNode = (): ChangeNode => ({
  nodeId: 'node:health-fn',
  operationId: 'op:cs-health:1',
  changeSetId: 'cs-health',
  operationType: 'CREATE_SERVER_FUNCTION',
  targetRef: { targetKind: 'function', targetId: 'health-check', ref: 'health-check' },
  inputs: {},
  expectedOutputs: ['Health check function'],
  dependencies: [],
  requiredCapabilityIds: ['capability:appendo-server-functions'],
  capabilitySnapshotVersion: '1.0.0:agent:',
  providerBinding: {
    capabilityId: 'capability:appendo-server-functions',
    providerBindingId: 'binding:appendo-server-functions',
    capabilitySnapshotVersion: '1.0.0:agent:',
  },
  workspaceMutationScope: ['appendoo/ws/cs-health/**'],
  state: 'READY',
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
});

/** AE-8.2/8.3 — health probe for orchestrated builder phases + worker policy. */
export const probeBuilderOrchestrationScaffold = (): BuilderOrchestrationHealthProbe => {
  const failures: string[] = [];
  const orchestration = summarizeBuilderOrchestration();
  const engineering = summarizeEngineeringOrchestration();

  if (orchestration.registeredBuilderCount !== DEFAULT_BUILDER_REGISTRY.length) {
    failures.push('Builder registry count mismatch.');
  }

  const node = sampleNode();
  const binding = validateChangeNodeProviderBinding(node);
  if (!binding.ok) {
    failures.push(...binding.errors);
  }

  const builderType = resolveBuilderTypeForOperation(node.operationType);
  if (builderType !== 'ServerFunctionBuilder') {
    failures.push('Expected ServerFunctionBuilder for CREATE_SERVER_FUNCTION.');
  }

  const context = createBuilderContextScaffold({
    workspaceId: 'ws-health',
    revisionId: 'rev-health',
    changeSetId: node.changeSetId,
    changeNode: node,
    validatedCapabilities: [{
      capabilityId: 'capability:appendo-server-functions',
      providerBindingId: 'binding:appendo-server-functions',
    }],
  });

  const paths = resolveBuilderPrimitivePaths(node);
  const pathValidation = validateBuilderMutationPaths(paths);
  if (!pathValidation.ok) {
    failures.push(...pathValidation.errors);
  }

  const orchestrated = runOrchestratedBuilderPhases((phase, executedMutations) => {
    if (phase === 'validate') {
      return pathValidation;
    }
    if (phase === 'preview') {
      return runPreviewScaffold(context, paths);
    }
    if (phase === 'execute') {
      return runExecuteScaffold(context, paths);
    }
    if (phase === 'reconcile') {
      const mutations = executedMutations ?? runExecuteScaffold(context, paths).mutations;
      return runReconcileScaffold(context, mutations);
    }
    return pathValidation;
  });

  if (!orchestrated.ok) {
    failures.push(...orchestrated.failures);
  }
  if (!orchestrated.completedPhases.includes('preview')) {
    failures.push('Orchestration should complete preview phase.');
  }
  if (orchestrated.executeMutations.length === 0) {
    failures.push('Orchestration should record execute mutations.');
  }

  if (engineering.workerRoles.length < 5) {
    failures.push('Engineering orchestrator worker roles incomplete.');
  }

  return {
    ok: failures.length === 0,
    builderOrchestrationVersion: orchestration.version,
    engineeringOrchestratorVersion: engineering.version,
    failures,
  };
};
