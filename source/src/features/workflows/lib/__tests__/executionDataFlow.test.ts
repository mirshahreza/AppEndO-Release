import { describe, expect, it } from 'vitest';
import {
  activeStepIdForEvidenceIndex,
  buildDataFlowFromInspection,
  buildDataFlowFromSimulationEvidence,
} from '../executionDataFlow';
import type { WorkflowExecuteEvidenceEntry, WorkflowInstanceInspection, WorkflowProofEntry } from '../../types';

const evidence = (entries: Array<Omit<WorkflowExecuteEvidenceEntry, 'sequence'> & { sequence?: number }>): WorkflowExecuteEvidenceEntry[] =>
  entries.map((entry, index) => ({ sequence: entry.sequence ?? index + 1, ...entry }));

describe('buildDataFlowFromSimulationEvidence', () => {
  it('builds input, node, edge, and output steps from simulation evidence', () => {
    const trace = evidence([
      { type: 'WORKFLOW_INPUT_RECORDED', nodeKey: null, detail: { workflowInput: { id: 1 } } },
      { type: 'NODE_DATA_RECORDED', nodeKey: 'action', detail: { kind: 'ACTION', received: { x: 1 }, config: { y: 2 }, produced: { ok: true }, status: 'SUCCEEDED' } },
      { type: 'EDGE_SELECTED', nodeKey: 'action', detail: { edgeKey: 'e1', selectionMode: 'UNCONDITIONAL', selectionReason: 'success' } },
      { type: 'INSTANCE_SUCCEEDED', nodeKey: 'end', detail: { output: { done: true } } },
    ]);

    const steps = buildDataFlowFromSimulationEvidence(trace);
    expect(steps.map((step) => step.kind)).toEqual(['WORKFLOW_INPUT', 'NODE', 'EDGE', 'WORKFLOW_OUTPUT']);
    expect(steps[1].received).toEqual({ x: 1 });
    expect(steps[1].config).toEqual({ y: 2 });
    expect(steps[2].edgeKey).toBe('e1');
    expect(steps[3].produced).toEqual({ done: true });
  });

  it('tracks active step by evidence sequence during replay', () => {
    const trace = evidence([
      { type: 'WORKFLOW_INPUT_RECORDED', nodeKey: null, detail: { workflowInput: {} } },
      { type: 'NODE_DATA_RECORDED', nodeKey: 'a', detail: { kind: 'ACTION', status: 'SUCCEEDED', produced: {} } },
      { type: 'EDGE_SELECTED', nodeKey: 'a', detail: { edgeKey: 'e1' } },
    ]);
    const steps = buildDataFlowFromSimulationEvidence(trace);
    expect(activeStepIdForEvidenceIndex(steps, 1)).toBe(steps[0].id);
    expect(activeStepIdForEvidenceIndex(steps, 2)).toBe(steps[1].id);
    expect(activeStepIdForEvidenceIndex(steps, 3)).toBe(steps[2].id);
  });
});

describe('buildDataFlowFromInspection', () => {
  it('builds production data flow from inspect payload and proof traces', () => {
    const inspection: WorkflowInstanceInspection = {
      instance: {
        id: 1,
        workflowRevisionId: 1,
        status: 'SUCCEEDED',
        inputJson: JSON.stringify({ orderId: 'o-1' }),
        contextJson: null,
        outputJson: JSON.stringify({ ok: true }),
        startedByType: 'USER',
        startedById: 1,
        startType: 'MANUAL',
        stateVersion: 1,
        createdAt: null,
        updatedAt: null,
      },
      nodeInstances: [{
        id: 10,
        workflowInstanceId: 1,
        semanticNodeKey: 'action',
        status: 'SUCCEEDED',
        stateVersion: 1,
        branchTokenId: null,
        inputJson: JSON.stringify({ in: 1 }),
        outputJson: JSON.stringify({ out: 2 }),
        createdAt: null,
        updatedAt: null,
      }],
      attemptsByNodeInstanceId: {},
    };
    const proof: WorkflowProofEntry[] = [
      {
        sequenceNumber: 1,
        traceType: 'NODE_CLAIMED',
        nodeInstanceId: 10,
        corePayloadJson: JSON.stringify({ nodeKey: 'action' }),
        diagnosticPayloadJson: null,
        createdAt: null,
      },
      {
        sequenceNumber: 2,
        traceType: 'EDGE_SELECTED',
        nodeInstanceId: 10,
        corePayloadJson: JSON.stringify({ nodeKey: 'action', edgeKey: 'e1', selectionMode: 'UNCONDITIONAL', selectionReason: 'ok' }),
        diagnosticPayloadJson: null,
        createdAt: null,
      },
      {
        sequenceNumber: 3,
        traceType: 'INSTANCE_SUCCEEDED',
        nodeInstanceId: null,
        corePayloadJson: '{}',
        diagnosticPayloadJson: null,
        createdAt: null,
      },
    ];

    const steps = buildDataFlowFromInspection(inspection, proof);
    expect(steps[0].kind).toBe('WORKFLOW_INPUT');
    expect(steps.find((step) => step.nodeKey === 'action')?.received).toEqual({ in: 1 });
    expect(steps.find((step) => step.edgeKey === 'e1')?.edgeSelectionReason).toBe('ok');
    expect(steps.at(-1)?.kind).toBe('WORKFLOW_OUTPUT');
  });
});
