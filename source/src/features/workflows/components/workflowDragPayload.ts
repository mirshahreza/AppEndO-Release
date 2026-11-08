import type { NodeKind } from './nodeTemplates';

/**
 * Shared HTML5 drag-and-drop payload contract between `WorkflowPalette` (drag source) and
 * `GraphCanvas` (drop target). Plain native `dataTransfer` — the React-Flow-documented way to drag
 * from a sidebar onto its pane — rather than `@dnd-kit` (a pointer-event DnD system already scoped
 * to `component-designer`'s own droppable zones; mixing it with a native-drop `<ReactFlow>` pane
 * would be an interop mismatch, not a reuse).
 */
export const WORKFLOW_NODE_DRAG_MIME = 'application/x-appendo-workflow-node';

export type WorkflowNodeDragPayload = { nodeKind: NodeKind; actionKey?: string };

export function encodeWorkflowNodeDragPayload(payload: WorkflowNodeDragPayload): string {
  return JSON.stringify(payload);
}

export function decodeWorkflowNodeDragPayload(raw: string): WorkflowNodeDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowNodeDragPayload>;
    if (typeof parsed.nodeKind !== 'string') return null;
    return { nodeKind: parsed.nodeKind as NodeKind, actionKey: typeof parsed.actionKey === 'string' ? parsed.actionKey : undefined };
  } catch {
    return null;
  }
}
