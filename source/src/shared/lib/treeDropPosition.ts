import type { TreeDropPosition } from '../types/tree';

/** Top / middle / bottom bands map to sibling-before, child-of, sibling-after. */
export function getTreeDropPositionCandidates(relativeY: number): TreeDropPosition[] {
  if (relativeY < 0.25) return ['before', 'after', 'inside'];
  if (relativeY > 0.75) return ['after', 'before', 'inside'];
  return ['inside', 'before', 'after'];
}

export function resolveTreeDropPosition(
  relativeY: number,
  canDrop: (position: TreeDropPosition) => boolean,
): TreeDropPosition | null {
  for (const candidate of getTreeDropPositionCandidates(relativeY)) {
    if (canDrop(candidate)) {
      return candidate;
    }
  }
  return null;
}
