import { describe, expect, it } from 'vitest';
import { createRuntimeEvent, RuntimeEventSequencer } from '../runtimeEvents';
import {
  createInitialOperationalState,
  hashOperationalState,
  reduceOperationalState,
  replayOperationalState,
} from '../operationalState';

describe('V5 P01 — OperationalState reducer', () => {
  it('reduces a realistic event stream into the expected final state', () => {
    const sequencer = new RuntimeEventSequencer();
    const taskId = 'task-1';
    const attemptId = 'attempt-1';
    const events = [
      createRuntimeEvent({ taskId, attemptId, type: 'TaskCreated', payload: {}, sequencer }),
      createRuntimeEvent({ taskId, attemptId, type: 'ProgressRecorded', payload: { iteration: 1, tokensEstimate: 100 }, sequencer }),
      createRuntimeEvent({
        taskId, attemptId, type: 'ToolExecutionFailed',
        payload: { toolName: 'draft_file_patch', target: 'src/x.ts', error: 'boom' }, sequencer,
      }),
      createRuntimeEvent({
        taskId, attemptId, type: 'ToolExecutionFailed',
        payload: { toolName: 'draft_file_patch', target: 'src/x.ts', error: 'boom again' }, sequencer,
      }),
      createRuntimeEvent({
        taskId, attemptId, type: 'ToolExecutionCompleted',
        payload: { toolName: 'run_tests', isRetrieve: false, isDraft: false }, sequencer,
      }),
      createRuntimeEvent({
        taskId, attemptId, type: 'ToolExecutionCompleted',
        payload: { toolName: 'draft_file_patch', isRetrieve: false, isDraft: true }, sequencer,
      }),
      createRuntimeEvent({ taskId, attemptId, type: 'TaskCompleted', payload: { reason: 'proposal_ready' }, sequencer }),
    ];

    const finalState = events.reduce(reduceOperationalState, createInitialOperationalState(taskId, attemptId));

    expect(finalState.outcomeState).toBe('COMPLETED');
    expect(finalState.draftToolCount).toBe(1);
    expect(finalState.iteration).toBe(1);
    expect(finalState.failureSignatures).toHaveLength(1);
    expect(finalState.failureSignatures[0].occurrences).toBe(2);
    // run_tests success clears (recovers) the prior failure signature.
    expect(finalState.failureSignatures[0].recoveredAt).toBeTruthy();
    expect(finalState.lastEventSequence).toBe(events.length);
  });

  it('replaying the same event stream twice produces an identical state hash (DoD)', () => {
    const buildEvents = () => {
      const sequencer = new RuntimeEventSequencer();
      return [
        createRuntimeEvent({ taskId: 't', attemptId: 'a', type: 'TaskCreated', payload: {}, sequencer }),
        createRuntimeEvent({ taskId: 't', attemptId: 'a', type: 'ProgressRecorded', payload: { iteration: 1, tokensEstimate: 50 }, sequencer }),
        createRuntimeEvent({ taskId: 't', attemptId: 'a', type: 'TaskCompleted', payload: {}, sequencer }),
      ];
    };

    const stateA = replayOperationalState('t', 'a', buildEvents());
    const stateB = replayOperationalState('t', 'a', buildEvents());

    // createdAt timestamps differ between the two independently-built event streams — the hash
    // must still match because it excludes non-deterministic fields (see hashOperationalState doc).
    expect(hashOperationalState(stateA)).toBe(hashOperationalState(stateB));
  });

  it('hash changes when a real state transition differs', () => {
    const stateA = replayOperationalState('t', 'a', [
      createRuntimeEvent({ taskId: 't', attemptId: 'a', type: 'TaskCompleted', payload: {}, sequencer: new RuntimeEventSequencer() }),
    ]);
    const stateB = replayOperationalState('t', 'a', [
      createRuntimeEvent({ taskId: 't', attemptId: 'a', type: 'TaskFailed', payload: {}, sequencer: new RuntimeEventSequencer() }),
    ]);
    expect(hashOperationalState(stateA)).not.toBe(hashOperationalState(stateB));
  });
});
