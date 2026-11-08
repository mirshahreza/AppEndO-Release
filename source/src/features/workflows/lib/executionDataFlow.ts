import type { JsonValue } from '../types';
import type {
  WorkflowExecuteEvidenceEntry,
  WorkflowInstanceInspection,
  WorkflowProofEntry,
} from '../types';

export type DataFlowStepKind = 'WORKFLOW_INPUT' | 'NODE' | 'EDGE' | 'WORKFLOW_OUTPUT';

export type DataFlowStepStatus = 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'PENDING';

export type DataFlowStep = {
  id: string;
  kind: DataFlowStepKind;
  label: string;
  evidenceSequence?: number;
  nodeKey?: string;
  edgeKey?: string;
  nodeKind?: string;
  status?: DataFlowStepStatus;
  received?: JsonValue;
  config?: JsonValue;
  produced?: JsonValue;
  edgeSelectionMode?: string;
  edgeSelectionReason?: string;
};

export type DataFlowState = {
  steps: DataFlowStep[];
  activeStepId: string | null;
};

const parseJsonValue = (raw: string | null | undefined): JsonValue | undefined => {
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return undefined;
  }
};

const asJsonValue = (value: unknown): JsonValue | undefined => {
  if (value === undefined) return undefined;
  return value as JsonValue;
};

const detailString = (detail: Record<string, JsonValue>, key: string): string | undefined => {
  const value = detail[key];
  return typeof value === 'string' ? value : undefined;
};

export function buildDataFlowFromSimulationEvidence(
  evidence: WorkflowExecuteEvidenceEntry[],
  options?: { workflowInput?: JsonValue; outcome?: unknown },
): DataFlowStep[] {
  const steps: DataFlowStep[] = [];
  let stepCounter = 0;

  const pushStep = (step: Omit<DataFlowStep, 'id'>): DataFlowStep => {
    stepCounter += 1;
    const next = { ...step, id: `df-${stepCounter}` };
    steps.push(next);
    return next;
  };

  for (const entry of evidence) {
    const detail = entry.detail ?? {};

    if (entry.type === 'WORKFLOW_INPUT_RECORDED') {
      pushStep({
        kind: 'WORKFLOW_INPUT',
        label: 'Workflow input',
        evidenceSequence: entry.sequence,
        status: 'SUCCEEDED',
        received: asJsonValue(detail.workflowInput) ?? options?.workflowInput,
      });
      continue;
    }

    if (entry.type === 'NODE_DATA_RECORDED' && entry.nodeKey) {
      const status = detail.status === 'FAILED' ? 'FAILED' : 'SUCCEEDED';
      pushStep({
        kind: 'NODE',
        label: entry.nodeKey,
        evidenceSequence: entry.sequence,
        nodeKey: entry.nodeKey,
        nodeKind: detailString(detail as Record<string, JsonValue>, 'kind'),
        status,
        received: asJsonValue(detail.received),
        config: asJsonValue(detail.config),
        produced: asJsonValue(detail.produced),
      });
      continue;
    }

    if (entry.type === 'EDGE_SELECTED') {
      const edgeKey = detailString(detail as Record<string, JsonValue>, 'edgeKey');
      if (!edgeKey) continue;
      pushStep({
        kind: 'EDGE',
        label: edgeKey,
        evidenceSequence: entry.sequence,
        nodeKey: entry.nodeKey ?? undefined,
        edgeKey,
        status: 'SUCCEEDED',
        edgeSelectionMode: detailString(detail as Record<string, JsonValue>, 'selectionMode'),
        edgeSelectionReason: detailString(detail as Record<string, JsonValue>, 'selectionReason'),
      });
      continue;
    }

    if (entry.type === 'INSTANCE_SUCCEEDED') {
      pushStep({
        kind: 'WORKFLOW_OUTPUT',
        label: 'Workflow output',
        evidenceSequence: entry.sequence,
        nodeKey: entry.nodeKey ?? undefined,
        status: 'SUCCEEDED',
        produced: asJsonValue(detail.output),
      });
      continue;
    }

    if (entry.type === 'INSTANCE_FAILED') {
      pushStep({
        kind: 'WORKFLOW_OUTPUT',
        label: 'Workflow failed',
        evidenceSequence: entry.sequence,
        nodeKey: entry.nodeKey ?? undefined,
        status: 'FAILED',
        produced: {
          errorCode: detail.errorCode ?? null,
          safeMessage: detail.safeMessage ?? null,
        },
      });
    }
  }

  if (!steps.some((step) => step.kind === 'WORKFLOW_INPUT') && options?.workflowInput !== undefined) {
    steps.unshift({
      id: 'df-input-fallback',
      kind: 'WORKFLOW_INPUT',
      label: 'Workflow input',
      status: 'SUCCEEDED',
      received: options.workflowInput,
    });
  }

  if (!steps.some((step) => step.kind === 'WORKFLOW_OUTPUT') && options?.outcome && typeof options.outcome === 'object') {
    const outcome = options.outcome as { status?: string; output?: JsonValue; errorCode?: string; safeMessage?: string };
    if (outcome.status === 'SUCCEEDED') {
      pushStep({
        kind: 'WORKFLOW_OUTPUT',
        label: 'Workflow output',
        status: 'SUCCEEDED',
        produced: outcome.output,
      });
    } else if (outcome.status === 'FAILED') {
      pushStep({
        kind: 'WORKFLOW_OUTPUT',
        label: 'Workflow failed',
        status: 'FAILED',
        produced: { errorCode: outcome.errorCode ?? null, safeMessage: outcome.safeMessage ?? null },
      });
    }
  }

  return steps;
}

export function buildDataFlowFromInspection(
  inspection: WorkflowInstanceInspection,
  proof: WorkflowProofEntry[],
): DataFlowStep[] {
  const steps: DataFlowStep[] = [];
  let stepCounter = 0;
  const recordedNodeKeys = new Set<string>();
  const nodeByKey = new Map(inspection.nodeInstances.map((node) => [node.semanticNodeKey, node]));

  const pushStep = (step: Omit<DataFlowStep, 'id'>): void => {
    stepCounter += 1;
    steps.push({ ...step, id: `df-${stepCounter}` });
  };

  const workflowInput = parseJsonValue(inspection.instance.inputJson);
  if (workflowInput !== undefined) {
    pushStep({
      kind: 'WORKFLOW_INPUT',
      label: 'Workflow input',
      status: 'SUCCEEDED',
      received: workflowInput,
    });
  }

  const sortedProof = [...proof].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  for (const entry of sortedProof) {
    let core: Record<string, unknown> = {};
    try {
      core = JSON.parse(entry.corePayloadJson) as Record<string, unknown>;
    } catch {
      core = {};
    }

    const nodeKey = typeof core.nodeKey === 'string' ? core.nodeKey : undefined;
    const edgeKey = typeof core.edgeKey === 'string'
      ? core.edgeKey
      : typeof core.selectedEdgeKey === 'string'
        ? core.selectedEdgeKey
        : undefined;

    if (
      nodeKey
      && !recordedNodeKeys.has(nodeKey)
      && (entry.traceType === 'NODE_CLAIMED' || entry.traceType === 'ACTION_ATTEMPT_STARTED' || entry.traceType === 'NODE_READY')
    ) {
      recordedNodeKeys.add(nodeKey);
      const node = nodeByKey.get(nodeKey);
      const status = node?.status === 'FAILED'
        ? 'FAILED'
        : node?.status === 'RUNNING' || node?.status === 'READY'
          ? 'RUNNING'
          : node?.status === 'SUCCEEDED' || node?.status === 'COMPENSATED'
            ? 'SUCCEEDED'
            : 'PENDING';
      pushStep({
        kind: 'NODE',
        label: nodeKey,
        evidenceSequence: entry.sequenceNumber,
        nodeKey,
        status,
        received: parseJsonValue(node?.inputJson),
        produced: parseJsonValue(node?.outputJson),
      });
    }

    if (entry.traceType === 'EDGE_SELECTED' && edgeKey) {
      pushStep({
        kind: 'EDGE',
        label: edgeKey,
        evidenceSequence: entry.sequenceNumber,
        nodeKey,
        edgeKey,
        status: 'SUCCEEDED',
        edgeSelectionMode: typeof core.selectionMode === 'string' ? core.selectionMode : undefined,
        edgeSelectionReason: typeof core.selectionReason === 'string' ? core.selectionReason : undefined,
      });
    }

    if (entry.traceType === 'INSTANCE_SUCCEEDED') {
      pushStep({
        kind: 'WORKFLOW_OUTPUT',
        label: 'Workflow output',
        evidenceSequence: entry.sequenceNumber,
        nodeKey,
        status: 'SUCCEEDED',
        produced: parseJsonValue(inspection.instance.outputJson),
      });
    }

    if (entry.traceType === 'INSTANCE_FAILED') {
      pushStep({
        kind: 'WORKFLOW_OUTPUT',
        label: 'Workflow failed',
        evidenceSequence: entry.sequenceNumber,
        nodeKey,
        status: 'FAILED',
        produced: {
          machineErrorCode: core.machineErrorCode ?? null,
          causalIdentity: core.causalIdentity ?? null,
        },
      });
    }
  }

  for (const node of inspection.nodeInstances) {
    if (recordedNodeKeys.has(node.semanticNodeKey)) continue;
    if (node.status === 'PENDING' || node.status === 'SKIPPED' || node.status === 'CANCELLED') continue;
    recordedNodeKeys.add(node.semanticNodeKey);
    pushStep({
      kind: 'NODE',
      label: node.semanticNodeKey,
      nodeKey: node.semanticNodeKey,
      status: node.status === 'FAILED' ? 'FAILED' : node.status === 'RUNNING' || node.status === 'READY' ? 'RUNNING' : 'SUCCEEDED',
      received: parseJsonValue(node.inputJson),
      produced: parseJsonValue(node.outputJson),
    });
  }

  if (!steps.some((step) => step.kind === 'WORKFLOW_OUTPUT')) {
    const workflowOutput = parseJsonValue(inspection.instance.outputJson);
    if (workflowOutput !== undefined) {
      pushStep({
        kind: 'WORKFLOW_OUTPUT',
        label: 'Workflow output',
        status: inspection.instance.status === 'FAILED' ? 'FAILED' : 'SUCCEEDED',
        produced: workflowOutput,
      });
    } else if (inspection.instance.status === 'FAILED') {
      pushStep({
        kind: 'WORKFLOW_OUTPUT',
        label: 'Workflow failed',
        status: 'FAILED',
      });
    }
  }

  return steps;
}

export function activeStepIdForEvidenceIndex(steps: DataFlowStep[], evidenceIndex: number): string | null {
  if (evidenceIndex <= 0 || steps.length === 0) return null;
  let active: string | null = null;
  for (const step of steps) {
    if (step.evidenceSequence !== undefined && step.evidenceSequence <= evidenceIndex) {
      active = step.id;
    }
  }
  return active;
}
