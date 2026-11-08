import type { WorkflowModel } from '../types';

type DraftOperation = { type: string; [key: string]: unknown };

const cloneModel = (model: WorkflowModel): WorkflowModel => JSON.parse(JSON.stringify(model)) as WorkflowModel;

/**
 * Best-effort client-side preview applier for queued draft operations. Server authority remains
 * on Save; this only keeps the canvas in sync before persistence.
 */
export const applyWorkflowDraftOperationsLocal = (
  currentModel: WorkflowModel,
  operations: readonly unknown[],
): WorkflowModel => {
  const candidate = cloneModel(currentModel);

  for (const raw of operations) {
    const op = raw as DraftOperation;
    switch (op.type) {
      case 'ADD_NODE': {
        const node = op.node as WorkflowModel['nodes'][number];
        candidate.nodes.push(node);
        break;
      }
      case 'MODIFY_NODE': {
        const nodeKey = String(op.nodeKey);
        const replacement = op.replacement as WorkflowModel['nodes'][number];
        candidate.nodes = candidate.nodes.map((node) => (node.key === nodeKey ? replacement : node));
        break;
      }
      case 'REMOVE_NODE': {
        const nodeKey = String(op.nodeKey);
        candidate.nodes = candidate.nodes.filter((node) => node.key !== nodeKey);
        candidate.edges = candidate.edges.filter((edge) => edge.fromNodeKey !== nodeKey && edge.toNodeKey !== nodeKey);
        break;
      }
      case 'ADD_EDGE': {
        const edge = op.edge as WorkflowModel['edges'][number];
        candidate.edges.push(edge);
        break;
      }
      case 'MODIFY_EDGE': {
        const edgeKey = String(op.edgeKey);
        const replacement = op.replacement as WorkflowModel['edges'][number];
        candidate.edges = candidate.edges.map((edge) => (edge.key === edgeKey ? replacement : edge));
        break;
      }
      case 'REMOVE_EDGE': {
        const edgeKey = String(op.edgeKey);
        candidate.edges = candidate.edges.filter((edge) => edge.key !== edgeKey);
        break;
      }
      case 'CHANGE_START': {
        candidate.start = op.start as WorkflowModel['start'];
        break;
      }
      case 'CHANGE_WORKFLOW_SCHEMA': {
        candidate.inputSchema = op.inputSchema as WorkflowModel['inputSchema'];
        candidate.outputSchema = op.outputSchema as WorkflowModel['outputSchema'];
        candidate.variables = op.variables as WorkflowModel['variables'];
        break;
      }
      case 'CHANGE_WORKFLOW_POLICY': {
        candidate.policies = op.policies as WorkflowModel['policies'];
        break;
      }
      default:
        break;
    }
  }

  return candidate;
};
