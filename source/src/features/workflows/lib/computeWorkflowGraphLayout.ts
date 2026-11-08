import type { NodePosition, WorkflowModel } from '../types';
import {
  CANVAS_GRAPH_LAYOUT_OPTIONS,
  computeCanvasGraphLayout,
  orderGraphNodesForLayout,
  type CanvasGraphLayoutMode,
} from '../../../shared/lib/canvasGraphLayout';

export type WorkflowGraphLayoutMode = CanvasGraphLayoutMode;

export const WORKFLOW_GRAPH_LAYOUT_OPTIONS = CANVAS_GRAPH_LAYOUT_OPTIONS;

export const WORKFLOW_GRAPH_NODE_WIDTH = 160;
export const WORKFLOW_GRAPH_NODE_HEIGHT = 56;

export function orderWorkflowNodesForLayout(model: WorkflowModel): string[] {
  const nodes = model.nodes.map((node) => ({
    id: node.key,
    width: WORKFLOW_GRAPH_NODE_WIDTH,
    height: WORKFLOW_GRAPH_NODE_HEIGHT,
  }));
  const edges = model.edges.map((edge) => ({
    source: edge.fromNodeKey,
    target: edge.toNodeKey,
  }));
  return orderGraphNodesForLayout(nodes, edges, model.start.targetNodeKey);
}

export function computeWorkflowGraphLayout(
  model: WorkflowModel,
  mode: WorkflowGraphLayoutMode,
): Record<string, NodePosition> {
  const nodes = model.nodes.map((node) => ({
    id: node.key,
    width: WORKFLOW_GRAPH_NODE_WIDTH,
    height: WORKFLOW_GRAPH_NODE_HEIGHT,
  }));
  const edges = model.edges.map((edge) => ({
    source: edge.fromNodeKey,
    target: edge.toNodeKey,
  }));
  const positions = computeCanvasGraphLayout(
    mode,
    nodes,
    edges,
    model.start.targetNodeKey,
  );

  const result: Record<string, NodePosition> = {};
  for (const [key, position] of positions) {
    result[key] = position;
  }
  return result;
}

/** Default dagre LR positions for nodes that have no saved designer position yet. */
export function computeDefaultWorkflowNodePositions(
  model: WorkflowModel,
): Map<string, NodePosition> {
  const nodes = model.nodes.map((node) => ({
    id: node.key,
    width: WORKFLOW_GRAPH_NODE_WIDTH,
    height: WORKFLOW_GRAPH_NODE_HEIGHT,
  }));
  const edges = model.edges.map((edge) => ({
    source: edge.fromNodeKey,
    target: edge.toNodeKey,
  }));
  return computeCanvasGraphLayout('horizontal', nodes, edges, model.start.targetNodeKey);
}
