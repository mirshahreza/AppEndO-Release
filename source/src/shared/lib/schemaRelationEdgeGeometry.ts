import { Position, type InternalNode } from '@xyflow/react';

export type SchemaRelationNodeBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SchemaRelationEdgeEndpoints = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
};

const DEFAULT_NODE_WIDTH = 228;
const DEFAULT_NODE_HEIGHT = 120;

export const nodeBoxFromInternalNode = (
  node: InternalNode | undefined,
): SchemaRelationNodeBox | null => {
  if (!node) {
    return null;
  }
  const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, width, height };
};

export const pointOnNodeSide = (
  box: SchemaRelationNodeBox,
  side: Position,
): { x: number; y: number } => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  switch (side) {
    case Position.Left:
      return { x: box.x, y: cy };
    case Position.Right:
      return { x: box.x + box.width, y: cy };
    case Position.Top:
      return { x: cx, y: box.y };
    case Position.Bottom:
      return { x: cx, y: box.y + box.height };
    default:
      return { x: cx, y: cy };
  }
};

/** Pick sides so the edge leaves/enters the closest faces (no diagonal criss-cross). */
export const pickClosestNodeSides = (
  source: SchemaRelationNodeBox,
  target: SchemaRelationNodeBox,
): { sourceSide: Position; targetSide: Position } => {
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      return { sourceSide: Position.Right, targetSide: Position.Left };
    }
    return { sourceSide: Position.Left, targetSide: Position.Right };
  }
  if (dy >= 0) {
    return { sourceSide: Position.Bottom, targetSide: Position.Top };
  }
  return { sourceSide: Position.Top, targetSide: Position.Bottom };
};

const SIDE_INSET = 0.1;

/** `t` in 0..1 runs along the side (top→bottom for left/right faces). */
export const pointOnNodeSideAt = (
  box: SchemaRelationNodeBox,
  side: Position,
  t: number,
): { x: number; y: number } => {
  const clamped = Math.min(1, Math.max(0, t));
  const u = SIDE_INSET + clamped * (1 - 2 * SIDE_INSET);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  switch (side) {
    case Position.Left:
      return { x: box.x, y: box.y + box.height * u };
    case Position.Right:
      return { x: box.x + box.width, y: box.y + box.height * u };
    case Position.Top:
      return { x: box.x + box.width * u, y: box.y };
    case Position.Bottom:
      return { x: box.x + box.width * u, y: box.y + box.height };
    default:
      return { x: cx, y: cy };
  }
};

export const resolveSchemaRelationEdgeEndpoints = (
  sourceNode: InternalNode | undefined,
  targetNode: InternalNode | undefined,
  parallelIndex = 0,
  parallelTotal = 1,
  options?: { useSideLanes?: boolean },
): SchemaRelationEdgeEndpoints | null => {
  const sourceBox = nodeBoxFromInternalNode(sourceNode);
  const targetBox = nodeBoxFromInternalNode(targetNode);
  if (!sourceBox || !targetBox) {
    return null;
  }

  const { sourceSide, targetSide } = pickClosestNodeSides(sourceBox, targetBox);
  const laneT = parallelTotal <= 1
    ? 0.5
    : parallelIndex / (parallelTotal - 1);

  const useLanes = options?.useSideLanes ?? parallelTotal > 1;
  const sourcePoint = useLanes
    ? pointOnNodeSideAt(sourceBox, sourceSide, laneT)
    : pointOnNodeSideAt(sourceBox, sourceSide, 0.5);
  const targetPoint = useLanes
    ? pointOnNodeSideAt(targetBox, targetSide, laneT)
    : pointOnNodeSideAt(targetBox, targetSide, 0.5);

  return {
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    sourcePosition: sourceSide,
    targetPosition: targetSide,
  };
};
