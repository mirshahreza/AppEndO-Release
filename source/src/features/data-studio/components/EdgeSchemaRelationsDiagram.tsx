import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  NodeResizer,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useInternalNode,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnNodesChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import { ArrowLeft, Expand, Key, Loader2, RotateCcw, Tag, Tags, Trash2 } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { cn } from '../../../lib/utils';
import {
  CANVAS_FLOW_BACKGROUND_COLOR,
  CANVAS_FLOW_BACKGROUND_GAP,
  CANVAS_FLOW_BACKGROUND_SIZE,
  CANVAS_FLOW_FIT_VIEW_PADDING,
  AppButton,
  CanvasFlowViewportControls,
  CanvasGraphLayoutControl,
} from '../../../shared/ui';
import type { CanvasGraphLayoutMode } from '../../../shared/lib/canvasGraphLayout';
import type { SchemaRelationsSnapshot } from '../../../shared/api/contracts/data-sources/schemaRelations';
import { fetchDataSourceObjectRelations } from '../../../shared/api/queries/data-sources';
import {
  applySchemaRelationEntityDrillDown,
  buildEdgeSchemaFlowGraph,
  collectSchemaRelationsDiagramLayout,
  computeSchemaEntityNodeHeight,
  mergeExpandedSchemaRelationGraph,
  relayoutSchemaRelationNodes,
  SCHEMA_ENTITY_NODE_WIDTH,
  withSchemaRelationExpandState,
  type LogicalRelationGraphInput,
  type LogicalRelationPeerTable,
  type SchemaEntityNodeData,
  type SchemaRelationEdgeData,
} from '../../../shared/lib/buildEdgeSchemaFlowGraph';
import {
  mergeSchemaRelationsSnapshots,
  reconcileFocusSchemaRelationsRefresh,
} from '../../../shared/lib/mergeSchemaRelationsSnapshots';
import type { SchemaRelationsDiagramLayout } from '../../../shared/lib/schemaRelationsDiagramLayout';
import {
  readSchemaRelationsDiagramShowEdgeLabels,
  writeSchemaRelationsDiagramShowEdgeLabels,
} from '../../../shared/lib/schemaRelationsDiagramLayout';
import { resolveSchemaRelationEdgeEndpoints } from '../../../shared/lib/schemaRelationEdgeGeometry';
import { schemaRelationLabelClassName } from '../../../shared/lib/schemaRelationEdgeStyles';
import { readSchemaObjectDragPayload } from '../lib/schemaObjectDrag';

type SchemaEntityNodeContextValue = {
  onExpand: (tableName: string) => void;
  onRemoveTable?: (tableName: string) => void;
};

const SchemaEntityNodeContext = createContext<SchemaEntityNodeContextValue | null>(null);

type SchemaRelationEdgeContextValue = {
  onEdgeLabelClick: (edgeId: string) => void;
  showEdgeLabels: boolean;
};

const SchemaRelationEdgeContext = createContext<SchemaRelationEdgeContextValue | null>(null);

const omitHiddenFromSnapshot = (
  snapshot: SchemaRelationsSnapshot,
  hiddenTableNames: ReadonlySet<string>,
): SchemaRelationsSnapshot => {
  if (hiddenTableNames.size === 0) {
    return snapshot;
  }
  return {
    ...snapshot,
    tables: snapshot.tables.filter((table) => !hiddenTableNames.has(table.name)),
    relations: snapshot.relations.filter((relation) => (
      !hiddenTableNames.has(relation.fromTable)
      && !hiddenTableNames.has(relation.toTable)
    )),
  };
};

const SchemaEntityNode = memo(({ data, selected }: NodeProps<Node<SchemaEntityNodeData>>) => {
  const nodeContext = useContext(SchemaEntityNodeContext);

  if (!data) {
    return null;
  }

  return (
    <div className="h-full min-w-[10rem] overflow-hidden rounded-lg border border-violet-200/90 bg-white shadow-[0_8px_24px_rgb(91_33_182/0.08)]">
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        maxWidth={420}
        minHeight={72}
        keepAspectRatio={false}
        lineClassName="!border-violet-400/70"
        handleClassName="!h-2 !w-2 !rounded-sm !border-violet-500 !bg-white"
      />
      {([Position.Left, Position.Right, Position.Top, Position.Bottom] as const).map((side) => (
        <Handle
          key={`target-${side}`}
          id={`target-${side}`}
          type="target"
          position={side}
          className="!h-2 !w-2 !border-violet-300 !bg-violet-100"
        />
      ))}
      <div
        className={cn(
          'flex items-center gap-1 border-b px-2 py-1.5 text-[11px] font-bold tracking-tight',
          data.isFocus
            ? 'border-violet-500/30 bg-violet-600 text-white'
            : 'border-violet-100 bg-violet-50 text-violet-900',
        )}
      >
        <span
          className="min-w-0 flex-1 truncate"
          title="Double-click to show only this table's relations"
        >
          {data.tableName}
        </span>
        {!data.isFocus ? (
          <span className="inline-flex shrink-0 items-center gap-0.5">
            {data.canExpand ? (
              <button
                type="button"
                className={cn(
                  'nodrag nopan inline-flex h-4 w-4 items-center justify-center',
                  'bg-transparent p-0 text-violet-600/80 hover:text-violet-800',
                  'disabled:opacity-60',
                )}
                aria-label={`Expand relations for ${data.tableName}`}
                title="Expand relations"
                disabled={data.isExpanding}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  nodeContext?.onExpand(data.tableName);
                }}
              >
                {data.isExpanding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Expand className="h-3 w-3" strokeWidth={1.75} />
                )}
              </button>
            ) : null}
            {nodeContext?.onRemoveTable ? (
              <button
                type="button"
                className="nodrag nopan inline-flex h-4 w-4 items-center justify-center rounded bg-transparent p-0 text-rose-500/90 hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Remove ${data.tableName} from diagram`}
                title="Remove from diagram"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  nodeContext.onRemoveTable?.(data.tableName);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      <div className="divide-y divide-violet-50/90">
        {data.columns.length === 0 ? (
          <div className="px-2 py-1.5 text-[11px] text-slate-400">No columns</div>
        ) : data.columns.map((column) => (
          <div
            key={column.name}
            className={cn(
              'flex items-center justify-between gap-2 px-2 py-0.5 text-[11px]',
              column.isRelationKey && !column.isPrimaryKey && 'bg-indigo-50/55',
            )}
          >
            <span className="flex min-w-0 items-center gap-1 font-mono text-slate-700">
              {column.isPrimaryKey ? (
                <Key className="h-3 w-3 shrink-0 text-amber-600" aria-hidden />
              ) : null}
              <span className={cn('truncate', column.isPrimaryKey && 'font-semibold text-violet-800')}>
                {column.name}
              </span>
            </span>
            <span className="shrink-0 text-slate-400">{column.dataType}</span>
          </div>
        ))}
      </div>
      {([Position.Left, Position.Right, Position.Top, Position.Bottom] as const).map((side) => (
        <Handle
          key={`source-${side}`}
          id={`source-${side}`}
          type="source"
          position={side}
          className="!h-2 !w-2 !border-violet-300 !bg-violet-100"
        />
      ))}
    </div>
  );
});

SchemaEntityNode.displayName = 'SchemaEntityNode';

const SchemaRelationEdge = memo(({
  id,
  source,
  target,
  sourceX: fallbackSourceX,
  sourceY: fallbackSourceY,
  targetX: fallbackTargetX,
  targetY: fallbackTargetY,
  sourcePosition: fallbackSourcePosition,
  targetPosition: fallbackTargetPosition,
  style,
  markerEnd,
  data,
  selected,
}: EdgeProps<Edge<SchemaRelationEdgeData>>) => {
  const edgeContext = useContext(SchemaRelationEdgeContext);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const parallelIndex = data?.parallelIndex ?? 0;
  const parallelTotal = data?.parallelTotal ?? 1;
  const labelAlongFraction = data?.labelAlongFraction ?? 0.5;
  const resolved = resolveSchemaRelationEdgeEndpoints(
    sourceNode,
    targetNode,
    parallelIndex,
    parallelTotal,
    { useSideLanes: parallelTotal > 1 || Boolean(data?.drillDownRibbon) },
  );
  const sourceX = resolved?.sourceX ?? fallbackSourceX;
  const sourceY = resolved?.sourceY ?? fallbackSourceY;
  const targetX = resolved?.targetX ?? fallbackTargetX;
  const targetY = resolved?.targetY ?? fallbackTargetY;
  const sourcePosition = resolved?.sourcePosition ?? fallbackSourcePosition;
  const targetPosition = resolved?.targetPosition ?? fallbackTargetPosition;
  const ribbon = data?.drillDownRibbon;
  const curvature = parallelTotal > 1
    ? (ribbon
      ? 0.18 + (parallelIndex - (parallelTotal - 1) / 2) * 0.04
      : 0.25 + (parallelIndex - (parallelTotal - 1) / 2) * 0.08)
    : 0.25;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature,
  });
  const parallelLabelOffset = parallelTotal > 1
    ? (parallelIndex - (parallelTotal - 1) / 2) * 20
    : 0;
  const extraNormalOffset = data?.labelNormalOffset ?? 0;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const edgeLength = Math.hypot(dx, dy) || 1;
  const normalX = -dy / edgeLength;
  const normalY = dx / edgeLength;
  const alongShift = (labelAlongFraction - 0.5) * (ribbon ? 1.05 : 0.85);
  const resolvedLabelX = labelX
    + (sourceX - labelX) * alongShift
    + normalX * (parallelLabelOffset + extraNormalOffset);
  const resolvedLabelY = labelY
    + (sourceY - labelY) * alongShift
    + normalY * (parallelLabelOffset + extraNormalOffset);
  const nature = data?.relationNature ?? 'physical';
  const title = data?.title?.trim();
  const kindLabel = data?.kindLabel?.trim();
  const natureLabel = data?.natureLabel?.trim();
  const subtitle = [kindLabel, natureLabel].filter(Boolean).join(' · ');
  const showEdgeLabels = edgeContext?.showEdgeLabels ?? true;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {title && showEdgeLabels ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            style={{
              transform: `translate(-50%, -50%) translate(${resolvedLabelX}px, ${resolvedLabelY}px)`,
              pointerEvents: 'all',
            }}
            className={cn(
              'nodrag nopan absolute flex max-w-[11rem] cursor-pointer flex-col gap-0.5 rounded border px-1.5 py-0.5 text-start shadow-sm',
              schemaRelationLabelClassName(nature),
              selected ? 'ring-2 ring-offset-1 ring-violet-300' : null,
            )}
            onClick={(event) => {
              event.stopPropagation();
              edgeContext?.onEdgeLabelClick(id);
            }}
          >
            <span className="truncate text-[10px] font-bold leading-tight">{title}</span>
            {subtitle ? (
              <span className="truncate text-[9px] font-medium leading-tight opacity-80">
                {subtitle}
              </span>
            ) : null}
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});

SchemaRelationEdge.displayName = 'SchemaRelationEdge';

const nodeTypes = { schemaEntity: SchemaEntityNode };
const edgeTypes = { schemaRelation: SchemaRelationEdge };

export type RelationsConnectRequest = {
  sourceTable: string;
  targetTable: string;
};

export type RelationsEdgeClickPayload = {
  edgeId: string;
  data: SchemaRelationEdgeData;
  sourceTable: string;
  targetTable: string;
};

type EdgeSchemaRelationsDiagramProps = {
  snapshot: SchemaRelationsSnapshot;
  dataSourceId: string;
  savedLayout?: SchemaRelationsDiagramLayout | null;
  onLayoutCommit?: (layout: SchemaRelationsDiagramLayout) => void;
  onSnapshotChange?: (snapshot: SchemaRelationsSnapshot) => void;
  logicalRelations?: ReadonlyArray<LogicalRelationGraphInput>;
  extraTables?: ReadonlyArray<LogicalRelationPeerTable>;
  /** Tables removed from the diagram canvas (not deleted from the database). */
  hiddenTableNames?: ReadonlySet<string>;
  /** When false, connect/drop for logical relations is disabled. */
  allowLogicalEdit?: boolean;
  onConnectTables?: (request: RelationsConnectRequest) => void;
  onEdgeSelect?: (payload: RelationsEdgeClickPayload) => void;
  /** Remove a non-focus table from the diagram. */
  onRemoveTable?: (tableName: string) => void;
  onLogicalEditBlocked?: (reason: string) => void;
};

const SCHEMA_RELATIONS_DRILL_FIT_MS = 480;

const fitDiagramView = (instance: ReactFlowInstance, animated = false) => {
  requestAnimationFrame(() => {
    void instance.fitView({
      padding: animated ? CANVAS_FLOW_FIT_VIEW_PADDING + 0.04 : 0.14,
      maxZoom: animated ? 1.12 : 1.05,
      duration: animated ? SCHEMA_RELATIONS_DRILL_FIT_MS : 0,
    });
  });
};

const EdgeSchemaRelationsDiagramInner: React.FC<EdgeSchemaRelationsDiagramProps> = ({
  snapshot: initialSnapshot,
  dataSourceId,
  savedLayout = null,
  onLayoutCommit,
  onSnapshotChange,
  logicalRelations = [],
  extraTables = [],
  hiddenTableNames,
  allowLogicalEdit = false,
  onConnectTables,
  onEdgeSelect,
  onRemoveTable,
  onLogicalEditBlocked,
}) => {
  const hiddenNames = useMemo(
    () => hiddenTableNames ?? new Set<string>(),
    [hiddenTableNames],
  );
  const [layoutSeed] = useState(savedLayout);
  /** Includes focus snapshot plus any expand-loaded peers (must survive rebuilds). */
  const [workingSnapshot, setWorkingSnapshot] = useState(initialSnapshot);
  const [expandedTableNames, setExpandedTableNames] = useState<Set<string>>(
    () => new Set([initialSnapshot.focusObject]),
  );
  const [expandingTableNames, setExpandingTableNames] = useState<Set<string>>(() => new Set());
  const [droppedTables, setDroppedTables] = useState<LogicalRelationPeerTable[]>([]);
  const liveSnapshotRef = useRef(workingSnapshot);
  const expandedTableNamesRef = useRef(expandedTableNames);
  const expandingTableNamesRef = useRef(expandingTableNames);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasUserLayoutRef = useRef(Boolean(layoutSeed && Object.keys(layoutSeed.nodes).length > 0));
  const [containerHeight, setContainerHeight] = useState(0);
  const [showEdgeLabels, setShowEdgeLabels] = useState(() => (
    readSchemaRelationsDiagramShowEdgeLabels(dataSourceId, initialSnapshot.focusObject)
  ));
  const [activeLayoutMode, setActiveLayoutMode] = useState<CanvasGraphLayoutMode | null>(null);
  const [entityDrillDown, setEntityDrillDown] = useState<{ centerTable: string } | null>(null);
  const entityDrillDownRef = useRef(entityDrillDown);
  const pendingDrillFitRef = useRef<'enter' | 'exit' | null>(null);

  entityDrillDownRef.current = entityDrillDown;
  expandedTableNamesRef.current = expandedTableNames;
  expandingTableNamesRef.current = expandingTableNames;
  liveSnapshotRef.current = workingSnapshot;

  // Keep expanded peer tables, but let a focus refetch win on focus edges (dropped FKs stay gone).
  useEffect(() => {
    setWorkingSnapshot((current) => {
      if (current.focusObject !== initialSnapshot.focusObject) {
        return initialSnapshot;
      }
      return reconcileFocusSchemaRelationsRefresh(initialSnapshot, current);
    });
  }, [initialSnapshot]);

  useEffect(() => {
    onSnapshotChange?.(workingSnapshot);
  }, [onSnapshotChange, workingSnapshot]);

  useEffect(() => {
    setShowEdgeLabels(readSchemaRelationsDiagramShowEdgeLabels(
      dataSourceId,
      workingSnapshot.focusObject,
    ));
    setActiveLayoutMode(null);
    setEntityDrillDown(null);
  }, [dataSourceId, workingSnapshot.focusObject]);

  const mergedExtraTables = useMemo(() => {
    const byName = new Map<string, LogicalRelationPeerTable>();
    for (const table of extraTables) {
      if (hiddenNames.has(table.name)) {
        continue;
      }
      byName.set(table.name, table);
    }
    for (const table of droppedTables) {
      if (hiddenNames.has(table.name) || byName.has(table.name)) {
        continue;
      }
      byName.set(table.name, table);
    }
    return [...byName.values()];
  }, [droppedTables, extraTables, hiddenNames]);

  const visibleLogicalRelations = useMemo(() => {
    if (hiddenNames.size === 0) {
      return logicalRelations;
    }
    return logicalRelations.filter((relation) => (
      !hiddenNames.has(relation.sourceObjectName)
      && !hiddenNames.has(relation.targetObjectName)
    ));
  }, [hiddenNames, logicalRelations]);

  const visibleSnapshot = useMemo(
    () => omitHiddenFromSnapshot(workingSnapshot, hiddenNames),
    [hiddenNames, workingSnapshot],
  );

  const buildGraphFromSnapshot = useCallback((
    layout: SchemaRelationsDiagramLayout | null | undefined,
  ) => buildEdgeSchemaFlowGraph(visibleSnapshot, {
    layout,
    logicalRelations: visibleLogicalRelations,
    extraTables: mergedExtraTables,
  }), [mergedExtraTables, visibleLogicalRelations, visibleSnapshot]);

  const graphOptions = useMemo(() => ({
    layout: layoutSeed,
    logicalRelations: visibleLogicalRelations,
    extraTables: mergedExtraTables,
  }), [layoutSeed, mergedExtraTables, visibleLogicalRelations]);

  const initialGraph = useMemo(
    () => buildEdgeSchemaFlowGraph(visibleSnapshot, graphOptions),
    [graphOptions, visibleSnapshot],
  );

  const [nodes, setNodes, onNodesChangeBase] = useNodesState(
    withSchemaRelationExpandState(initialGraph.nodes, expandedTableNames, expandingTableNames),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);
  const graphRebuildKeyRef = useRef('');

  // Rebuild when physical snapshot or logical graph inputs change; keep user layout.
  useEffect(() => {
    const key = JSON.stringify({
      focus: visibleSnapshot.focusObject,
      physical: visibleSnapshot.relations,
      tables: visibleSnapshot.tables.map((table) => table.name),
      logical: visibleLogicalRelations,
      extra: mergedExtraTables.map((table) => table.name),
      hidden: [...hiddenNames],
      drill: entityDrillDown?.centerTable ?? null,
    });
    if (graphRebuildKeyRef.current === key) {
      return;
    }
    const hadKey = graphRebuildKeyRef.current.length > 0;
    graphRebuildKeyRef.current = key;

    const liveNodes = flowInstanceRef.current?.getNodes() ?? [];
    let nextGraph = buildGraphFromSnapshot(
      hasUserLayoutRef.current && liveNodes.length > 0 && !entityDrillDown
        ? collectSchemaRelationsDiagramLayout(liveNodes)
        : layoutSeed,
    );
    if (entityDrillDown) {
      const drilled = applySchemaRelationEntityDrillDown(nextGraph, entityDrillDown.centerTable);
      if (!drilled) {
        setEntityDrillDown(null);
      } else {
        nextGraph = drilled;
      }
    }
    setNodes(withSchemaRelationExpandState(
      nextGraph.nodes,
      expandedTableNamesRef.current,
      expandingTableNamesRef.current,
    ));
    setEdges(nextGraph.edges);

    const animateFit = pendingDrillFitRef.current !== null;
    if (animateFit) {
      pendingDrillFitRef.current = null;
      requestAnimationFrame(() => {
        const instance = flowInstanceRef.current;
        if (instance) {
          fitDiagramView(instance, true);
        }
      });
    } else if (!hadKey && !hasUserLayoutRef.current && !entityDrillDown) {
      requestAnimationFrame(() => {
        const instance = flowInstanceRef.current;
        if (instance) {
          fitDiagramView(instance);
        }
      });
    }
  }, [
    buildGraphFromSnapshot,
    entityDrillDown,
    hiddenNames,
    layoutSeed,
    mergedExtraTables,
    setEdges,
    setNodes,
    visibleLogicalRelations,
    visibleSnapshot,
  ]);

  useEffect(() => {
    setNodes((current) => withSchemaRelationExpandState(
      current,
      expandedTableNames,
      expandingTableNames,
    ));
  }, [expandedTableNames, expandingTableNames, setNodes]);

  const commitLayout = useCallback((nextNodes: typeof nodes) => {
    if (!onLayoutCommit) {
      return;
    }
    hasUserLayoutRef.current = true;
    onLayoutCommit(collectSchemaRelationsDiagramLayout(nextNodes));
  }, [onLayoutCommit]);

  const onNodesChange = useCallback<OnNodesChange<Node<SchemaEntityNodeData>>>((changes) => {
    onNodesChangeBase(changes);
    const structural = changes.some((change) => (
      (change.type === 'position' && change.dragging === false)
      || (change.type === 'dimensions' && change.resizing === false)
    ));
    if (!structural || !onLayoutCommit || entityDrillDownRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      const instance = flowInstanceRef.current;
      if (!instance) {
        return;
      }
      commitLayout(instance.getNodes());
    });
  }, [commitLayout, onLayoutCommit, onNodesChangeBase]);

  const handleExpand = useCallback(async (tableName: string) => {
    const currentSnapshot = liveSnapshotRef.current;
    const currentExpanded = expandedTableNamesRef.current;
    const currentExpanding = expandingTableNamesRef.current;
    if (
      tableName === currentSnapshot.focusObject
      || currentExpanded.has(tableName)
      || currentExpanding.has(tableName)
    ) {
      return;
    }

    setExpandingTableNames((current) => new Set(current).add(tableName));
    try {
      // Peer nodes on the diagram are tables; always load TABLE relations for expand.
      const result = await fetchDataSourceObjectRelations(dataSourceId, 'TABLE', tableName);
      if (!result.data) {
        onLogicalEditBlocked?.(
          result.error ?? `Could not expand relations for ${tableName}.`,
        );
        return;
      }

      const mergedSnapshot = mergeSchemaRelationsSnapshots(currentSnapshot, result.data);
      const nextExpanded = new Set(currentExpanded).add(tableName);
      const visibleMerged = omitHiddenFromSnapshot(mergedSnapshot, hiddenNames);
      const nextGraph = buildEdgeSchemaFlowGraph(visibleMerged, {
        logicalRelations: visibleLogicalRelations,
        extraTables: mergedExtraTables,
      });
      const existingNodes = flowInstanceRef.current?.getNodes() ?? nodes;
      const mergedGraph = mergeExpandedSchemaRelationGraph({
        existingNodes,
        nextGraph,
        anchorTableName: tableName,
        expandedTableNames: nextExpanded,
        expandingTableNames: new Set(),
      });

      // Prevent the rebuild effect from immediately replacing the expand layout.
      graphRebuildKeyRef.current = JSON.stringify({
        focus: visibleMerged.focusObject,
        physical: visibleMerged.relations,
        tables: visibleMerged.tables.map((table) => table.name),
        logical: visibleLogicalRelations,
        extra: mergedExtraTables.map((table) => table.name),
        hidden: [...hiddenNames],
      });

      liveSnapshotRef.current = mergedSnapshot;
      expandedTableNamesRef.current = nextExpanded;
      setWorkingSnapshot(mergedSnapshot);
      setExpandedTableNames(nextExpanded);
      setNodes(mergedGraph.nodes);
      setEdges(mergedGraph.edges);
      hasUserLayoutRef.current = true;

      if (onLayoutCommit) {
        onLayoutCommit(collectSchemaRelationsDiagramLayout(mergedGraph.nodes));
      }

      requestAnimationFrame(() => {
        const instance = flowInstanceRef.current;
        if (instance) {
          fitDiagramView(instance);
        }
      });
    } catch (error) {
      onLogicalEditBlocked?.(
        error instanceof Error ? error.message : `Could not expand relations for ${tableName}.`,
      );
    } finally {
      setExpandingTableNames((current) => {
        const next = new Set(current);
        next.delete(tableName);
        return next;
      });
    }
  }, [
    dataSourceId,
    hiddenNames,
    mergedExtraTables,
    nodes,
    onLayoutCommit,
    onLogicalEditBlocked,
    setEdges,
    setNodes,
    visibleLogicalRelations,
  ]);

  const handleRemoveTable = useCallback((tableName: string) => {
    const focus = liveSnapshotRef.current.focusObject;
    if (!tableName || tableName === focus) {
      return;
    }
    setDroppedTables((current) => current.filter((table) => table.name !== tableName));
    onRemoveTable?.(tableName);
  }, [onRemoveTable]);

  const nodeContextValue = useMemo(() => ({
    onExpand: (tableName: string) => {
      void handleExpand(tableName);
    },
    onRemoveTable: onRemoveTable ? handleRemoveTable : undefined,
  }), [handleExpand, handleRemoveTable, onRemoveTable]);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    flowInstanceRef.current = instance;
    fitDiagramView(instance);
  }, []);

  const exitEntityDrillDown = useCallback(() => {
    if (!entityDrillDown) {
      return;
    }
    pendingDrillFitRef.current = 'exit';
    setEntityDrillDown(null);
    setActiveLayoutMode(null);
  }, [entityDrillDown]);

  const resetDiagramLayout = useCallback(() => {
    if (entityDrillDownRef.current) {
      return;
    }
    const nextGraph = buildGraphFromSnapshot(null);
    hasUserLayoutRef.current = false;
    setActiveLayoutMode(null);
    graphRebuildKeyRef.current = JSON.stringify({
      focus: visibleSnapshot.focusObject,
      physical: visibleSnapshot.relations,
      tables: visibleSnapshot.tables.map((table) => table.name),
      logical: visibleLogicalRelations,
      extra: mergedExtraTables.map((table) => table.name),
      hidden: [...hiddenNames],
      drill: null,
      layoutReset: true,
    });
    setNodes(withSchemaRelationExpandState(
      nextGraph.nodes,
      expandedTableNamesRef.current,
      expandingTableNamesRef.current,
    ));
    setEdges(nextGraph.edges);
    if (onLayoutCommit) {
      onLayoutCommit(collectSchemaRelationsDiagramLayout(nextGraph.nodes));
      hasUserLayoutRef.current = true;
    }
    requestAnimationFrame(() => {
      const instance = flowInstanceRef.current;
      if (instance) {
        fitDiagramView(instance, true);
      }
    });
  }, [
    buildGraphFromSnapshot,
    hiddenNames,
    mergedExtraTables,
    onLayoutCommit,
    setEdges,
    setNodes,
    visibleLogicalRelations,
    visibleSnapshot,
  ]);

  const enterEntityDrillDown = useCallback((centerTable: string) => {
    const liveNodes = flowInstanceRef.current?.getNodes() ?? nodes;
    const layout = hasUserLayoutRef.current && liveNodes.length > 0 && !entityDrillDown
      ? collectSchemaRelationsDiagramLayout(liveNodes as Node<SchemaEntityNodeData>[])
      : layoutSeed;
    const fullGraph = buildGraphFromSnapshot(
      hasUserLayoutRef.current && liveNodes.length > 0 && !entityDrillDown
        ? layout
        : null,
    );
    const drilled = applySchemaRelationEntityDrillDown(fullGraph, centerTable);
    if (!drilled) {
      onLogicalEditBlocked?.('This table has no relations on the diagram.');
      return;
    }
    pendingDrillFitRef.current = 'enter';
    setEntityDrillDown({ centerTable });
    setActiveLayoutMode(null);
    setNodes(withSchemaRelationExpandState(
      drilled.nodes,
      expandedTableNamesRef.current,
      expandingTableNamesRef.current,
    ));
    setEdges(drilled.edges);
    requestAnimationFrame(() => {
      const instance = flowInstanceRef.current;
      if (instance) {
        fitDiagramView(instance, true);
      }
    });
  }, [
    buildGraphFromSnapshot,
    entityDrillDown,
    layoutSeed,
    nodes,
    onLogicalEditBlocked,
    setEdges,
    setNodes,
  ]);

  const handleNodeDoubleClick = useCallback((
    _event: React.MouseEvent,
    node: Node<SchemaEntityNodeData>,
  ) => {
    const tableName = node.id?.trim();
    if (!tableName) {
      return;
    }
    if (entityDrillDown?.centerTable === tableName) {
      return;
    }
    enterEntityDrillDown(tableName);
  }, [enterEntityDrillDown, entityDrillDown]);

  useEffect(() => {
    if (!entityDrillDown) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        exitEntityDrillDown();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [entityDrillDown, exitEntityDrillDown]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!allowLogicalEdit) {
      onLogicalEditBlocked?.(
        'Open or create an Edge model for this table to add logical relations.',
      );
      return;
    }
    const sourceTable = connection.source?.trim();
    const targetTable = connection.target?.trim();
    if (!sourceTable || !targetTable || sourceTable === targetTable) {
      return;
    }
    const focus = liveSnapshotRef.current.focusObject;
    if (sourceTable !== focus && targetTable !== focus) {
      onLogicalEditBlocked?.(
        'Connect a line that includes the focus table to create a logical relation.',
      );
      return;
    }
    onConnectTables?.({ sourceTable, targetTable });
  }, [allowLogicalEdit, onConnectTables, onLogicalEditBlocked]);

  const selectRelationEdge = useCallback((edge: Edge<SchemaRelationEdgeData>) => {
    if (!edge.data) {
      return;
    }
    setNodes((current) => current.map((node) => (
      node.selected ? { ...node, selected: false } : node
    )));
    setEdges((current) => current.map((item) => ({
      ...item,
      selected: item.id === edge.id,
    })));
    onEdgeSelect?.({
      edgeId: edge.id,
      data: edge.data,
      sourceTable: edge.source,
      targetTable: edge.target,
    });
  }, [onEdgeSelect, setEdges, setNodes]);

  const handleEdgeClick = useCallback((
    _event: React.MouseEvent,
    edge: Edge<SchemaRelationEdgeData>,
  ) => {
    selectRelationEdge(edge);
  }, [selectRelationEdge]);

  const handleEdgeLabelClick = useCallback((edgeId: string) => {
    const edge = edges.find((item) => item.id === edgeId) as Edge<SchemaRelationEdgeData> | undefined;
    if (!edge) {
      return;
    }
    selectRelationEdge(edge);
  }, [edges, selectRelationEdge]);

  const handleApplyLayout = useCallback((mode: CanvasGraphLayoutMode) => {
    const instance = flowInstanceRef.current;
    if (!instance) {
      return;
    }
    const focus = entityDrillDown?.centerTable ?? liveSnapshotRef.current.focusObject;
    const currentNodes = instance.getNodes() as Node<SchemaEntityNodeData>[];
    const currentEdges = instance.getEdges();
    if (currentNodes.length === 0) {
      return;
    }
    const nextNodes = relayoutSchemaRelationNodes(currentNodes, currentEdges, focus, mode);
    setNodes(withSchemaRelationExpandState(
      nextNodes,
      expandedTableNamesRef.current,
      expandingTableNamesRef.current,
    ));
    hasUserLayoutRef.current = true;
    setActiveLayoutMode(mode);
    if (onLayoutCommit) {
      onLayoutCommit(collectSchemaRelationsDiagramLayout(nextNodes));
    }
    requestAnimationFrame(() => {
      fitDiagramView(instance, Boolean(entityDrillDown));
    });
  }, [entityDrillDown, onLayoutCommit, setNodes]);

  const handleToggleEdgeLabels = useCallback(() => {
    setShowEdgeLabels((current) => {
      const next = !current;
      writeSchemaRelationsDiagramShowEdgeLabels(
        dataSourceId,
        liveSnapshotRef.current.focusObject,
        next,
      );
      return next;
    });
  }, [dataSourceId]);

  const edgeContextValue = useMemo(() => ({
    onEdgeLabelClick: handleEdgeLabelClick,
    showEdgeLabels,
  }), [handleEdgeLabelClick, showEdgeLabels]);

  const handleBeforeDelete = useCallback(async ({
    nodes: nodesToDelete,
    edges: edgesToDelete,
  }: {
    nodes: Node[];
    edges: Edge[];
  }) => {
    // Relations are deleted from edit dialogs only — never from the edge itself.
    if (edgesToDelete.length > 0) {
      return false;
    }
    if (!onRemoveTable || nodesToDelete.length === 0) {
      return false;
    }
    const focus = liveSnapshotRef.current.focusObject;
    const removable = nodesToDelete.filter((node) => node.id !== focus);
    if (removable.length === 0) {
      return false;
    }
    for (const node of removable) {
      onRemoveTable(node.id);
    }
    // Parent updates hiddenTableNames; graph rebuild removes nodes.
    return false;
  }, [onRemoveTable]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const payload = readSchemaObjectDragPayload(event.dataTransfer);
    if (!payload) {
      return;
    }
    if (payload.dataSourceId !== dataSourceId) {
      onLogicalEditBlocked?.('Drop tables from the same data source only.');
      return;
    }
    if (payload.objectKind !== 'TABLE' && payload.objectKind !== 'VIEW') {
      return;
    }
    const objectName = payload.objectName.trim();
    if (!objectName) {
      return;
    }

    const instance = flowInstanceRef.current;
    const existing = instance?.getNode(objectName)
      ?? nodes.find((node) => node.id === objectName);
    if (existing) {
      return;
    }

    const position = instance
      ? instance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      : { x: 120, y: 120 };

    const peerMeta = extraTables.find((table) => table.name === objectName);
    const columns = peerMeta?.columns ?? [];
    const height = computeSchemaEntityNodeHeight(Math.max(columns.length, 1));

    const nextNode: Node<SchemaEntityNodeData> = {
      id: objectName,
      type: 'schemaEntity',
      position,
      width: SCHEMA_ENTITY_NODE_WIDTH,
      height,
      data: {
        tableName: objectName,
        isFocus: objectName === liveSnapshotRef.current.focusObject,
        columns: columns.slice(0, 8).map((column) => ({
          name: column.name,
          dataType: column.dataType,
          isPrimaryKey: column.isPrimaryKey,
          isRelationKey: false,
        })),
        canExpand: objectName !== liveSnapshotRef.current.focusObject,
        isExpanding: false,
        isExpanded: false,
      },
    };

    setDroppedTables((current) => (
      current.some((table) => table.name === objectName)
        ? current
        : [...current, { name: objectName, columns }]
    ));
    setNodes((current) => [...current, nextNode]);
    hasUserLayoutRef.current = true;
    if (onLayoutCommit) {
      requestAnimationFrame(() => {
        const flow = flowInstanceRef.current;
        if (flow) {
          commitLayout(flow.getNodes());
        }
      });
    }
  }, [
    commitLayout,
    dataSourceId,
    extraTables,
    nodes,
    onLayoutCommit,
    onLogicalEditBlocked,
    setNodes,
  ]);

  useEffect(() => {
    const instance = flowInstanceRef.current;
    if (!instance || containerHeight <= 0 || hasUserLayoutRef.current) {
      return;
    }
    fitDiagramView(instance);
  }, [containerHeight, initialGraph]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const syncHeight = () => {
      const nextHeight = Math.round(container.clientHeight);
      if (nextHeight > 0) {
        setContainerHeight((current) => (current === nextHeight ? current : nextHeight));
      }
    };

    syncHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncHeight();
      const instance = flowInstanceRef.current;
      if (instance && container.clientHeight > 0 && !hasUserLayoutRef.current) {
        fitDiagramView(instance);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <SchemaEntityNodeContext.Provider value={nodeContextValue}>
      <SchemaRelationEdgeContext.Provider value={edgeContextValue}>
        <div
          ref={containerRef}
          className={cn(
            'h-full min-h-0 w-full overflow-hidden overscroll-none',
            entityDrillDown && [
              '[&_.react-flow__node]:transition-transform',
              '[&_.react-flow__node]:duration-500',
              '[&_.react-flow__node]:ease-[cubic-bezier(0.33,1,0.68,1)]',
              '[&_.react-flow__edge-path]:transition-[stroke-opacity,d]',
              '[&_.react-flow__edge-path]:duration-500',
            ],
          )}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onEdgeClick={handleEdgeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onBeforeDelete={handleBeforeDelete}
            onInit={handleInit}
            nodesDraggable
            nodesConnectable={allowLogicalEdit}
            elementsSelectable
            edgesFocusable
            deleteKeyCode={['Backspace', 'Delete']}
            minZoom={0.05}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            className="h-full w-full bg-transparent"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={CANVAS_FLOW_BACKGROUND_GAP}
              size={CANVAS_FLOW_BACKGROUND_SIZE}
              color={CANVAS_FLOW_BACKGROUND_COLOR}
            />
            <CanvasFlowViewportControls />
            {entityDrillDown ? (
              <Panel position="top-center" className="!mt-12 !pointer-events-auto">
                <div
                  className={cn(
                    'flex max-w-[min(100vw-2rem,28rem)] items-center gap-2 rounded-lg',
                    'border border-violet-200/90 bg-white/95 px-2 py-1.5 shadow-md shadow-violet-900/10',
                    'backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300',
                  )}
                >
                  <AppButton
                    type="button"
                    intent="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={exitEntityDrillDown}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                    Full diagram
                  </AppButton>
                  <span className="min-w-0 truncate text-[11px] text-slate-600">
                    <span className="font-medium text-slate-500">Focused ·</span>
                    <span className="font-mono font-semibold text-violet-900">
                      {entityDrillDown.centerTable}
                    </span>
                  </span>
                </div>
              </Panel>
            ) : null}
            <Panel position="bottom-right" className="!m-2 flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5">
                <AppButton
                  type="button"
                  intent={showEdgeLabels ? 'secondary' : 'utility'}
                  size="icon-sm"
                  className="!h-7 !min-h-7 !px-1.5 shadow-sm"
                  aria-label={showEdgeLabels ? 'Hide relation labels on edges' : 'Show relation labels on edges'}
                  aria-pressed={showEdgeLabels}
                  title={showEdgeLabels ? 'Hide edge labels' : 'Show edge labels'}
                  onClick={handleToggleEdgeLabels}
                >
                  {showEdgeLabels ? (
                    <Tags className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Tag className="h-3.5 w-3.5 opacity-60" aria-hidden />
                  )}
                </AppButton>
                {!entityDrillDown ? (
                  <AppButton
                    type="button"
                    intent="utility"
                    size="icon-sm"
                    className="!h-7 !min-h-7 !px-1.5 shadow-sm"
                    title="Reset diagram to the default auto layout"
                    aria-label="Reset diagram layout"
                    onClick={resetDiagramLayout}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  </AppButton>
                ) : null}
                <CanvasGraphLayoutControl
                  disabled={nodes.length === 0}
                  activeMode={activeLayoutMode}
                  onApplyLayout={handleApplyLayout}
                />
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </SchemaRelationEdgeContext.Provider>
    </SchemaEntityNodeContext.Provider>
  );
};

export const EdgeSchemaRelationsDiagram: React.FC<EdgeSchemaRelationsDiagramProps> = (props) => (
  <ReactFlowProvider>
    <EdgeSchemaRelationsDiagramInner {...props} />
  </ReactFlowProvider>
);
