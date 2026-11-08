import { describe, expect, it } from 'vitest';
import {
  buildEdgeStatusByKey,
  inferFailedNodeKeyFromEvidence,
  reduceProofAndNodeInstances,
  reduceSimulationEvidence,
} from '../executionVisualization';
import type { WorkflowExecuteEvidenceEntry, WorkflowNodeInstanceRecord, WorkflowProofEntry } from '../../types';

const evidence = (entries: Array<Omit<WorkflowExecuteEvidenceEntry, 'sequence'> & { sequence?: number }>): WorkflowExecuteEvidenceEntry[] =>
  entries.map((entry, index) => ({ sequence: entry.sequence ?? index + 1, ...entry }));

describe('reduceSimulationEvidence', () => {
  it('marks nodes running, succeeded, and traversed edges during replay', () => {
    const trace = evidence([
      { type: 'NODE_ENTERED', nodeKey: 'start', detail: {} },
      { type: 'EDGE_SELECTED', nodeKey: 'start', detail: { edgeKey: 'e1' } },
      { type: 'NODE_ENTERED', nodeKey: 'action', detail: {} },
      { type: 'EDGE_SELECTED', nodeKey: 'action', detail: { edgeKey: 'e2' } },
      { type: 'NODE_ENTERED', nodeKey: 'end', detail: {} },
      { type: 'INSTANCE_SUCCEEDED', nodeKey: 'end', detail: {} },
    ]);

    const mid = reduceSimulationEvidence(trace, 3);
    expect(mid.nodeStatusByKey.start).toBe('SUCCEEDED');
    expect(mid.nodeStatusByKey.action).toBe('RUNNING');
    expect(mid.traversedEdgeKeys).toEqual(['e1']);
    expect(mid.activeEdgeKey).toBeUndefined();

    const done = reduceSimulationEvidence(trace, trace.length);
    expect(done.nodeStatusByKey.end).toBe('SUCCEEDED');
    expect(done.traversedEdgeKeys).toEqual(['e1', 'e2']);
    expect(buildEdgeStatusByKey(done).e2).toBe('traversed');
  });

  it('marks failed terminal nodes and infers failure without INSTANCE_FAILED', () => {
    const trace = evidence([
      { type: 'NODE_ENTERED', nodeKey: 'start', detail: {} },
      { type: 'EDGE_SELECTED', nodeKey: 'start', detail: { edgeKey: 'e1' } },
      { type: 'NODE_ENTERED', nodeKey: 'action', detail: {} },
    ]);

    expect(inferFailedNodeKeyFromEvidence(trace)).toBe('action');

    const failed = reduceSimulationEvidence(trace, trace.length, { markFailedNodeKey: 'action' });
    expect(failed.nodeStatusByKey.action).toBe('FAILED');
    expect(failed.nodeStatusByKey.start).toBe('SUCCEEDED');
  });

  it('marks INSTANCE_FAILED nodes red', () => {
    const trace = evidence([
      { type: 'NODE_ENTERED', nodeKey: 'fail', detail: {} },
      { type: 'INSTANCE_FAILED', nodeKey: 'fail', detail: { errorCode: 'ERR' } },
    ]);

    const state = reduceSimulationEvidence(trace, trace.length);
    expect(state.nodeStatusByKey.fail).toBe('FAILED');
  });
});

describe('reduceProofAndNodeInstances', () => {
  const node = (semanticNodeKey: string, status: WorkflowNodeInstanceRecord['status']): WorkflowNodeInstanceRecord => ({
    id: 1,
    workflowInstanceId: 1,
    semanticNodeKey,
    status,
    stateVersion: 1,
    branchTokenId: null,
    createdAt: null,
    updatedAt: null,
  });

  it('collects traversed edges from proof traces', () => {
    const proof: WorkflowProofEntry[] = [
      {
        sequenceNumber: 1,
        traceType: 'EDGE_SELECTED',
        nodeInstanceId: 1,
        corePayloadJson: JSON.stringify({ edgeKey: 'e1' }),
        diagnosticPayloadJson: null,
        createdAt: null,
      },
      {
        sequenceNumber: 2,
        traceType: 'EDGE_SELECTED',
        nodeInstanceId: 2,
        corePayloadJson: JSON.stringify({ edgeKey: 'e2' }),
        diagnosticPayloadJson: null,
        createdAt: null,
      },
    ];

    const state = reduceProofAndNodeInstances(proof, [
      node('start', 'SUCCEEDED'),
      node('action', 'RUNNING'),
    ]);

    expect(state.nodeStatusByKey.action).toBe('RUNNING');
    expect(state.traversedEdgeKeys).toEqual(['e1']);
    expect(state.activeEdgeKey).toBe('e2');
  });
});
