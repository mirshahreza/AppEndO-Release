import type {
  BuilderArtifactMutation,
  BuilderPhase,
  BuilderResult,
} from '../../api/contracts/appendoo/builderProtocol.types';
import {
  DEFAULT_BUILDER_ORCHESTRATION_POLICY,
  type BuilderOrchestrationPolicy,
  isAllowedBuilderPhase,
} from './builderOrchestrationScaffold';

export type OrchestratedBuilderRunResult = {
  ok: boolean;
  completedPhases: BuilderPhase[];
  previewMutations: BuilderArtifactMutation[];
  executeMutations: BuilderArtifactMutation[];
  reconcileMutations: BuilderArtifactMutation[];
  failures: string[];
};

export type BuilderPhaseInvoker = (
  phase: BuilderPhase,
  executedMutations?: BuilderArtifactMutation[],
  rollbackData?: Record<string, unknown>,
) => BuilderResult;

/** AE-8.2 — run validate → preview → execute → reconcile in policy order. */
export const runOrchestratedBuilderPhases = (
  invokePhase: BuilderPhaseInvoker,
  policy: BuilderOrchestrationPolicy = DEFAULT_BUILDER_ORCHESTRATION_POLICY,
): OrchestratedBuilderRunResult => {
  const failures: string[] = [];
  const completedPhases: BuilderPhase[] = [];
  let previewMutations: BuilderArtifactMutation[] = [];
  let executeMutations: BuilderArtifactMutation[] = [];
  let reconcileMutations: BuilderArtifactMutation[] = [];

  const run = (phase: BuilderPhase): BuilderResult | null => {
    if (!isAllowedBuilderPhase(phase, policy)) {
      failures.push(`Phase ${phase} is not allowed by orchestration policy.`);
      return null;
    }

    const result = invokePhase(
      phase,
      executeMutations,
      executeMutations.length > 0 ? { revisionScopedMutations: executeMutations } : undefined,
    );
    completedPhases.push(phase);
    return result;
  };

  const validate = run('validate');
  if (!validate || (validate.phase === 'validate' && !validate.ok)) {
    if (validate?.phase === 'validate') {
      failures.push(...validate.errors);
    }
    return {
      ok: false,
      completedPhases,
      previewMutations,
      executeMutations,
      reconcileMutations,
      failures,
    };
  }

  if (policy.requirePreviewBeforeExecute) {
    const preview = run('preview');
    if (!preview || (preview.phase === 'preview' && !preview.ok)) {
      if (preview?.phase === 'preview') {
        failures.push('Preview phase failed.');
      }
      return {
        ok: false,
        completedPhases,
        previewMutations,
        executeMutations,
        reconcileMutations,
        failures,
      };
    }
    if (preview.phase === 'preview') {
      previewMutations = preview.plannedMutations;
    }
  }

  const execute = run('execute');
  if (!execute || (execute.phase === 'execute' && !execute.ok)) {
    failures.push('Execute phase failed.');
    return {
      ok: false,
      completedPhases,
      previewMutations,
      executeMutations,
      reconcileMutations,
      failures,
    };
  }
  if (execute.phase === 'execute') {
    executeMutations = execute.mutations;
  }

  const reconcile = run('reconcile');
  if (!reconcile || (reconcile.phase === 'reconcile' && !reconcile.ok)) {
    failures.push('Reconcile phase failed.');
    return {
      ok: false,
      completedPhases,
      previewMutations,
      executeMutations,
      reconcileMutations,
      failures,
    };
  }
  if (reconcile.phase === 'reconcile') {
    reconcileMutations = reconcile.reconciledMutations;
  }

  return {
    ok: failures.length === 0,
    completedPhases,
    previewMutations,
    executeMutations,
    reconcileMutations,
    failures,
  };
};
