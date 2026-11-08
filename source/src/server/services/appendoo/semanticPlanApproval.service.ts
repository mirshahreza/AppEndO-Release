import type { ApplicationScopeRef } from '../../../shared/api/contracts/appendoo/applicationScope.types';
import type { ChangeGraph } from '../../../shared/api/contracts/appendoo/changeGraph.types';
import type { ContextPack } from '../../../shared/api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan } from '../../../shared/api/contracts/appendoo/semanticPlan.types';
import type {
  SemanticPlanApprovalBinding,
  ValidateApprovalBindingResult,
} from '../../../shared/api/contracts/appendoo/semanticPlanApproval.types';
import {
  approveApprovalBinding,
  createPendingApprovalBinding,
  markApprovalBindingStale,
  validateApprovalBindingForExecution,
} from '../../../shared/lib/appendoo/semanticPlanApproval';
import { validateApprovalBindingAttribution } from '../../../shared/lib/appendoo/semanticPlanCompositionScaffold';
import { resolvePlanActionPolicy } from '../../../shared/lib/appendoo/semanticPlanAuthorityGates';
import { HttpError } from '../../errors/HttpError';

type StoredPipelineApproval = {
  binding: SemanticPlanApprovalBinding;
  plan: AppEndooSemanticPlan;
  changeGraph: ChangeGraph;
  contextPack: ContextPack;
  applicationScope: ApplicationScopeRef | null;
};

export class SemanticPlanApprovalService {
  private readonly store = new Map<string, StoredPipelineApproval>();

  registerPipelineRun(input: {
    plan: AppEndooSemanticPlan;
    changeGraph: ChangeGraph;
    contextPack: ContextPack;
    applicationScope: ApplicationScopeRef | null;
    requiresApproval: boolean;
  }): SemanticPlanApprovalBinding | undefined {
    if (!input.requiresApproval) {
      return undefined;
    }

    const actionPolicy = resolvePlanActionPolicy(input.plan);
    if (!actionPolicy.canApprove) {
      return undefined;
    }

    const binding = createPendingApprovalBinding(input.plan, input.contextPack);
    this.store.set(binding.bindingId, {
      binding,
      plan: input.plan,
      changeGraph: input.changeGraph,
      contextPack: input.contextPack,
      applicationScope: input.applicationScope,
    });
    return binding;
  }

  getBinding(bindingId: string): SemanticPlanApprovalBinding | undefined {
    return this.store.get(bindingId)?.binding;
  }

  getStoredRun(bindingId: string): StoredPipelineApproval | undefined {
    return this.store.get(bindingId);
  }

  approve(bindingId: string, approvedBy: string): SemanticPlanApprovalBinding {
    const stored = this.store.get(bindingId);
    if (!stored) {
      throw new HttpError(404, 'Semantic plan approval binding not found.');
    }

    const actionPolicy = resolvePlanActionPolicy(stored.plan);
    if (!actionPolicy.canApprove) {
      throw new HttpError(
        409,
        `Plan is not ready for approval (${actionPolicy.blockingReasonCodes.join(', ') || 'policy blocked'}).`,
      );
    }

    if (stored.binding.status === 'stale') {
      throw new HttpError(409, `Approval binding is stale (${stored.binding.staleReason ?? 'CONTEXT_STALE'}).`);
    }

    const validation = validateApprovalBindingForExecution(
      stored.binding,
      stored.plan,
      stored.contextPack,
    );

    const attribution = validateApprovalBindingAttribution(
      stored.plan,
      stored.contextPack,
      stored.binding,
    );
    if (!attribution.ok) {
      throw new HttpError(
        409,
        attribution.issues.map((issue) => issue.message).join(' '),
      );
    }

    if (validation.staleReason) {
      const staleBinding = markApprovalBindingStale(stored.binding, validation.staleReason);
      this.store.set(bindingId, { ...stored, binding: staleBinding });
      throw new HttpError(409, `Cannot approve stale binding (${validation.staleReason}).`);
    }

    const approved = approveApprovalBinding(stored.binding, approvedBy);
    this.store.set(bindingId, { ...stored, binding: approved });
    return approved;
  }

  validateForExecution(bindingId: string): ValidateApprovalBindingResult {
    const stored = this.store.get(bindingId);
    if (!stored) {
      return {
        ok: false,
        status: 'revoked',
        errors: ['Approval binding not found.'],
      };
    }

    const validation = validateApprovalBindingForExecution(
      stored.binding,
      stored.plan,
      stored.contextPack,
    );

    const attribution = validateApprovalBindingAttribution(
      stored.plan,
      stored.contextPack,
      stored.binding,
    );
    if (!attribution.ok) {
      return {
        ok: false,
        status: stored.binding.status,
        errors: attribution.issues.map((issue) => issue.message),
      };
    }

    if (validation.staleReason && stored.binding.status !== 'stale') {
      const staleBinding = markApprovalBindingStale(stored.binding, validation.staleReason);
      this.store.set(bindingId, { ...stored, binding: staleBinding });
    }

    return validation;
  }

  resetForTests(): void {
    this.store.clear();
  }
}

export const semanticPlanApprovalService = new SemanticPlanApprovalService();
