import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  Handle,
  Position,
  EdgeLabelRenderer,
  BaseEdge,
  getBezierPath,
  reconnectEdge,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnReconnect,
  type OnConnect,
  type OnMoveEnd,
  type ReactFlowInstance,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import { Check, Trash2, X } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { cn } from '../../../lib/utils';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import {
  CANVAS_FLOW_BACKGROUND_COLOR,
  CANVAS_FLOW_BACKGROUND_GAP,
  CANVAS_FLOW_BACKGROUND_SIZE,
  CANVAS_FLOW_FIT_VIEW_PADDING,
  CANVAS_FLOW_MINIMAP_CHROME,
  CANVAS_FLOW_MINIMAP_CLASS,
  CANVAS_FLOW_ZOOM_DURATION_MS,
  CanvasFlowViewportControls,
  UiInput,
} from '../../../shared/ui';
import {
  CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS,
  CANVAS_SEGMENTED_CONTROL_CLASS,
  CANVAS_SEGMENTED_CONTROL_FIELD_CLASS,
  ICON_ACTION_BUTTON_XS_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from '../../../shared/ui/surfaceClasses';
import type { DesignerViewport, DesignerViewState, WorkflowModel, WorkflowNode } from '../types';
import {
  WORKFLOW_GRAPH_NODE_HEIGHT,
  WORKFLOW_GRAPH_NODE_WIDTH,
  computeDefaultWorkflowNodePositions,
  type WorkflowGraphLayoutMode,
} from '../lib/computeWorkflowGraphLayout';
import { NODE_KIND_LABELS } from './nodeTemplates';
import { resolveWorkflowNodeIcon } from './workflowNodeIcons';
import { WORKFLOW_NODE_DRAG_MIME, decodeWorkflowNodeDragPayload, type WorkflowNodeDragPayload } from './workflowDragPayload';
import { WorkflowLayoutControl } from './WorkflowLayoutControl';

const EDGE_HOVER_HIT_WIDTH = 40;
const NODE_WIDTH = WORKFLOW_GRAPH_NODE_WIDTH;
const NODE_HEIGHT = WORKFLOW_GRAPH_NODE_HEIGHT;

/**
 * `@xyflow/react`-based graph canvas — replaces the Slice 11 hand-rolled SVG canvas. Per
 * `docs/architecture/workflow-designer-frontend-wiring.md`, this swap was always anticipated as "a
 * pure UI-layer change... swapping in @xyflow/react behind the same WorkflowDesignerView contract"
 * since no domain/service code depends on which canvas library renders it — the semantic/view
 * separation (dragging writes only `view.nodePositions`, connecting/deleting still only ever fires
 * `onMoveNode`/`onRemoveEdge`, positions never enter the semantic fingerprint) is unchanged.
 */

export type NodeRuntimeStatus = 'PENDING' | 'READY' | 'RUNNING' | 'WAITING' | 'WAITING_HUMAN' | 'RETRYING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'CANCELLED' | 'COMPENSATING' | 'COMPENSATED';

/**
 * Node-kind colors — aligned to the Tier 2 object palette (docs/standards/ui-design-system.md
 * §1) using each hue's Tailwind 600-shade hex, so the workflow canvas reads as the same color
 * language as the rest of the app instead of an independent blue/green/red/gray set.
 */
export const kindColor = (kind: string): string => {
  switch (kind) {
    case 'ACTION':
      return '#4f46e5'; // indigo-600
    case 'DECISION':
    case 'SWITCH':
      return '#d97706'; // amber-600
    case 'END':
      return '#059669'; // emerald-600
    case 'FAIL':
      return '#e11d48'; // rose-600
    case 'WORK_ITEM':
      return '#7c3aed'; // violet-600
    case 'WAIT_EVENT':
    case 'DELAY':
      return '#0891b2'; // cyan-600
    case 'PARALLEL_SPLIT':
    case 'PARALLEL_JOIN':
      return '#475569'; // slate-600
    case 'SUBFLOW':
      return '#9333ea'; // purple-600 (extended hue — distinct from WORK_ITEM's violet)
    default:
      return '#334155'; // slate-700
  }
};

const statusOverlayColor = (status: NodeRuntimeStatus): string | null => {
  switch (status) {
    case 'RUNNING':
      return '#2563eb';
    case 'READY':
      return '#0891b2';
    case 'WAITING':
    case 'WAITING_HUMAN':
    case 'RETRYING':
    case 'COMPENSATING':
      return '#d97706';
    case 'SUCCEEDED':
    case 'COMPENSATED':
      return '#16a34a';
    case 'FAILED':
      return '#dc2626';
    case 'CANCELLED':
    case 'SKIPPED':
      return '#94a3b8';
    default:
      return null;
  }
};

type FlowNodeData = {
  node: WorkflowNode;
  isStart: boolean;
  status?: NodeRuntimeStatus;
  isSelected: boolean;
  onOpenProperties?: (nodeKey: string) => void;
  onRenameNode?: (nodeKey: string, newKey: string) => void;
  onRemoveNode?: (nodeKey: string) => void;
};

const WorkflowFlowNode: React.FC<NodeProps & { data: FlowNodeData }> = ({ data }) => {
  const { node, isStart, status, isSelected, onOpenProperties, onRenameNode, onRemoveNode } = data;
  const overlayColor = status ? statusOverlayColor(status) : null;
  const color = kindColor(node.kind);
  const [hovered, setHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const startRename = () => {
    setRenameValue(node.key);
    setIsRenaming(true);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue('');
  };

  const confirmRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === node.key) {
      cancelRename();
      return;
    }
    onRenameNode?.(node.key, trimmed);
    cancelRename();
  };

  const showToolbar = (onOpenProperties || onRenameNode || onRemoveNode) && (hovered || isRenaming);

  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className="relative rounded-lg bg-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      {node.kind !== 'END' && node.kind !== 'FAIL' ? (
        <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
      ) : null}
      {showToolbar ? (
        <div
          className={cn(
            CANVAS_SEGMENTED_CONTROL_CLASS,
            'nodrag absolute -top-2.5 -right-2.5 z-10',
            isRenaming && 'min-w-[148px]',
          )}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {isRenaming ? (
            <>
              <div className={CANVAS_SEGMENTED_CONTROL_FIELD_CLASS}>
                <UiInput
                  autoFocus
                  size="sm"
                  aiAssist={false}
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onFocus={(event) => event.target.select()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      confirmRename();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelRename();
                    }
                  }}
                  className="min-h-0 min-w-0 flex-1 !border-0 !bg-transparent text-[11px] font-medium leading-none text-slate-700 !shadow-none !outline-none !ring-0 focus:!border-0 focus:!outline-none focus:!ring-0 hover:!bg-transparent data-[hover=true]:!bg-transparent"
                  ariaLabel="Rename node"
                />
              </div>
              <button
                type="button"
                className={CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS}
                aria-label="Confirm rename"
                onMouseDown={(event) => event.preventDefault()}
                onClick={confirmRename}
              >
                <Check className="h-3 w-3 stroke-[2]" />
              </button>
              <button
                type="button"
                className={CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS}
                aria-label="Cancel rename"
                onMouseDown={(event) => event.preventDefault()}
                onClick={cancelRename}
              >
                <X className="h-3 w-3 stroke-[2]" />
              </button>
            </>
          ) : (
            <>
              {onOpenProperties ? (
                <button
                  type="button"
                  title="Open properties"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenProperties(node.key);
                  }}
                  className={CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS}
                >
                  <NavigationIcon iconRef="doodle:SettingIcon" className="h-3 w-3" />
                </button>
              ) : null}
              {onRenameNode ? (
                <button
                  type="button"
                  title="Rename node"
                  onClick={(event) => {
                    event.stopPropagation();
                    startRename();
                  }}
                  className={CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS}
                >
                  <NavigationIcon iconRef="lucide:PencilLine" className="h-3 w-3" />
                </button>
              ) : null}
              {onRemoveNode ? (
                <button
                  type="button"
                  title="Remove node"
                  aria-label="Remove node"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveNode(node.key);
                  }}
                  className={cn(CANVAS_SEGMENTED_CONTROL_BUTTON_CLASS, ICON_ACTION_DELETE_CLASS)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {overlayColor ? (
        <div
          className="absolute -inset-1 rounded-xl"
          style={{ border: `2.5px solid ${overlayColor}`, borderStyle: status === 'RUNNING' ? 'dashed' : 'solid' }}
        />
      ) : null}
      {isSelected ? (
        <div
          className={cn(
            'pointer-events-none absolute rounded-[10px] border-2 border-primary-500 ring-2 ring-primary-500/30',
            overlayColor ? '-inset-2' : '-inset-1',
          )}
        />
      ) : null}
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm"
        style={{ borderColor: color, borderWidth: 1.5 }}
      >
        <div
          className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          <span className="shrink-0 opacity-95">{resolveWorkflowNodeIcon(node, 'h-3 w-3 text-white')}</span>
          <span className="truncate">{NODE_KIND_LABELS[node.kind] ?? node.kind}</span>
        </div>
        <div className="flex flex-1 flex-col justify-center px-2">
          <span className="truncate text-xs font-medium text-slate-900">{node.key.length > 20 ? `${node.key.slice(0, 18)}…` : node.key}</span>
          <div className="flex items-center justify-between">
            {isStart ? <span className="text-[9px] font-semibold text-emerald-600">START</span> : <span />}
            {status && overlayColor ? (
              <span className="text-[9px] font-semibold" style={{ color: overlayColor }}>{status}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export type EdgeRuntimeStatus = 'idle' | 'active' | 'traversed';

const edgeStrokeStyle = (status: EdgeRuntimeStatus | undefined, hovered: boolean): { stroke: string; strokeWidth: number; strokeDasharray?: string; animated?: boolean } => {
  switch (status) {
    case 'traversed':
      return { stroke: '#16a34a', strokeWidth: 2.5 };
    case 'active':
      return { stroke: '#2563eb', strokeWidth: 2.5, strokeDasharray: '8 5', animated: true };
    default:
      return { stroke: hovered ? '#64748b' : '#94a3b8', strokeWidth: 1.5 };
  }
};

type FlowEdgeData = {
  onRemove?: (edgeKey: string) => void;
  edgeKey: string;
  edgeStatus?: EdgeRuntimeStatus;
};

const WorkflowFlowEdge: React.FC<EdgeProps & { data?: FlowEdgeData }> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}) => {
  const [hovered, setHovered] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const edgeStatus = data?.edgeStatus ?? 'idle';
  const strokeStyle = edgeStrokeStyle(edgeStatus, hovered);

  const setEdgeHovered = (next: boolean) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (next) {
      setHovered(true);
      return;
    }
    leaveTimerRef.current = setTimeout(() => setHovered(false), 100);
  };

  useEffect(
    () => () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }
    },
    [],
  );

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={EDGE_HOVER_HIT_WIDTH}
        className="cursor-pointer"
        onMouseEnter={() => setEdgeHovered(true)}
        onMouseLeave={() => setEdgeHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeStyle.stroke,
          strokeWidth: strokeStyle.strokeWidth,
          strokeDasharray: strokeStyle.strokeDasharray,
          animation: strokeStyle.animated ? 'workflow-edge-dash 0.7s linear infinite' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className="pointer-events-none absolute flex items-center"
        >
          {hovered && data?.onRemove ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                data.onRemove?.(data.edgeKey);
              }}
              onMouseEnter={() => setEdgeHovered(true)}
              onMouseLeave={() => setEdgeHovered(false)}
              className={cn(
                ICON_ACTION_BUTTON_XS_CLASS,
                ICON_ACTION_DELETE_CLASS,
                'pointer-events-auto h-4 w-4',
              )}
              title="Remove edge"
              aria-label="Remove edge"
            >
              <X className="h-2 w-2" strokeWidth={2.25} />
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes = { workflowNode: WorkflowFlowNode };
const edgeTypes = { workflowEdge: WorkflowFlowEdge };

export const GraphCanvas: React.FC<{
  model: WorkflowModel;
  view: DesignerViewState;
  /** Viewport restored when a workflow is opened — not updated on every local pan/zoom. */
  initialViewport?: DesignerViewport;
  /** Changes when a different workflow is opened so viewport restore re-runs. */
  viewportSessionKey?: string | number;
  /** Bump after applying an auto-layout so the canvas fits the new positions. */
  fitViewRequestId?: number;
  /** Last applied auto-layout mode (highlights the matching icon button). */
  activeLayoutMode?: WorkflowGraphLayoutMode | null;
  onApplyLayout?: (mode: WorkflowGraphLayoutMode) => void;
  selectedNodeKey: string | null;
  onSelectNode: (nodeKey: string) => void;
  onMoveNode: (nodeKey: string, position: { x: number; y: number }) => void;
  onViewportChange?: (viewport: DesignerViewport) => void;
  onRemoveEdge: (edgeKey: string) => void;
  /** Drag an existing edge endpoint to another node handle. */
  onReconnectEdge?: (edgeKey: string, fromNodeKey: string, toNodeKey: string, anchor: { x: number; y: number }) => void;
  /** Read-only Operations Cockpit mode: disables drag/edge-delete, only selection stays live. */
  readOnly?: boolean;
  /** Operations Cockpit Inspect overlay: colors a ring around each node by its live runtime status and prints the status label. */
  nodeStatusByKey?: Record<string, NodeRuntimeStatus>;
  /** Execution replay / live runtime: highlight traversed and active edges on the canvas. */
  edgeStatusByKey?: Record<string, EdgeRuntimeStatus>;
  /** A palette drag (structure kind or Action) was dropped on the pane at the given flow position. */
  onDropNode?: (payload: WorkflowNodeDragPayload, position: { x: number; y: number }) => void;
  /** A native React Flow drag-to-connect completed between two node handles; `anchor` is a screen-space point (midpoint of the two nodes) suitable for anchoring a selector popover. */
  onConnectNodes?: (fromNodeKey: string, toNodeKey: string, anchor: { x: number; y: number }) => void;
  /** Double-click or hover-icon request to open the floating properties panel for a node. */
  onOpenNodeProperties?: (nodeKey: string) => void;
  /** Hover-toolbar rename request for a node key. */
  onRenameNode?: (nodeKey: string, newKey: string) => void;
  /** Hover-toolbar remove request for a node key. */
  onRemoveNode?: (nodeKey: string) => void;
  /** Authoring actions rendered at top-right with layout and zoom. */
  endOverlay?: React.ReactNode;
}> = ({
  model,
  view,
  initialViewport,
  viewportSessionKey,
  fitViewRequestId = 0,
  activeLayoutMode = null,
  onApplyLayout,
  selectedNodeKey,
  onSelectNode,
  onMoveNode,
  onViewportChange,
  onRemoveEdge,
  onReconnectEdge,
  readOnly = false,
  nodeStatusByKey,
  edgeStatusByKey,
  onDropNode,
  onConnectNodes,
  onOpenNodeProperties,
  onRenameNode,
  onRemoveNode,
  endOverlay,
}) => {
  const dagreLayout = useMemo(() => computeDefaultWorkflowNodePositions(model), [model]);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const appliedViewportKeyRef = useRef<string | null>(null);
  const appliedFitViewRequestRef = useRef(0);
  const ignoreViewportUntilRef = useRef(0);

  const markProgrammaticViewportChange = useCallback(() => {
    ignoreViewportUntilRef.current = performance.now() + 150;
  }, []);

  const viewportRestoreKey = useMemo(
    () => `${viewportSessionKey ?? 'default'}:${initialViewport ? `${initialViewport.x}:${initialViewport.y}:${initialViewport.zoom}` : 'fit'}`,
    [initialViewport, viewportSessionKey],
  );

  useEffect(() => {
    const instance = reactFlowInstanceRef.current;
    if (!instance || appliedViewportKeyRef.current === viewportRestoreKey) return;

    if (initialViewport) {
      markProgrammaticViewportChange();
      void instance.setViewport(initialViewport, { duration: 0 });
    } else {
      markProgrammaticViewportChange();
      void instance.fitView({ padding: CANVAS_FLOW_FIT_VIEW_PADDING, duration: 0 });
    }
    appliedViewportKeyRef.current = viewportRestoreKey;
  }, [initialViewport, markProgrammaticViewportChange, viewportRestoreKey]);

  useEffect(() => {
    if (!fitViewRequestId || appliedFitViewRequestRef.current === fitViewRequestId) {
      return;
    }
    const instance = reactFlowInstanceRef.current;
    if (!instance) {
      return;
    }
    appliedFitViewRequestRef.current = fitViewRequestId;
    markProgrammaticViewportChange();
    void instance.fitView({ padding: CANVAS_FLOW_FIT_VIEW_PADDING, duration: CANVAS_FLOW_ZOOM_DURATION_MS });
  }, [fitViewRequestId, markProgrammaticViewportChange, view.nodePositions]);

  const positionFor = useCallback(
    (nodeKey: string) => view.nodePositions[nodeKey] ?? dagreLayout.get(nodeKey) ?? { x: 0, y: 0 },
    [view.nodePositions, dagreLayout],
  );

  const flowNodes: Node[] = useMemo(
    () =>
      model.nodes.map((node) => ({
        id: node.key,
        type: 'workflowNode',
        position: positionFor(node.key),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        draggable: !readOnly,
        selectable: true,
        data: {
          node,
          isStart: node.key === model.start.targetNodeKey,
          status: nodeStatusByKey?.[node.key],
          isSelected: node.key === selectedNodeKey,
          onOpenProperties: onOpenNodeProperties,
          onRenameNode: readOnly ? undefined : onRenameNode,
          onRemoveNode: readOnly ? undefined : onRemoveNode,
        } satisfies FlowNodeData,
      })),
    [model.nodes, model.start.targetNodeKey, positionFor, readOnly, nodeStatusByKey, selectedNodeKey, onOpenNodeProperties, onRenameNode, onRemoveNode],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      model.edges.map((edge) => {
        const edgeStatus = edgeStatusByKey?.[edge.key] ?? 'idle';
        const markerColor = edgeStatus === 'traversed' ? '#16a34a' : edgeStatus === 'active' ? '#2563eb' : '#94a3b8';
        return {
          id: edge.key,
          source: edge.fromNodeKey,
          target: edge.toNodeKey,
          type: 'workflowEdge',
          markerEnd: { type: 'arrowclosed' as const, color: markerColor, width: 16, height: 16 },
          reconnectable: !readOnly,
          data: { edgeKey: edge.key, onRemove: readOnly ? undefined : onRemoveEdge, edgeStatus } satisfies FlowEdgeData,
        };
      }),
    [model.edges, readOnly, onRemoveEdge, edgeStatusByKey],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => onSelectNode(node.id), [onSelectNode]);

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (!onOpenNodeProperties) return;
      event.stopPropagation();
      onOpenNodeProperties(node.id);
    },
    [onOpenNodeProperties],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (readOnly) return;
      onMoveNode(node.id, { x: node.position.x, y: node.position.y });
    },
    [onMoveNode, readOnly],
  );

  const handleReconnect: OnReconnect = useCallback(
    (oldEdge, connection) => {
      if (readOnly || !onReconnectEdge || !connection.source || !connection.target) return;
      setEdges((currentEdges) => reconnectEdge(oldEdge, connection, currentEdges));
      const fromPos = positionFor(connection.source);
      const toPos = positionFor(connection.target);
      const midpointFlow = { x: (fromPos.x + toPos.x) / 2 + NODE_WIDTH / 2, y: (fromPos.y + toPos.y) / 2 + NODE_HEIGHT / 2 };
      const anchor = reactFlowInstanceRef.current?.flowToScreenPosition(midpointFlow) ?? midpointFlow;
      onReconnectEdge(oldEdge.id, connection.source, connection.target, anchor);
    },
    [onReconnectEdge, positionFor, readOnly, setEdges],
  );

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      if (readOnly || !onConnectNodes || !connection.source || !connection.target) return;
      const fromPos = positionFor(connection.source);
      const toPos = positionFor(connection.target);
      const midpointFlow = { x: (fromPos.x + toPos.x) / 2 + NODE_WIDTH / 2, y: (fromPos.y + toPos.y) / 2 + NODE_HEIGHT / 2 };
      const anchor = reactFlowInstanceRef.current?.flowToScreenPosition(midpointFlow) ?? midpointFlow;
      onConnectNodes(connection.source, connection.target, anchor);
    },
    [onConnectNodes, positionFor, readOnly],
  );

  const handleMoveEnd: OnMoveEnd = useCallback(
    (_event, viewport) => {
      if (readOnly || !onViewportChange) return;
      if (performance.now() < ignoreViewportUntilRef.current) return;
      onViewportChange(viewport);
    },
    [onViewportChange, readOnly],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (readOnly || !onDropNode) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [onDropNode, readOnly],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (readOnly || !onDropNode) return;
      const raw = event.dataTransfer.getData(WORKFLOW_NODE_DRAG_MIME);
      const payload = raw ? decodeWorkflowNodeDragPayload(raw) : null;
      if (!payload) return;
      event.preventDefault();
      const instance = reactFlowInstanceRef.current;
      const position = instance ? instance.screenToFlowPosition({ x: event.clientX, y: event.clientY }) : { x: event.clientX, y: event.clientY };
      onDropNode(payload, position);
    },
    [onDropNode, readOnly],
  );

  return (
    <div
      className="h-full w-full min-h-0 overflow-hidden overscroll-none bg-slate-50 [&_.react-flow__node.selected]:shadow-none"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <style>{`
        @keyframes workflow-edge-dash {
          to { stroke-dashoffset: -26; }
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
          appliedViewportKeyRef.current = null;
          if (initialViewport) {
            markProgrammaticViewportChange();
            void instance.setViewport(initialViewport, { duration: 0 });
            appliedViewportKeyRef.current = viewportRestoreKey;
          } else {
            markProgrammaticViewportChange();
            void instance.fitView({ padding: CANVAS_FLOW_FIT_VIEW_PADDING, duration: 0 });
            appliedViewportKeyRef.current = 'fit';
          }
        }}
        onMoveEnd={handleMoveEnd}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        edgesReconnectable={!readOnly}
        reconnectRadius={24}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        edgesFocusable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={CANVAS_FLOW_BACKGROUND_GAP}
          size={CANVAS_FLOW_BACKGROUND_SIZE}
          color={CANVAS_FLOW_BACKGROUND_COLOR}
        />
        {endOverlay ? (
          <Panel position="top-right" className="!m-2 flex items-start gap-2">
            {endOverlay}
          </Panel>
        ) : null}
        <CanvasFlowViewportControls />
        <Panel position="bottom-right" className="!m-2 flex flex-col items-end gap-2">
          {onApplyLayout ? (
            <WorkflowLayoutControl
              disabled={readOnly || model.nodes.length === 0}
              activeMode={activeLayoutMode}
              onApplyLayout={onApplyLayout}
            />
          ) : null}
          <MiniMap
            {...CANVAS_FLOW_MINIMAP_CHROME}
            nodeColor={(node) => kindColor((node.data as FlowNodeData).node.kind)}
            ariaLabel="Workflow overview"
            className={CANVAS_FLOW_MINIMAP_CLASS}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
};
