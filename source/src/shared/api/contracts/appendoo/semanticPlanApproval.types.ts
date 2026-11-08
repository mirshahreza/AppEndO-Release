import type { ContextPackIndexVersions } from './contextPack.types';

export type SemanticPlanApprovalStatus = 'pending' | 'approved' | 'stale' | 'revoked';

export type SemanticPlanStaleReason = 'CONTEXT_STALE' | 'CAPABILITY_STALE';

/** Immutable approval revision binding plan + context versions (Phase 13). */
export type SemanticPlanApprovalBinding = {
  bindingId: string;
  planId: string;
  planRevision: number;
  contextPackId: string;
  contextPackRevision: number;
  intelligenceVersions: ContextPackIndexVersions;
  fingerprint: string;
  status: SemanticPlanApprovalStatus;
  staleReason?: SemanticPlanStaleReason;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
};

export type ValidateApprovalBindingResult = {
  ok: boolean;
  status: SemanticPlanApprovalStatus;
  staleReason?: SemanticPlanStaleReason;
  errors: string[];
};

export type ApproveSemanticPlanInput = {
  bindingId: string;
  approvedBy: string;
};

export type ExecuteApprovedPlanInput = {
  bindingId: string;
  executedBy: string;
};

export const SEMANTIC_PLAN_APPROVAL_VERSION = '1.0.0';
