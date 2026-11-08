import { describe, expect, it } from 'vitest';
import { createInitialOperationalState, reduceOperationalState } from '../operationalState';
import { createRuntimeEvent, RuntimeEventSequencer } from '../runtimeEvents';
import {
  classifyToolCallActionClass,
  defaultOperationalPolicyEngine,
} from '../operationalPolicyEngine';

describe('V5 P01 — classifyToolCallActionClass', () => {
  it('classifies representative real tool names', () => {
    expect(classifyToolCallActionClass('ask_clarifying_question')).toBe('CLARIFY');
    expect(classifyToolCallActionClass('get_project_standards')).toBe('INSPECT');
    expect(classifyToolCallActionClass('run_tests')).toBe('VERIFY');
    expect(classifyToolCallActionClass('test_server_function')).toBe('VERIFY');
    expect(classifyToolCallActionClass('draft_file_patch')).toBe('EDIT');
    expect(classifyToolCallActionClass('draft_server_function')).toBe('EDIT');
    expect(classifyToolCallActionClass('read_file')).toBe('EXPLORE');
    expect(classifyToolCallActionClass('search_codebase')).toBe('EXPLORE');
  });
});

describe('V5 P01 — DefaultOperationalPolicyEngine.validateProposal', () => {
  const buildStateWithFailures = (occurrences: number, recovered: boolean) => {
    const sequencer = new RuntimeEventSequencer();
    let state = createInitialOperationalState('t', 'a');
    for (let i = 0; i < occurrences; i += 1) {
      state = reduceOperationalState(state, createRuntimeEvent({
        taskId: 't', attemptId: 'a', type: 'ToolExecutionFailed',
        payload: { toolName: 'draft_file_patch', target: 'src/x.ts', error: `fail ${i}` }, sequencer,
      }));
    }
    if (recovered) {
      state = reduceOperationalState(state, createRuntimeEvent({
        taskId: 't', attemptId: 'a', type: 'ToolExecutionCompleted',
        payload: { toolName: 'run_tests', isRetrieve: false, isDraft: false }, sequencer,
      }));
    }
    return state;
  };

  it('allows a non-EDIT action regardless of failure history', () => {
    const state = buildStateWithFailures(5, false);
    const result = defaultOperationalPolicyEngine.validateProposal({
      proposedAction: { toolName: 'read_file', actionClass: 'EXPLORE', target: 'src/x.ts' },
      state,
    });
    expect(result.allowed).toBe(true);
  });

  it('allows the first EDIT attempt (below threshold)', () => {
    const state = buildStateWithFailures(1, false);
    const result = defaultOperationalPolicyEngine.validateProposal({
      proposedAction: { toolName: 'draft_file_patch', actionClass: 'EDIT', target: 'src/x.ts' },
      state,
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks an EDIT retry on the same target after repeated unrecovered failure', () => {
    const state = buildStateWithFailures(2, false);
    const result = defaultOperationalPolicyEngine.validateProposal({
      proposedAction: { toolName: 'draft_file_patch', actionClass: 'EDIT', target: 'src/x.ts' },
      state,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reasonCode).toBe('repeated_failure_without_recovery');
    }
  });

  it('allows the EDIT again once a VERIFY success has recovered the signature', () => {
    const state = buildStateWithFailures(2, true);
    const result = defaultOperationalPolicyEngine.validateProposal({
      proposedAction: { toolName: 'draft_file_patch', actionClass: 'EDIT', target: 'src/x.ts' },
      state,
    });
    expect(result.allowed).toBe(true);
  });

  it('does not block an EDIT on a different target with the same tool', () => {
    const state = buildStateWithFailures(3, false);
    const result = defaultOperationalPolicyEngine.validateProposal({
      proposedAction: { toolName: 'draft_file_patch', actionClass: 'EDIT', target: 'src/other.ts' },
      state,
    });
    expect(result.allowed).toBe(true);
  });
});
