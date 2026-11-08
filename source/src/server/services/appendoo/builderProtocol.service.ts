import type {
  BuilderContext,
  BuilderPhase,
  BuilderRegistryEntry,
  BuilderResult,
  BuilderValidationResult,
  ResolveBuilderInput,
} from '../../../shared/api/contracts/appendoo/builderProtocol.types';
import type { AppEndooSemanticPlan } from '../../../shared/api/contracts/appendoo/semanticPlan.types';
import { DEFAULT_BUILDER_REGISTRY } from '../../../shared/api/contracts/appendoo/builderProtocol.types';
import { validateBuilderContextWithPlan } from '../../../shared/lib/appendoo/builderInputSufficiency';
import {
  createBuilderContextScaffold,
  resolveBuilderForOperation,
  validateBuilderContext,
} from '../../../shared/lib/appendoo/builderProtocolScaffold';
import {
  resolveWorkspaceMutationPath,
  runExecuteScaffold,
  runPreviewScaffold,
} from '../../../shared/lib/appendoo/builderExecuteScaffold';
import { resolveBuilderPrimitivePaths } from '../../../shared/lib/appendoo/builderPrimitivePaths';
import {
  runReconcileScaffold,
  runRollbackScaffold,
} from '../../../shared/lib/appendoo/builderReconcileScaffold';
import { runOrchestratedBuilderPhases } from '../../../shared/lib/appendoo/builderOrchestrationRunner';
import type { BuilderArtifactMutation } from '../../../shared/api/contracts/appendoo/builderProtocol.types';

export class BuilderProtocolService {
  constructor(private registry: BuilderRegistryEntry[] = DEFAULT_BUILDER_REGISTRY) {}

  resolveBuilder(input: ResolveBuilderInput): BuilderRegistryEntry | null {
    return resolveBuilderForOperation(input, this.registry);
  }

  createContext(input: Parameters<typeof createBuilderContextScaffold>[0]): BuilderContext {
    return createBuilderContextScaffold(input);
  }

  /** AE-8.2/8.3 — validate, preview, execute, reconcile, and rollback scaffold phases. */
  runPhase(
    context: BuilderContext,
    phase: BuilderPhase,
    mutationPaths: string[] = [],
    executedMutations: BuilderArtifactMutation[] = [],
    rollbackData?: Record<string, unknown>,
    plan?: AppEndooSemanticPlan,
  ): BuilderResult {
    const paths = mutationPaths.length > 0
      ? mutationPaths
      : resolveBuilderPrimitivePaths(context.changeNode);

    if (phase === 'validate') {
      return validateBuilderContextWithPlan(
        context,
        paths,
        plan,
        validateBuilderContext,
      );
    }

    if (phase === 'preview') {
      const validation = this.runPhase(context, 'validate', paths, [], undefined, plan);
      if (validation.phase === 'validate' && !validation.ok) {
        return validation;
      }
      return runPreviewScaffold(context, paths);
    }

    if (phase === 'execute') {
      const validation = this.runPhase(context, 'validate', paths, [], undefined, plan);
      if (validation.phase === 'validate' && !validation.ok) {
        return validation;
      }
      return runExecuteScaffold(context, paths);
    }

    if (phase === 'reconcile') {
      const mutations = executedMutations.length > 0
        ? executedMutations
        : runExecuteScaffold(context, paths).mutations;
      return runReconcileScaffold(context, mutations);
    }

    if (phase === 'rollback') {
      return runRollbackScaffold(context, context.changeNode, rollbackData);
    }

    return {
      ok: false,
      phase: 'validate',
      errors: [`Phase ${phase} not implemented`],
      warnings: [],
    } satisfies BuilderValidationResult;
  }

  listRegistry(): BuilderRegistryEntry[] {
    return [...this.registry];
  }

  /** AE-8.2 — orchestrated validate → preview → execute → reconcile for one ChangeNode. */
  runOrchestratedPhases(context: BuilderContext, plan?: AppEndooSemanticPlan, mutationPaths: string[] = []) {
    const paths = mutationPaths.length > 0
      ? mutationPaths
      : resolveBuilderPrimitivePaths(context.changeNode);

    return runOrchestratedBuilderPhases((phase, executedMutations, rollbackData) => (
      this.runPhase(context, phase, paths, executedMutations, rollbackData, plan)
    ));
  }
}

export const builderProtocolService = new BuilderProtocolService();
