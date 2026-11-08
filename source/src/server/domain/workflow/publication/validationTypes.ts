import type { ActionResolutionRef, RetryPolicy } from '../awm/types';

/**
 * Validation issue/report shape — sole authority per
 * docs/standards/workflow-engine-testing.md (doc 03 §16)
 * 05-WORKFLOW-DEFINITION-AND-SEMANTICS.md section 13.
 */

export type ValidationIssueSeverity = 'ERROR' | 'WARNING' | 'INFO';

export type ValidationIssue = {
  code: string;
  severity: ValidationIssueSeverity;
  message: string;
  nodeKey?: string;
  edgeKey?: string;
  path?: string;
  details?: Record<string, unknown>;
};

/** One ACTION node's resolved provider binding — the per-node unit that composes `actionBindingsJson` (doc 03 section 3). */
export type ResolvedActionNodeBinding = {
  nodeKey: string;
  actionRef: ActionResolutionRef;
  actionFingerprint: string;
  resolvedRetryPolicy: RetryPolicy;
  maximumLogicalInvocationWindowMs: number;
  providerOrderPolicyVersion: 'workflow.capability-provider-order/v1';
  /** Only present for EXACT_PROVIDER (pinned at publication) — CAPABILITY_RESOLVED re-resolves the provider at each logical invocation (doc 04 section 8). */
  pinnedProvider?: { providerId: string; providerVersion: string; providerFingerprint: string };
};

export type PublicationValidationResult = {
  status: 'PASSED' | 'FAILED';
  issues: ValidationIssue[];
  actionBindings: ResolvedActionNodeBinding[];
};

export const VALIDATOR_VERSION = 'workflow.publication-validator/v1';
