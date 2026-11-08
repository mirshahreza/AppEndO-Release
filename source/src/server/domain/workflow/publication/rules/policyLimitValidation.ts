import type { WorkflowModel } from '../../awm/types';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import type { ValidationIssue } from '../validationTypes';

/** Doc 05 sections 8, 23, 27; doc 03 section 16 issue shape — configured-limit and retry-policy-shape validation. */

function jsonDepth(value: unknown): number {
  if (value === null || typeof value !== 'object') return 0;
  const values = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  if (values.length === 0) return 1;
  return 1 + Math.max(...values.map(jsonDepth));
}

export function runPolicyLimitValidation(model: WorkflowModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const limits = model.policies.limits;

  if (model.nodes.length > limits.maxNodes) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `Node count ${model.nodes.length} exceeds configured maxNodes (${limits.maxNodes}).` });
  }
  if (model.edges.length > limits.maxEdges) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `Edge count ${model.edges.length} exceeds configured maxEdges (${limits.maxEdges}).` });
  }

  const depth = jsonDepth(model as unknown);
  if (depth > limits.maxJsonDepth) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `Model JSON depth ${depth} exceeds configured maxJsonDepth (${limits.maxJsonDepth}).` });
  }

  const byteLength = Buffer.byteLength(JSON.stringify(model), 'utf8');
  if (byteLength > limits.maxPayloadBytes) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.WORKFLOW_PAYLOAD_LIMIT_EXCEEDED, severity: 'ERROR', message: `Model payload size ${byteLength} bytes exceeds configured maxPayloadBytes (${limits.maxPayloadBytes}).` });
  }

  for (const node of model.nodes) {
    if (node.kind === 'DELAY' && node.delay.value.op === 'LITERAL') {
      const value = node.delay.value.value;
      if (node.delay.type === 'DURATION_MS') {
        if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `DELAY node "${node.key}" has an invalid literal DURATION_MS delay value (doc 05 section 23).`, nodeKey: node.key });
        } else if (value > limits.maxDelayMs) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `DELAY node "${node.key}" literal duration ${value}ms exceeds configured maxDelayMs (${limits.maxDelayMs}).`, nodeKey: node.key });
        }
      } else {
        // UNTIL — a canonical UTC instant string (doc 05 section 23); no configured upper bound applies to an absolute instant.
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `DELAY node "${node.key}" has an invalid literal UNTIL delay value — MUST be a valid canonical UTC instant string (doc 05 section 23).`, nodeKey: node.key });
        }
      }
    }
    if (node.kind === 'WAIT_EVENT' && node.timeout && node.timeout.afterMs.op === 'LITERAL') {
      const value = node.timeout.afterMs.value;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WAIT_EVENT node "${node.key}" has an invalid literal timeout.afterMs value (doc 05 section 23).`, nodeKey: node.key });
      } else if (value > limits.maxWaitTimeoutMs) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WAIT_EVENT node "${node.key}" literal timeout ${value}ms exceeds configured maxWaitTimeoutMs (${limits.maxWaitTimeoutMs}).`, nodeKey: node.key });
      }
    }
    if (node.kind === 'WORK_ITEM') {
      if (node.title.op === 'LITERAL') {
        const value = node.title.value;
        if (typeof value !== 'string' || value.length === 0) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" literal title MUST be a non-empty string (doc 05 section 19).`, nodeKey: node.key });
        } else if (value.length > limits.maxWorkItemTitleLength) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" literal title exceeds configured maxWorkItemTitleLength (${limits.maxWorkItemTitleLength}).`, nodeKey: node.key });
        }
      }
      if (node.summary && node.summary.op === 'LITERAL') {
        const value = node.summary.value;
        if (typeof value !== 'string') {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" literal summary MUST be a string (doc 05 section 19).`, nodeKey: node.key });
        } else if (value.length > limits.maxWorkItemTitleLength) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" literal summary exceeds configured maxWorkItemTitleLength (${limits.maxWorkItemTitleLength}).`, nodeKey: node.key });
        }
      }
      const stepKeys = new Set<string>();
      for (const step of node.escalationPolicy?.steps ?? []) {
        if (stepKeys.has(step.key)) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" has duplicate escalation step key "${step.key}" (doc 07 section 8).`, nodeKey: node.key });
        }
        stepKeys.add(step.key);
      }
      const outcomeKeys = node.allowedOutcomes;
      if (new Set(outcomeKeys).size === 0) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `WORK_ITEM node "${node.key}" MUST declare at least one allowed outcome.`, nodeKey: node.key });
      }
    }
    if ((node.kind === 'ACTION' || node.kind === 'FOR_EACH' || node.kind === 'LOOP') && node.retryPolicy) {
      issues.push(...validateRetryPolicyShape(node.key, node.retryPolicy));
    }
  }

  if (model.policies.defaultRetryPolicy) {
    issues.push(...validateRetryPolicyShape(undefined, model.policies.defaultRetryPolicy));
  }

  return issues;
}

function validateRetryPolicyShape(nodeKey: string | undefined, policy: { strategy: string; multiplier?: number; maxDelayMs?: number; initialDelayMs: number }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (policy.strategy === 'EXPONENTIAL') {
    if (policy.multiplier !== undefined && (!Number.isFinite(policy.multiplier) || policy.multiplier < 1)) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_RETRY_POLICY, severity: 'ERROR', message: 'EXPONENTIAL retry policy requires a finite multiplier >= 1 (doc 05 section 27).', nodeKey });
    }
  }
  if (policy.maxDelayMs !== undefined && !Number.isFinite(policy.maxDelayMs)) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_RETRY_POLICY, severity: 'ERROR', message: 'Retry policy maxDelayMs must be a finite integer.', nodeKey });
  }
  if (!Number.isFinite(policy.initialDelayMs)) {
    issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_RETRY_POLICY, severity: 'ERROR', message: 'Retry policy initialDelayMs must be a finite integer.', nodeKey });
  }
  return issues;
}
