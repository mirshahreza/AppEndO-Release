import dagre from '@dagrejs/dagre';

export type CanvasGraphLayoutMode = 'horizontal' | 'vertical' | 'triangle' | 'radial';

export const CANVAS_GRAPH_LAYOUT_OPTIONS: ReadonlyArray<{
  value: CanvasGraphLayoutMode;
  label: string;
}> = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'radial', label: 'Radial' },
];

export type CanvasGraphNodeInput = {
  id: string;
  width: number;
  height: number;
};

export type CanvasGraphEdgeInput = {
  source: string;
  target: string;
};

type NodePosition = { x: number; y: number };

type Rankdir = 'LR' | 'TB';

const computeDagrePositions = (
  nodes: CanvasGraphNodeInput[],
  edges: CanvasGraphEdgeInput[],
  rankdir: Rankdir,
): Map<string, NodePosition> => {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir,
    nodesep: rankdir === 'LR' ? 48 : 56,
    ranksep: rankdir === 'LR' ? 100 : 88,
    marginx: 24,
    marginy: 24,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  const positions = new Map<string, NodePosition>();
  for (const node of nodes) {
    const position = graph.node(node.id);
    if (!position) {
      continue;
    }
    positions.set(node.id, {
      x: position.x - node.width / 2,
      y: position.y - node.height / 2,
    });
  }
  return positions;
};

/** BFS from start; remaining disconnected nodes append in input order. */
export const orderGraphNodesForLayout = (
  nodes: CanvasGraphNodeInput[],
  edges: CanvasGraphEdgeInput[],
  startId?: string,
  options?: { traverseUndirected?: boolean },
): string[] => {
  const keys = nodes.map((node) => node.id);
  if (keys.length === 0) {
    return [];
  }

  const adjacency = new Map<string, string[]>();
  for (const key of keys) {
    adjacency.set(key, []);
  }
  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) {
      continue;
    }
    adjacency.get(edge.source)!.push(edge.target);
    if (options?.traverseUndirected) {
      adjacency.get(edge.target)!.push(edge.source);
    }
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  const queue: string[] = [];
  const start = startId && adjacency.has(startId) ? startId : keys[0];

  if (start) {
    queue.push(start);
    seen.add(start);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const next of adjacency.get(current) ?? []) {
      if (seen.has(next)) {
        continue;
      }
      seen.add(next);
      queue.push(next);
    }
  }

  for (const key of keys) {
    if (!seen.has(key)) {
      ordered.push(key);
    }
  }

  return ordered;
};

const computeRadialPositions = (
  nodes: CanvasGraphNodeInput[],
  edges: CanvasGraphEdgeInput[],
  startId?: string,
  traverseUndirected?: boolean,
): Map<string, NodePosition> => {
  const ordered = orderGraphNodesForLayout(nodes, edges, startId, { traverseUndirected });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const positions = new Map<string, NodePosition>();
  if (ordered.length === 0) {
    return positions;
  }

  if (ordered.length === 1) {
    const only = byId.get(ordered[0]!);
    if (only) {
      positions.set(only.id, { x: 0, y: 0 });
    }
    return positions;
  }

  const maxDim = ordered.reduce((max, id) => {
    const node = byId.get(id);
    if (!node) {
      return max;
    }
    return Math.max(max, node.width, node.height);
  }, 120);

  const radius = Math.max(220, ordered.length * (maxDim * 0.55));
  const centerX = radius;
  const centerY = radius;

  ordered.forEach((id, index) => {
    const node = byId.get(id);
    if (!node) {
      return;
    }
    const angle = -Math.PI / 2 + (index / ordered.length) * Math.PI * 2;
    positions.set(id, {
      x: centerX + radius * Math.cos(angle) - node.width / 2,
      y: centerY + radius * Math.sin(angle) - node.height / 2,
    });
  });

  return positions;
};

const computeTrianglePositions = (
  nodes: CanvasGraphNodeInput[],
  edges: CanvasGraphEdgeInput[],
  startId?: string,
  traverseUndirected?: boolean,
): Map<string, NodePosition> => {
  const ordered = orderGraphNodesForLayout(nodes, edges, startId, { traverseUndirected });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const positions = new Map<string, NodePosition>();
  if (ordered.length === 0) {
    return positions;
  }

  if (ordered.length === 1) {
    const only = byId.get(ordered[0]!);
    if (only) {
      positions.set(only.id, { x: 0, y: 0 });
    }
    return positions;
  }

  const maxDim = ordered.reduce((max, id) => {
    const node = byId.get(id);
    if (!node) {
      return max;
    }
    return Math.max(max, node.width, node.height);
  }, 120);

  const side = Math.max(320, ordered.length * (maxDim * 0.85));
  const height = (Math.sqrt(3) / 2) * side;
  const vertices = [
    { x: side / 2, y: 0 },
    { x: side, y: height },
    { x: 0, y: height },
  ] as const;

  const perimeter = side * 3;
  const step = perimeter / ordered.length;

  ordered.forEach((id, index) => {
    const node = byId.get(id);
    if (!node) {
      return;
    }
    let distance = (index * step) % perimeter;
    let remaining = distance;
    let from = vertices[0];
    let to = vertices[1];

    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      from = vertices[edgeIndex]!;
      to = vertices[(edgeIndex + 1) % 3]!;
      if (remaining <= side) {
        break;
      }
      remaining -= side;
    }

    const t = side === 0 ? 0 : remaining / side;
    positions.set(id, {
      x: from.x + (to.x - from.x) * t - node.width / 2,
      y: from.y + (to.y - from.y) * t - node.height / 2,
    });
  });

  return positions;
};

export type CanvasGraphLayoutOptions = {
  /** When true, BFS for triangle/radial walks edges in both directions (schema ER diagrams). */
  traverseUndirected?: boolean;
};

export function computeCanvasGraphLayout(
  mode: CanvasGraphLayoutMode,
  nodes: CanvasGraphNodeInput[],
  edges: CanvasGraphEdgeInput[],
  startId?: string,
  options?: CanvasGraphLayoutOptions,
): Map<string, NodePosition> {
  const traverseUndirected = options?.traverseUndirected ?? false;
  switch (mode) {
    case 'horizontal':
      return computeDagrePositions(nodes, edges, 'LR');
    case 'vertical':
      return computeDagrePositions(nodes, edges, 'TB');
    case 'triangle':
      return computeTrianglePositions(nodes, edges, startId, traverseUndirected);
    case 'radial':
      return computeRadialPositions(nodes, edges, startId, traverseUndirected);
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}
