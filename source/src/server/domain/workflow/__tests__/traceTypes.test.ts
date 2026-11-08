import { describe, expect, it } from 'vitest';
import { WORKFLOW_TRACE_TYPES, isWorkflowTraceType } from '../traceTypes';

describe('WORKFLOW_TRACE_TYPES (doc 03 section 29)', () => {
  it('has exactly the 42 closed V1 values plus 4 WFV2-14 saga-compensation additions', () => {
    expect(WORKFLOW_TRACE_TYPES).toHaveLength(46);
  });

  it('contains no duplicate values', () => {
    expect(new Set(WORKFLOW_TRACE_TYPES).size).toBe(WORKFLOW_TRACE_TYPES.length);
  });

  it('contains every literal value named in doc 03 section 29', () => {
    const expected = [
      'INSTANCE_STARTED', 'INSTANCE_SUSPENDED', 'INSTANCE_RESUMED', 'INSTANCE_CANCELLED', 'INSTANCE_SUCCEEDED', 'INSTANCE_FAILED',
      'NODE_READY', 'NODE_CLAIMED', 'EXPRESSION_EVALUATED', 'EDGE_SELECTED',
      'PARALLEL_SPLIT_CREATED', 'PARALLEL_JOIN_ARRIVAL', 'PARALLEL_JOIN_WON', 'PARALLEL_SIBLINGS_CANCELLED',
      'ACTION_RESOLVED', 'ACTION_ATTEMPT_STARTED', 'ACTION_ATTEMPT_SUCCEEDED', 'ACTION_ATTEMPT_FAILED',
      'ACTION_ATTEMPT_TIMED_OUT', 'ACTION_ATTEMPT_UNKNOWN', 'ACTION_ATTEMPT_CANCELLED', 'ACTION_RETRY_SCHEDULED',
      'RECOVERY_CLAIMED', 'WAIT_CREATED', 'WAIT_SATISFIED', 'WAIT_EXPIRED', 'WAIT_CANCELLED',
      'EVENT_CORRELATED', 'EVENT_FINAL_UNMATCHED',
      'WORK_ITEM_CREATED', 'WORK_ITEM_CLAIMED', 'WORK_ITEM_REASSIGNED', 'WORK_ITEM_COMPLETED', 'WORK_ITEM_CANCELLED', 'WORK_ITEM_FAILED',
      'WORK_ITEM_ESCALATION_STARTED', 'WORK_ITEM_ESCALATION_SUCCEEDED', 'WORK_ITEM_ESCALATION_FAILED',
      'SUBFLOW_STARTED', 'SUBFLOW_COMPLETED', 'LATE_ACTION_RESULT_IGNORED', 'ENGINE_INVARIANT',
      'COMPENSATION_STARTED', 'COMPENSATION_SUCCEEDED', 'COMPENSATION_FAILED', 'SAGA_COMPENSATION_COMPLETED',
    ];
    // The doc-derived expected list intentionally may contain items already covered; assert set equality.
    expect(new Set(WORKFLOW_TRACE_TYPES)).toEqual(new Set(expected));
  });

  it('isWorkflowTraceType narrows correctly and rejects unregistered/future strings', () => {
    expect(isWorkflowTraceType('INSTANCE_STARTED')).toBe(true);
    expect(isWorkflowTraceType('SOME_FUTURE_TRACE_TYPE')).toBe(false);
    expect(isWorkflowTraceType('')).toBe(false);
  });
});
