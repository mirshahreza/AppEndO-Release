import React, { useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  CheckCircle2,
  Database,
  Filter,
  GitFork,
  GitMerge,
  Hash,
  Layers,
  ListTree,
  Search,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import {
  CANVAS_FLOW_BACKGROUND_COLOR,
  CANVAS_FLOW_BACKGROUND_GAP,
  CANVAS_FLOW_BACKGROUND_SIZE,
  CANVAS_FLOW_FIT_VIEW_PADDING,
  CanvasFlowViewportControls,
} from '../../../shared/ui';
import {
  buildExplainPlanFlowGraph,
  EXPLAIN_PLAN_FLOW_NODE_HEIGHT,
  EXPLAIN_PLAN_FLOW_NODE_WIDTH,
  formatExplainPlanCostPercent,
  type ExplainPlanFlowNodeModel,
  type ExplainPlanListItem,
  type ExplainPlanOperatorKind,
} from '../../../shared/lib/formatDataSourceExplainPlan';

const operatorColor = (kind: ExplainPlanOperatorKind): string => {
  switch (kind) {
    case 'statement':
      return '#059669';
    case 'join':
      return '#d97706';
    case 'scan':
    case 'seek':
      return '#4f46e5';
    case 'compute':
      return '#0891b2';
    case 'filter':
      return '#7c3aed';
    case 'sort':
      return '#475569';
    case 'spool':
      return '#9333ea';
    case 'concat':
      return '#475569';
    default:
      return '#334155';
  }
};

const operatorIcon = (kind: ExplainPlanOperatorKind): LucideIcon => {
  switch (kind) {
    case 'statement':
      return CheckCircle2;
    case 'join':
      return GitMerge;
    case 'scan':
      return Database;
    case 'seek':
      return Search;
    case 'compute':
      return Hash;
    case 'filter':
      return Filter;
    case 'sort':
      return ListTree;
    case 'spool':
      return Layers;
    case 'concat':
      return GitFork;
    default:
      return Waypoints;
  }
};

type PlanNodeData = {
  model: ExplainPlanFlowNodeModel;
};

const ExplainPlanFlowNode: React.FC<NodeProps<Node<PlanNodeData>>> = ({ data }) => {
  const { model } = data;
  const color = operatorColor(model.kind);
  const Icon = operatorIcon(model.kind);
  const costLabel = formatExplainPlanCostPercent(model.costPercent);
  const subtitle = model.detail
    ? (model.detail.length > 22 ? `${model.detail.slice(0, 20)}…` : model.detail)
    : `Cost: ${costLabel}`;

  return (
    <div
      style={{ width: EXPLAIN_PLAN_FLOW_NODE_WIDTH, height: EXPLAIN_PLAN_FLOW_NODE_HEIGHT }}
      className="relative rounded-lg bg-white"
    >
      {model.hasIncoming ? (
        <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      ) : null}
      {model.hasOutgoing ? (
        <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
      ) : null}
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm"
        style={{ borderColor: color, borderWidth: 1.5 }}
      >
        <div
          className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-3 w-3 shrink-0 text-white" aria-hidden />
          <span className="truncate">{model.label}</span>
        </div>
        <div className="flex flex-1 flex-col justify-center px-2">
          <span className="truncate text-xs font-medium text-slate-900">{subtitle}</span>
          {model.detail ? (
            <span className={`text-[9px] font-semibold ${model.costPercent >= 20 ? 'text-amber-600' : 'text-slate-500'}`}>
              Cost: {costLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = { explainPlanNode: ExplainPlanFlowNode };

const ExplainPlanFlowCanvas: React.FC<{ items: ExplainPlanListItem[] }> = ({ items }) => {
  const graph = useMemo(() => buildExplainPlanFlowGraph(items), [items]);
  const initialNodes = useMemo<Node<PlanNodeData>[]>(
    () => graph.nodes.map((model) => ({
      id: model.id,
      type: 'explainPlanNode',
      position: model.position,
      data: { model },
      draggable: true,
      selectable: true,
    })),
    [graph.nodes],
  );
  const initialEdges = useMemo<Edge[]>(
    () => graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#94a3b8' },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    })),
    [graph.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const instanceRef = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialEdges, initialNodes, setEdges, setNodes]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || initialNodes.length === 0) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      void instance.fitView({ padding: CANVAS_FLOW_FIT_VIEW_PADDING, duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialNodes]);

  if (graph.nodes.length === 0) {
    return <p className="p-3 text-[11px] text-slate-500">No operator tree to draw. Switch to List.</p>;
  }

  return (
    <div className="h-full min-h-0 w-full overflow-hidden overscroll-none bg-slate-50 [&_.react-flow__node.selected]:shadow-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          instanceRef.current = instance;
          void instance.fitView({ padding: CANVAS_FLOW_FIT_VIEW_PADDING, duration: 0 });
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: CANVAS_FLOW_FIT_VIEW_PADDING }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={CANVAS_FLOW_BACKGROUND_GAP}
          size={CANVAS_FLOW_BACKGROUND_SIZE}
          color={CANVAS_FLOW_BACKGROUND_COLOR}
        />
        <CanvasFlowViewportControls />
      </ReactFlow>
    </div>
  );
};

export const DataSourceExplainPlanFlow: React.FC<{ items: ExplainPlanListItem[] }> = ({ items }) => (
  <ReactFlowProvider>
    <ExplainPlanFlowCanvas items={items} />
  </ReactFlowProvider>
);
