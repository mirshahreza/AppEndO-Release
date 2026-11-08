import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import {
  computeCanvasGraphLayout,
  type CanvasGraphLayoutMode,
} from './canvasGraphLayout';
import type { EdgeModelAssociation } from '../api/contracts/data-api';
import type {
  SchemaRelationEdge,
  SchemaRelationsSnapshot,
  SchemaRelationTable,
} from '../api/contracts/data-sources/schemaRelations';
import {
  SCHEMA_RELATIONS_DIAGRAM_LAYOUT_ALGORITHM_VERSION,
  type SchemaRelationsDiagramLayout,
} from './schemaRelationsDiagramLayout';
import {
  schemaRelationEdgeMarker,
  schemaRelationEdgeStyle,
  type SchemaRelationEdgeData,
  type SchemaRelationNature,
} from './schemaRelationEdgeStyles';

export type SchemaEntityColumn = {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isRelationKey: boolean;
};

export type SchemaEntityNodeData = {
  tableName: string;
  isFocus: boolean;
  columns: SchemaEntityColumn[];
  canExpand?: boolean;
  isExpanding?: boolean;
  isExpanded?: boolean;
};

/** Logical association projected onto table/column edges for the relations diagram. */
export type LogicalRelationGraphInput = {
  associationId: string;
  kind: EdgeModelAssociation['kind'];
  as: string;
  foreignKey: string;
  sourceObjectName: string;
  targetObjectName: string;
  /** Junction object name for belongsToMany (diagram label / unique link key). */
  throughObjectName?: string;
  otherKey?: string;
};

export type LogicalRelationPeerTable = {
  name: string;
  columns: SchemaRelationTable['columns'];
};

export type { SchemaRelationEdgeData, SchemaRelationNature };

const NODE_WIDTH = 228;
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 18;
const NODE_PADDING = 6;
const HUB_COL_GAP = 56;
const HUB_ROW_GAP = 52;
const HUB_STAGGER_X = 36;

/** Wider gaps when the graph is small so edge labels stay readable. */
const resolveHubFocusGap = (neighborCount: number): number => {
  if (neighborCount <= 3) {
    return 300;
  }
  if (neighborCount <= 6) {
    return 240;
  }
  if (neighborCount <= 10) {
    return 190;
  }
  return 150;
};

const resolveHubRowGap = (neighborCount: number): number => {
  if (neighborCount <= 3) {
    return 72;
  }
  if (neighborCount <= 6) {
    return 60;
  }
  return HUB_ROW_GAP;
};

type DiagramLinkEdge = {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  nature: SchemaRelationNature;
  associationId?: string;
  associationKind?: EdgeModelAssociation['kind'];
  associationAs?: string;
  throughObjectName?: string;
  physicalConstraintName?: string;
  onDelete?: string;
  onUpdate?: string;
};

const physicalLinkKey = (relation: SchemaRelationEdge): string => (
  `${relation.fromTable}|${relation.fromColumn}|${relation.toTable}`
);

const logicalEndpoint = (relation: LogicalRelationGraphInput): {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  linkKey: string;
} => {
  if (relation.kind === 'belongsToMany') {
    // Unique key so M2M never twin-merges with a single physical FK edge.
    return {
      fromTable: relation.sourceObjectName,
      fromColumn: relation.foreignKey,
      toTable: relation.targetObjectName,
      linkKey: [
        'm2m',
        relation.associationId,
        relation.sourceObjectName,
        relation.throughObjectName ?? '',
        relation.targetObjectName,
        relation.foreignKey,
        relation.otherKey ?? '',
      ].join('|'),
    };
  }
  if (relation.kind === 'belongsTo') {
    return {
      fromTable: relation.sourceObjectName,
      fromColumn: relation.foreignKey,
      toTable: relation.targetObjectName,
      linkKey: `${relation.sourceObjectName}|${relation.foreignKey}|${relation.targetObjectName}`,
    };
  }
  return {
    fromTable: relation.targetObjectName,
    fromColumn: relation.foreignKey,
    toTable: relation.sourceObjectName,
    linkKey: `${relation.targetObjectName}|${relation.foreignKey}|${relation.sourceObjectName}`,
  };
};

const associationKindDisplay = (kind: EdgeModelAssociation['kind'] | undefined): string => {
  switch (kind) {
    case 'hasOne':
      return 'Has one';
    case 'hasMany':
      return 'Has many';
    case 'belongsToMany':
      return 'Belongs to many';
    case 'belongsTo':
    default:
      return 'Belongs to';
  }
};

const buildDiagramLinkLabelParts = (link: DiagramLinkEdge): {
  title: string;
  kindLabel: string;
  natureLabel: string;
  label: string;
} => {
  // Physical FK wins the badge — keep association metadata without dual "Physical + Logical" copy.
  const natureLabel = link.nature === 'logical' ? 'Logical' : 'Physical';

  if (link.nature === 'logical' || link.nature === 'both') {
    const title = link.associationAs?.trim()
      || link.physicalConstraintName?.trim()
      || associationKindDisplay(link.associationKind);
    const kindBase = associationKindDisplay(link.associationKind);
    const kindLabel = link.associationKind === 'belongsToMany' && link.throughObjectName
      ? `${kindBase} · via ${link.throughObjectName}`
      : kindBase;
    return {
      title,
      kindLabel,
      natureLabel,
      label: `${title} · ${kindLabel} · ${natureLabel}`,
    };
  }

  // Physical-only: no column-pair copy on the edge (fields live in the dialog / datasheet).
  const title = link.physicalConstraintName?.trim() || 'Relation';
  const kindLabel = 'Belongs to';
  return {
    title,
    kindLabel,
    natureLabel,
    label: `${title} · ${kindLabel} · ${natureLabel}`,
  };
};

const throughKeysCoveredByBelongsToMany = (
  logical: ReadonlyArray<LogicalRelationGraphInput>,
): Set<string> => {
  const covered = new Set<string>();
  for (const relation of logical) {
    if (relation.kind !== 'belongsToMany' || !relation.throughObjectName?.trim()) {
      continue;
    }
    const through = relation.throughObjectName.trim();
    if (relation.foreignKey.trim()) {
      covered.add(`${through}|${relation.foreignKey.trim()}`);
    }
    if (relation.otherKey?.trim()) {
      covered.add(`${through}|${relation.otherKey.trim()}`);
    }
  }
  return covered;
};

const mergePhysicalAndLogicalLinks = (
  physical: ReadonlyArray<SchemaRelationEdge>,
  logical: ReadonlyArray<LogicalRelationGraphInput>,
): DiagramLinkEdge[] => {
  const byKey = new Map<string, DiagramLinkEdge>();
  const coveredThroughKeys = throughKeysCoveredByBelongsToMany(logical);

  for (const relation of physical) {
    if (coveredThroughKeys.has(`${relation.fromTable}|${relation.fromColumn}`)) {
      continue;
    }
    const key = physicalLinkKey(relation);
    byKey.set(key, {
      id: `physical:${key}`,
      fromTable: relation.fromTable,
      fromColumn: relation.fromColumn,
      toTable: relation.toTable,
      toColumn: relation.toColumn,
      nature: 'physical',
      physicalConstraintName: relation.constraintName,
      onDelete: relation.onDelete,
      onUpdate: relation.onUpdate,
    });
  }

  for (const relation of logical) {
    const endpoint = logicalEndpoint(relation);
    const existing = byKey.get(endpoint.linkKey);
    // belongsToMany uses a unique link key and never merges with physical FKs.
    if (existing && relation.kind !== 'belongsToMany') {
      byKey.set(endpoint.linkKey, {
        ...existing,
        id: `both:${endpoint.linkKey}`,
        nature: 'both',
        associationId: relation.associationId,
        associationKind: relation.kind,
        associationAs: relation.as,
        fromColumn: existing.fromColumn || endpoint.fromColumn,
        toColumn: existing.toColumn,
      });
      continue;
    }
    byKey.set(endpoint.linkKey, {
      id: `logical:${relation.associationId}`,
      fromTable: endpoint.fromTable,
      fromColumn: endpoint.fromColumn,
      toTable: endpoint.toTable,
      toColumn: relation.kind === 'belongsToMany' ? (relation.otherKey ?? '') : '',
      nature: 'logical',
      associationId: relation.associationId,
      associationKind: relation.kind,
      associationAs: relation.as,
      throughObjectName: relation.throughObjectName,
    });
  }

  return [...byKey.values()];
};

const mergeSnapshotTables = (
  snapshot: SchemaRelationsSnapshot,
  extraTables: ReadonlyArray<LogicalRelationPeerTable>,
): SchemaRelationTable[] => {
  const byName = new Map<string, SchemaRelationTable>();
  for (const table of snapshot.tables) {
    byName.set(table.name, table);
  }
  for (const table of extraTables) {
    if (byName.has(table.name)) {
      continue;
    }
    byName.set(table.name, {
      name: table.name,
      columns: table.columns.map((column) => ({ ...column })),
    });
  }
  return [...byName.values()];
};

const pickDisplayColumns = (
  table: SchemaRelationTable,
  relationColumns: ReadonlySet<string>,
  maxColumns: number,
) => {

  const selected: SchemaRelationTable['columns'] = [];
  const seen = new Set<string>();

  const push = (column: SchemaRelationTable['columns'][number]) => {
    if (seen.has(column.name)) {
      return;
    }
    seen.add(column.name);
    selected.push(column);
  };

  for (const column of table.columns) {
    if (column.isPrimaryKey) {
      push(column);
    }
  }
  for (const column of table.columns) {
    if (relationColumns.has(column.name)) {
      push(column);
    }
  }
  for (const column of table.columns) {
    push(column);
  }

  return selected.slice(0, maxColumns);
};

const resolveMaxColumns = (tableCount: number): number => {
  if (tableCount >= 16) {
    return 3;
  }
  if (tableCount >= 10) {
    return 4;
  }
  if (tableCount >= 6) {
    return 6;
  }
  return 8;
};

const computeNodeHeight = (columnCount: number) => (
  HEADER_HEIGHT + Math.max(columnCount, 1) * ROW_HEIGHT + NODE_PADDING
);

const resolveNodeWidth = (node: Node<SchemaEntityNodeData>) => (
  typeof node.width === 'number' && node.width > 0 ? node.width : NODE_WIDTH
);

const resolveNodeHeight = (node: Node<SchemaEntityNodeData>) => (
  typeof node.height === 'number' && node.height > 0
    ? node.height
    : computeNodeHeight(node.data.columns.length)
);

const shouldUseHubFanLayout = (
  focusId: string,
  nodeCount: number,
  edges: Edge[],
): boolean => {
  if (nodeCount < 3) {
    return false;
  }
  if (edges.length === 0) {
    return nodeCount >= 3;
  }
  const involvingFocus = edges.filter(
    (edge) => edge.source === focusId || edge.target === focusId,
  ).length;
  return involvingFocus >= Math.max(2, Math.ceil(edges.length * 0.5));
};

/** Prefer taller fans for small sides so edges do not share one horizontal lane. */
const chooseSideColumnCount = (count: number): number => {
  if (count <= 4) {
    return 1;
  }
  if (count <= 9) {
    return 2;
  }
  return Math.max(2, Math.ceil(Math.sqrt(count)));
};

const partitionHubNeighbors = (
  others: Node<SchemaEntityNodeData>[],
  edges: Edge[],
  focusId: string,
): {
  left: Node<SchemaEntityNodeData>[];
  right: Node<SchemaEntityNodeData>[];
} => {
  const left: Node<SchemaEntityNodeData>[] = [];
  const right: Node<SchemaEntityNodeData>[] = [];

  for (const node of others) {
    const intoFocus = edges.some((edge) => edge.source === node.id && edge.target === focusId);
    const outOfFocus = edges.some((edge) => edge.source === focusId && edge.target === node.id);
    if (intoFocus && !outOfFocus) {
      left.push(node);
    } else if (outOfFocus && !intoFocus) {
      right.push(node);
    } else if (intoFocus) {
      left.push(node);
    } else if (outOfFocus) {
      right.push(node);
    } else if (left.length <= right.length) {
      left.push(node);
    } else {
      right.push(node);
    }
  }

  // One-sided hubs look flatter as a single row; keep them on one side and fan vertically.
  return { left, right };
};

const measureSidePack = (
  sideNodes: Node<SchemaEntityNodeData>[],
  rowGap: number = HUB_ROW_GAP,
) => {
  const cols = chooseSideColumnCount(sideNodes.length);
  const rows = Math.max(1, Math.ceil(sideNodes.length / cols));
  const colWidths = Array.from({ length: cols }, () => NODE_WIDTH);
  const rowHeights = Array.from({ length: rows }, () => 0);

  sideNodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    colWidths[col] = Math.max(colWidths[col] ?? NODE_WIDTH, resolveNodeWidth(node));
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, resolveNodeHeight(node));
  });

  const width = colWidths.reduce((sum, value, index) => (
    sum + value + (index > 0 ? HUB_COL_GAP : 0)
  ), 0);
  const height = rowHeights.reduce((sum, value, index) => (
    sum + value + (index > 0 ? rowGap : 0)
  ), 0);

  return { cols, rows, colWidths, rowHeights, width, height, rowGap };
};

const placeSideNodes = (
  sideNodes: Node<SchemaEntityNodeData>[],
  originX: number,
  originY: number,
  side: 'left' | 'right',
  rowGap: number = HUB_ROW_GAP,
): Node<SchemaEntityNodeData>[] => {
  const pack = measureSidePack(sideNodes, rowGap);
  const colOffsets: number[] = [];
  let xCursor = 0;
  for (let col = 0; col < pack.cols; col += 1) {
    colOffsets[col] = xCursor;
    xCursor += (pack.colWidths[col] ?? NODE_WIDTH) + HUB_COL_GAP;
  }

  const rowOffsets: number[] = [];
  let yCursor = 0;
  for (let row = 0; row < pack.rows; row += 1) {
    rowOffsets[row] = yCursor;
    yCursor += (pack.rowHeights[row] ?? 0) + pack.rowGap;
  }

  return sideNodes.map((node, index) => {
    const col = index % pack.cols;
    const row = Math.floor(index / pack.cols);
    const width = resolveNodeWidth(node);
    const height = resolveNodeHeight(node);
    const cellWidth = pack.colWidths[col] ?? NODE_WIDTH;
    const cellHeight = pack.rowHeights[row] ?? height;
    // Zig-zag X so parallel edges leave the focus at different lanes.
    const staggerSign = side === 'left' ? -1 : 1;
    const stagger = (row % 2 === 0 ? -HUB_STAGGER_X : HUB_STAGGER_X) * staggerSign * 0.35
      + (col % 2 === 0 ? 0 : HUB_STAGGER_X * 0.45 * staggerSign);

    return {
      ...node,
      width,
      height,
      position: {
        x: originX + (colOffsets[col] ?? 0) + (cellWidth - width) / 2 + stagger,
        y: originY + (rowOffsets[row] ?? 0) + (cellHeight - height) / 2,
      },
    };
  });
};

const layoutHubFan = (
  nodes: Node<SchemaEntityNodeData>[],
  edges: Edge[],
  focusId: string,
): Node<SchemaEntityNodeData>[] => {
  const focusNode = nodes.find((node) => node.id === focusId);
  const others = nodes.filter((node) => node.id !== focusId);
  if (!focusNode || others.length === 0) {
    return nodes;
  }

  const { left, right } = partitionHubNeighbors(others, edges, focusId);
  const focusGap = resolveHubFocusGap(others.length);
  const rowGap = resolveHubRowGap(others.length);
  const leftPack = measureSidePack(left, rowGap);
  const rightPack = measureSidePack(right, rowGap);
  const focusWidth = resolveNodeWidth(focusNode);
  const focusHeight = resolveNodeHeight(focusNode);

  const contentHeight = Math.max(leftPack.height, rightPack.height, focusHeight);
  const focusX = left.length > 0 ? leftPack.width + focusGap : 0;
  const focusY = (contentHeight - focusHeight) / 2;
  const leftOriginY = (contentHeight - leftPack.height) / 2;
  const rightOriginX = focusX + focusWidth + focusGap;
  const rightOriginY = (contentHeight - rightPack.height) / 2;

  return [
    ...placeSideNodes(left, 0, leftOriginY, 'left', rowGap),
    {
      ...focusNode,
      width: focusWidth,
      height: focusHeight,
      position: { x: focusX, y: focusY },
    },
    ...placeSideNodes(right, rightOriginX, rightOriginY, 'right', rowGap),
  ];
};

const layoutWithDagre = (nodes: Node<SchemaEntityNodeData>[], edges: Edge[]) => {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 56,
    ranksep: nodes.length <= 4 ? 200 : nodes.length <= 8 ? 140 : 100,
    marginx: 24,
    marginy: 24,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const width = resolveNodeWidth(node);
    const height = resolveNodeHeight(node);
    graph.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);
    const width = resolveNodeWidth(node);
    const height = resolveNodeHeight(node);
    if (!position) {
      return {
        ...node,
        width,
        height,
        position: { x: 0, y: 0 },
      };
    }

    return {
      ...node,
      width,
      height,
      position: {
        x: position.x - width / 2,
        y: position.y - height / 2,
      },
    };
  });
};

export const applySchemaRelationsDiagramLayout = (
  nodes: Node<SchemaEntityNodeData>[],
  layout: SchemaRelationsDiagramLayout | null | undefined,
): Node<SchemaEntityNodeData>[] => {
  if (!layout?.nodes) {
    return nodes;
  }

  let appliedAny = false;
  const next = nodes.map((node) => {
    const saved = layout.nodes[node.id];
    if (!saved) {
      return node;
    }
    appliedAny = true;
    const width = saved.width && saved.width > 0 ? saved.width : resolveNodeWidth(node);
    const height = saved.height && saved.height > 0 ? saved.height : resolveNodeHeight(node);
    return {
      ...node,
      width,
      height,
      position: { x: saved.x, y: saved.y },
      style: {
        ...(typeof node.style === 'object' && node.style ? node.style : {}),
        width,
        height,
      },
    };
  });

  return appliedAny ? next : nodes;
};

const sortEdgesForLabelLayout = (
  group: ReadonlyArray<Edge<SchemaRelationEdgeData>>,
): Edge<SchemaRelationEdgeData>[] => (
  [...group].sort((a, b) => {
    const titleCmp = (a.data?.title ?? a.id).localeCompare(b.data?.title ?? b.id);
    if (titleCmp !== 0) {
      return titleCmp;
    }
    return a.id.localeCompare(b.id);
  })
);

const spreadAlongChord = (index: number, total: number, min: number, max: number): number => {
  if (total <= 1) {
    return 0.5;
  }
  return min + (index / (total - 1)) * (max - min);
};

/** Tight fan — labels stay near the edge midpoint without stacking. */
const LABEL_FAN_ALONG_TARGET = { min: 0.4, max: 0.6 } as const;
const LABEL_FAN_ALONG_SOURCE = { min: 0.46, max: 0.54 } as const;
const LABEL_FAN_NORMAL_TARGET_PX = 11;
const LABEL_FAN_NORMAL_SOURCE_PX = 8;

/** Spreads labels when multiple edges share a path or converge on one table. */
export const applySchemaRelationEdgeLabelLayout = (
  edges: Edge<SchemaRelationEdgeData>[],
): Edge<SchemaRelationEdgeData>[] => {
  const byPair = new Map<string, Edge<SchemaRelationEdgeData>[]>();
  const byTarget = new Map<string, Edge<SchemaRelationEdgeData>[]>();
  const bySource = new Map<string, Edge<SchemaRelationEdgeData>[]>();

  for (const edge of edges) {
    const pairKey = `${edge.source}\u0000${edge.target}`;
    const pairList = byPair.get(pairKey) ?? [];
    pairList.push(edge);
    byPair.set(pairKey, pairList);

    const targetList = byTarget.get(edge.target) ?? [];
    targetList.push(edge);
    byTarget.set(edge.target, targetList);

    const sourceList = bySource.get(edge.source) ?? [];
    sourceList.push(edge);
    bySource.set(edge.source, sourceList);
  }

  return edges.map((edge) => {
    const pairKey = `${edge.source}\u0000${edge.target}`;
    const pairGroup = sortEdgesForLabelLayout(byPair.get(pairKey) ?? [edge]);
    const parallelIndex = pairGroup.findIndex((item) => item.id === edge.id);
    const parallelTotal = pairGroup.length;

    const targetGroup = sortEdgesForLabelLayout(byTarget.get(edge.target) ?? [edge]);
    const targetIndex = targetGroup.findIndex((item) => item.id === edge.id);
    const targetTotal = targetGroup.length;

    const sourceGroup = sortEdgesForLabelLayout(bySource.get(edge.source) ?? [edge]);
    const sourceIndex = sourceGroup.findIndex((item) => item.id === edge.id);
    const sourceTotal = sourceGroup.length;

    const targetAlong = spreadAlongChord(
      targetIndex,
      targetTotal,
      LABEL_FAN_ALONG_TARGET.min,
      LABEL_FAN_ALONG_TARGET.max,
    );
    const sourceAlong = spreadAlongChord(
      sourceIndex,
      sourceTotal,
      LABEL_FAN_ALONG_SOURCE.min,
      LABEL_FAN_ALONG_SOURCE.max,
    );
    const labelAlongFraction = targetTotal >= 2 && sourceTotal >= 2
      ? (targetAlong + sourceAlong) / 2
      : targetTotal >= 2
        ? targetAlong
        : sourceTotal >= 2
          ? sourceAlong
          : 0.5;

    // Parallel pair offset is applied in SchemaRelationEdge only — do not double-count here.
    let labelNormalOffset = 0;
    if (targetTotal >= 2) {
      labelNormalOffset += (targetIndex - (targetTotal - 1) / 2) * LABEL_FAN_NORMAL_TARGET_PX;
    }
    if (sourceTotal >= 2) {
      labelNormalOffset += (sourceIndex - (sourceTotal - 1) / 2) * LABEL_FAN_NORMAL_SOURCE_PX;
    }

    const needsLayout = parallelTotal > 1
      || targetTotal >= 2
      || sourceTotal >= 2;
    if (needsLayout && targetTotal >= 2 && sourceTotal >= 2) {
      const hash = edge.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      labelNormalOffset += ((hash % 5) - 2) * 2;
    }

    if (!needsLayout) {
      return edge;
    }

    return {
      ...edge,
      data: {
        ...edge.data,
        ...(parallelTotal > 1 ? { parallelIndex, parallelTotal } : {}),
        labelAlongFraction,
        labelNormalOffset,
      },
    };
  });
};

const DRILL_PAIR_GAP_PER_EDGE = 52;
const DRILL_PAIR_MIN_GAP = 380;
const DRILL_STAR_COLUMN_GAP = 340;
const DRILL_STAR_ROW_GAP = 56;

/** Wider label + lane spacing for focused drill-down (many edges between two tables). */
export const applySchemaRelationDrillDownEdgeLayout = (
  edges: Edge<SchemaRelationEdgeData>[],
): Edge<SchemaRelationEdgeData>[] => {
  const byPair = new Map<string, Edge<SchemaRelationEdgeData>[]>();
  for (const edge of edges) {
    const pairKey = `${edge.source}\u0000${edge.target}`;
    const list = byPair.get(pairKey) ?? [];
    list.push(edge);
    byPair.set(pairKey, list);
  }

  return edges.map((edge) => {
    const pairKey = `${edge.source}\u0000${edge.target}`;
    const pairGroup = sortEdgesForLabelLayout(byPair.get(pairKey) ?? [edge]);
    const parallelIndex = pairGroup.findIndex((item) => item.id === edge.id);
    const parallelTotal = pairGroup.length;
    if (parallelTotal <= 1) {
      return edge;
    }

    const labelAlongFraction = 0.16 + (parallelIndex / (parallelTotal - 1)) * 0.68;
    return {
      ...edge,
      data: {
        ...edge.data,
        parallelIndex,
        parallelTotal,
        labelAlongFraction,
        labelNormalOffset: 0,
        drillDownRibbon: true,
      },
    };
  });
};

const layoutDrillDownTwoTable = (
  nodes: Node<SchemaEntityNodeData>[],
  centerTable: string,
  edgeCount: number,
): Node<SchemaEntityNodeData>[] => {
  const center = nodes.find((node) => node.id === centerTable);
  const peer = nodes.find((node) => node.id !== centerTable);
  if (!center || !peer) {
    return nodes;
  }

  const peerWidth = resolveNodeWidth(peer);
  const centerWidth = resolveNodeWidth(center);
  const minHeight = Math.max(140, edgeCount * 40 + 88);
  const peerHeight = Math.max(resolveNodeHeight(peer), minHeight);
  const centerHeight = Math.max(resolveNodeHeight(center), minHeight);
  const stackHeight = Math.max(peerHeight, centerHeight);
  const gap = Math.max(DRILL_PAIR_MIN_GAP, edgeCount * DRILL_PAIR_GAP_PER_EDGE);

  return nodes.map((node) => {
    if (node.id === peer.id) {
      return {
        ...node,
        width: peerWidth,
        height: peerHeight,
        position: { x: 0, y: (stackHeight - peerHeight) / 2 },
      };
    }
    if (node.id === center.id) {
      return {
        ...node,
        width: centerWidth,
        height: centerHeight,
        position: { x: peerWidth + gap, y: (stackHeight - centerHeight) / 2 },
      };
    }
    return node;
  });
};

const layoutDrillDownStar = (
  nodes: Node<SchemaEntityNodeData>[],
  centerTable: string,
): Node<SchemaEntityNodeData>[] => {
  const center = nodes.find((node) => node.id === centerTable);
  if (!center) {
    return nodes;
  }
  const peers = nodes.filter((node) => node.id !== centerTable);
  if (peers.length === 0) {
    return nodes;
  }

  const centerWidth = resolveNodeWidth(center);
  const centerHeight = resolveNodeHeight(center);
  const peerWidths = peers.map((peer) => resolveNodeWidth(peer));
  const maxPeerWidth = Math.max(...peerWidths);
  const peerHeights = peers.map((peer) => resolveNodeHeight(peer));
  const stackHeight = peerHeights.reduce((sum, height) => sum + height, 0)
    + DRILL_STAR_ROW_GAP * (peers.length - 1);
  const contentHeight = Math.max(stackHeight, centerHeight);

  let yCursor = (contentHeight - stackHeight) / 2;
  const positionedPeers = peers.map((peer, index) => {
    const width = peerWidths[index] ?? NODE_WIDTH;
    const height = peerHeights[index] ?? resolveNodeHeight(peer);
    const positioned = {
      ...peer,
      width,
      height,
      position: { x: 0, y: yCursor },
    };
    yCursor += height + DRILL_STAR_ROW_GAP;
    return positioned;
  });

  const positionedCenter = {
    ...center,
    width: centerWidth,
    height: centerHeight,
    position: {
      x: maxPeerWidth + DRILL_STAR_COLUMN_GAP,
      y: (contentHeight - centerHeight) / 2,
    },
  };

  return [...positionedPeers, positionedCenter];
};

export const layoutSchemaRelationDrillDownNodes = (
  nodes: Node<SchemaEntityNodeData>[],
  edges: Edge<SchemaRelationEdgeData>[],
  centerTable: string,
): Node<SchemaEntityNodeData>[] => {
  const tableCount = nodes.length;
  if (tableCount === 2) {
    return layoutDrillDownTwoTable(nodes, centerTable, edges.length);
  }
  if (tableCount >= 3) {
    return layoutDrillDownStar(nodes, centerTable);
  }
  return nodes;
};

/** Keeps only edges incident to `centerTable` and their endpoint tables; drill layout. */
export const applySchemaRelationEntityDrillDown = (
  graph: {
    nodes: Node<SchemaEntityNodeData>[];
    edges: Edge<SchemaRelationEdgeData>[];
  },
  centerTable: string,
): {
  nodes: Node<SchemaEntityNodeData>[];
  edges: Edge<SchemaRelationEdgeData>[];
} | null => {
  const incidentEdges = graph.edges.filter((edge) => (
    edge.source === centerTable || edge.target === centerTable
  ));
  if (incidentEdges.length === 0) {
    return null;
  }

  const tableIds = new Set<string>([centerTable]);
  for (const edge of incidentEdges) {
    tableIds.add(edge.source);
    tableIds.add(edge.target);
  }

  const nodes = graph.nodes
    .filter((node) => tableIds.has(node.id))
    .map((node) => ({
      ...node,
      data: {
        ...node.data,
        isFocus: node.id === centerTable,
      },
    }));

  const laidOutNodes = layoutSchemaRelationDrillDownNodes(nodes, incidentEdges, centerTable);
  const laidOutEdges = applySchemaRelationDrillDownEdgeLayout(
    applySchemaRelationEdgeLabelLayout(incidentEdges),
  );

  return {
    nodes: laidOutNodes,
    edges: laidOutEdges,
  };
};

export const relayoutSchemaRelationNodes = (
  nodes: Node<SchemaEntityNodeData>[],
  edges: Edge[],
  focusId: string,
  mode: CanvasGraphLayoutMode,
): Node<SchemaEntityNodeData>[] => {
  const inputs = nodes.map((node) => ({
    id: node.id,
    width: resolveNodeWidth(node),
    height: resolveNodeHeight(node),
  }));
  const edgeInputs = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));
  const positions = computeCanvasGraphLayout(mode, inputs, edgeInputs, focusId, {
    traverseUndirected: true,
  });
  return nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) {
      return node;
    }
    return {
      ...node,
      position,
    };
  });
};

export const collectSchemaRelationsDiagramLayout = (
  nodes: Array<Pick<Node<SchemaEntityNodeData>, 'id' | 'position' | 'width' | 'height' | 'measured'>>,
): SchemaRelationsDiagramLayout => {
  const layoutNodes: SchemaRelationsDiagramLayout['nodes'] = {};
  for (const node of nodes) {
    const measuredWidth = node.measured?.width;
    const measuredHeight = node.measured?.height;
    const width = typeof node.width === 'number' && node.width > 0
      ? node.width
      : (typeof measuredWidth === 'number' && measuredWidth > 0 ? measuredWidth : undefined);
    const height = typeof node.height === 'number' && node.height > 0
      ? node.height
      : (typeof measuredHeight === 'number' && measuredHeight > 0 ? measuredHeight : undefined);
    layoutNodes[node.id] = {
      x: node.position.x,
      y: node.position.y,
      ...(width ? { width: Math.round(width) } : {}),
      ...(height ? { height: Math.round(height) } : {}),
    };
  }
  return {
    algorithmVersion: SCHEMA_RELATIONS_DIAGRAM_LAYOUT_ALGORITHM_VERSION,
    nodes: layoutNodes,
  };
};

export function buildEdgeSchemaFlowGraph(
  snapshot: SchemaRelationsSnapshot,
  options: {
    layout?: SchemaRelationsDiagramLayout | null;
    logicalRelations?: ReadonlyArray<LogicalRelationGraphInput>;
    extraTables?: ReadonlyArray<LogicalRelationPeerTable>;
  } = {},
): {
  nodes: Node<SchemaEntityNodeData>[];
  edges: Edge<SchemaRelationEdgeData>[];
} {
  const tables = mergeSnapshotTables(snapshot, options.extraTables ?? []);
  const links = mergePhysicalAndLogicalLinks(
    snapshot.relations,
    options.logicalRelations ?? [],
  );
  const maxColumns = resolveMaxColumns(tables.length);

  const relationColumnsByTable = new Map<string, Set<string>>();
  const ensureRelationColumns = (tableName: string) => {
    let set = relationColumnsByTable.get(tableName);
    if (!set) {
      set = new Set<string>();
      relationColumnsByTable.set(tableName, set);
    }
    return set;
  };
  for (const link of links) {
    ensureRelationColumns(link.fromTable).add(link.fromColumn);
    if (link.toColumn) {
      ensureRelationColumns(link.toTable).add(link.toColumn);
    }
  }

  const nodes: Node<SchemaEntityNodeData>[] = tables.map((table) => {
    const relationColumns = relationColumnsByTable.get(table.name) ?? new Set<string>();
    const displayColumns = pickDisplayColumns(table, relationColumns, maxColumns);

    return {
      id: table.name,
      type: 'schemaEntity',
      position: { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: computeNodeHeight(displayColumns.length),
      data: {
        tableName: table.name,
        isFocus: table.name === snapshot.focusObject,
        columns: displayColumns.map((column) => ({
          name: column.name,
          dataType: column.dataType,
          isPrimaryKey: column.isPrimaryKey,
          isRelationKey: relationColumns.has(column.name),
        })),
      },
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: Edge<SchemaRelationEdgeData>[] = applySchemaRelationEdgeLabelLayout(
    links
    .filter((link) => nodeIds.has(link.fromTable) && nodeIds.has(link.toTable))
    .map((link) => {
      const labelParts = buildDiagramLinkLabelParts(link);
      const data: SchemaRelationEdgeData = {
        title: labelParts.title,
        kindLabel: labelParts.kindLabel,
        natureLabel: labelParts.natureLabel,
        relationNature: link.nature,
        associationId: link.associationId,
        associationKind: link.associationKind,
        associationAs: link.associationAs,
        fromColumn: link.fromColumn,
        toColumn: link.toColumn || undefined,
        physicalConstraintName: link.physicalConstraintName,
        onDelete: link.onDelete,
        onUpdate: link.onUpdate,
      };
      return {
        id: link.id,
        source: link.fromTable,
        target: link.toTable,
        type: 'schemaRelation',
        data,
        style: schemaRelationEdgeStyle(link.nature),
        markerEnd: schemaRelationEdgeMarker(link.nature),
      };
    }),
  );

  const autoLaidOut = shouldUseHubFanLayout(snapshot.focusObject, nodes.length, edges)
    ? layoutHubFan(nodes, edges, snapshot.focusObject)
    : layoutWithDagre(nodes, edges);

  return {
    nodes: applySchemaRelationsDiagramLayout(autoLaidOut, options.layout),
    edges,
  };
}

/**
 * Keeps existing node positions and fans newly discovered tables near the expanded anchor.
 */
export function mergeExpandedSchemaRelationGraph(args: {
  existingNodes: Node<SchemaEntityNodeData>[];
  nextGraph: {
    nodes: Node<SchemaEntityNodeData>[];
    edges: Edge[];
  };
  anchorTableName: string;
  expandedTableNames: ReadonlySet<string>;
  expandingTableNames: ReadonlySet<string>;
}): {
  nodes: Node<SchemaEntityNodeData>[];
  edges: Edge[];
} {
  const existingById = new Map(args.existingNodes.map((node) => [node.id, node]));
  const anchor = existingById.get(args.anchorTableName);
  const focusId = args.nextGraph.nodes.find((node) => node.data.isFocus)?.id;

  const refreshedExisting = args.nextGraph.nodes
    .filter((node) => existingById.has(node.id))
    .map((node) => {
      const previous = existingById.get(node.id)!;
      return {
        ...node,
        position: previous.position,
        width: previous.width ?? node.width,
        height: node.height,
        style: previous.style,
        data: {
          ...node.data,
          canExpand: !node.data.isFocus && !args.expandedTableNames.has(node.id),
          isExpanding: args.expandingTableNames.has(node.id),
          isExpanded: args.expandedTableNames.has(node.id),
        },
      };
    });

  const newNodes = args.nextGraph.nodes.filter((node) => !existingById.has(node.id));
  const anchorWidth = anchor
    ? (typeof anchor.width === 'number' && anchor.width > 0 ? anchor.width : NODE_WIDTH)
    : NODE_WIDTH;
  const originX = anchor
    ? anchor.position.x + anchorWidth + resolveHubFocusGap(Math.max(newNodes.length, 2))
    : 0;
  const totalNewHeight = newNodes.reduce((sum, node, index) => (
    sum + resolveNodeHeight(node) + (index > 0 ? resolveHubRowGap(newNodes.length) : 0)
  ), 0);
  const originY = anchor
    ? anchor.position.y + (resolveNodeHeight(anchor) - totalNewHeight) / 2
    : 0;

  let yCursor = originY;
  const placedNew = newNodes.map((node, index) => {
    const height = resolveNodeHeight(node);
    const width = resolveNodeWidth(node);
    const next = {
      ...node,
      width,
      height,
      position: {
        x: originX + (index % 2 === 0 ? 0 : HUB_STAGGER_X),
        y: yCursor,
      },
      data: {
        ...node.data,
        isFocus: focusId ? node.id === focusId : node.data.isFocus,
        canExpand: !node.data.isFocus && !args.expandedTableNames.has(node.id),
        isExpanding: args.expandingTableNames.has(node.id),
        isExpanded: args.expandedTableNames.has(node.id),
      },
    };
    yCursor += height + resolveHubRowGap(newNodes.length);
    return next;
  });

  return {
    nodes: [...refreshedExisting, ...placedNew],
    edges: args.nextGraph.edges,
  };
}

export const withSchemaRelationExpandState = (
  nodes: Node<SchemaEntityNodeData>[],
  expandedTableNames: ReadonlySet<string>,
  expandingTableNames: ReadonlySet<string>,
): Node<SchemaEntityNodeData>[] => (
  nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      canExpand: !node.data.isFocus && !expandedTableNames.has(node.id),
      isExpanding: expandingTableNames.has(node.id),
      isExpanded: expandedTableNames.has(node.id),
    },
  }))
);

export const SCHEMA_ENTITY_NODE_WIDTH = NODE_WIDTH;
export const computeSchemaEntityNodeHeight = computeNodeHeight;
