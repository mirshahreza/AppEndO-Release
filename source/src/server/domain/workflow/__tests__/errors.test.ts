import { describe, expect, it } from 'vitest';
import { WORKFLOW_ERROR_REGISTRY, WorkflowDomainError, isWorkflowDomainError } from '../errors';

describe('WORKFLOW_ERROR_REGISTRY (doc 03 sections 14 and 30)', () => {
  /**
   * 33 entries are the original frozen doc03 §14/§30 contract (9 + 24). `WF_EXEC_SUBFLOW_RECURSION_LIMIT_EXCEEDED`
   * (WFV2-4, p-62) plus `WF_EXEC_FOR_EACH_ITEMS_NOT_ARRAY`/`WF_EXEC_FOR_EACH_ITEM_LIMIT_EXCEEDED`
   * (WFV2-2, p-60 — the FOR_EACH dynamic-fork node) plus `WF_EXEC_LOOP_LIMIT_EXCEEDED` (in-process
   * LOOP) plus `WF_EXEC_WORK_ITEM_OUTPUT_INVALID` (HWF-1.2, p-100 — WORK_ITEM completion output vs.
   * `outputSchema` validation) plus `WF_EXEC_WORK_ITEM_REASON_REQUIRED` (HWF-4.5, p-100 — completion
   * outcome is in the node's `requireReasonOutcomes` but `output.reason` is missing/blank) are the
   * legitimate additions beyond that frozen count so far. Bump this number again, with the same kind
   * of comment, the next time a real item needs a new machine code — never let it drift silently.
   */
  it('has exactly 39 entries (33 from the frozen doc 03 contract + 6 additions)', () => {
    expect(Object.keys(WORKFLOW_ERROR_REGISTRY)).toHaveLength(39);
  });

  it('every machine code is unique (no code registered twice)', () => {
    const codes = Object.values(WORKFLOW_ERROR_REGISTRY);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every machine code uses the canonical WF_ prefix and a recognized subsystem segment', () => {
    const allowedSubsystems = ['WF_ACTION_', 'WF_EXEC_', 'WF_DEF_', 'WF_SIM_', 'WF_AUTH_'];
    for (const code of Object.values(WORKFLOW_ERROR_REGISTRY)) {
      expect(code.startsWith('WF_')).toBe(true);
      expect(allowedSubsystems.some((prefix) => code.startsWith(prefix))).toBe(true);
    }
  });

  it('contains every exact code named in doc 03 section 14', () => {
    const section14Codes = [
      'WF_ACTION_OUTCOME_UNKNOWN',
      'WF_ACTION_IMPLEMENTATION_UNAVAILABLE',
      'WF_EXEC_PAYLOAD_LIMIT_EXCEEDED',
      'WF_EXEC_ENGINE_INVARIANT',
      'WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT',
      'WF_SIM_PATH_ENUMERATION_TRUNCATED',
      'WF_DEF_AMBIGUOUS_DECISION',
      'WF_EXEC_AMBIGUOUS_DECISION',
      'WF_ACTION_IDEMPOTENCY_INCOMPATIBLE',
    ];
    const registeredCodes = new Set(Object.values(WORKFLOW_ERROR_REGISTRY));
    for (const code of section14Codes) {
      expect(registeredCodes.has(code as never)).toBe(true);
    }
  });

  it('contains every exact code named in doc 03 section 30', () => {
    const section30Codes = [
      'WF_DEF_INVALID_AWM',
      'WF_DEF_INVALID_EDGE_SHAPE',
      'WF_DEF_INVALID_REFERENCE',
      'WF_DEF_INVALID_PARALLEL_STRUCTURE',
      'WF_DEF_INVALID_RETRY_POLICY',
      'WF_DEF_STALE_DRAFT_VERSION',
      'WF_DEF_STALE_REVISION_VERSION',
      'WF_DEF_NOT_STARTABLE',
      'WF_DEF_ACTION_UNAVAILABLE',
      'WF_EXEC_STALE_STATE_VERSION',
      'WF_EXEC_INSTANCE_NOT_EXECUTABLE',
      'WF_EXEC_NODE_NOT_ELIGIBLE',
      'WF_EXEC_EXPRESSION_FAILED',
      'WF_EXEC_ACTION_OUTPUT_INVALID',
      'WF_EXEC_WAIT_NOT_ACTIVE',
      'WF_EXEC_WORK_ITEM_NOT_ACTIVE',
      'WF_EXEC_WORK_ITEM_OUTCOME_INVALID',
      'WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED',
      'WF_EXEC_UNHANDLED_NODE_FAILURE',
      'WF_EXEC_SUBFLOW_FAILED',
      'WF_EXEC_SUBFLOW_CANCELLED',
      'WF_AUTH_FORBIDDEN',
      'WF_SIM_INVALID_SOURCE',
      'WF_SIM_MISSING_FIXTURE',
    ];
    const registeredCodes = new Set(Object.values(WORKFLOW_ERROR_REGISTRY));
    for (const code of section30Codes) {
      expect(registeredCodes.has(code as never)).toBe(true);
    }
  });
});

describe('WorkflowDomainError', () => {
  it('carries code, message, and optional details', () => {
    const error = new WorkflowDomainError('WF_EXEC_STALE_STATE_VERSION', 'stale version', { id: 1 });
    expect(error.code).toBe('WF_EXEC_STALE_STATE_VERSION');
    expect(error.message).toBe('stale version');
    expect(error.details).toEqual({ id: 1 });
    expect(error.name).toBe('WorkflowDomainError');
    expect(error).toBeInstanceOf(Error);
  });

  it('isWorkflowDomainError narrows correctly', () => {
    const error = new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'forbidden');
    expect(isWorkflowDomainError(error)).toBe(true);
    expect(isWorkflowDomainError(new Error('plain'))).toBe(false);
    expect(isWorkflowDomainError('not an error')).toBe(false);
  });
});
