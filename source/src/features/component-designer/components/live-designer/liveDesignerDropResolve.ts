import {
  canInsertPaletteItemWithAutoWrap,
  canMoveNodeToParent,
  getPaletteItemById,
  isContainerNode,
} from '../../../../domain/component-designer/catalog';
import { isDescendantNode } from '../../../../domain/component-designer/documentTree';
import type { DesignerDocument, DesignerNode } from '../../../../domain/component-designer/types';
import type { LiveDesignerOutlineRect } from './liveDesignerHitTest';

export type LiveDesignerDropPlacement = 'before' | 'after' | 'inside';

export type LiveDesignerDragSource =
  | { kind: 'node'; nodeId: string }
  | { kind: 'palette'; itemId: string };

export type LiveDesignerDropTarget = {
  parentId: string;
  index: number;
  placement: LiveDesignerDropPlacement;
  anchorNodeId: string;
};

export type LiveDesignerDropIndicator = LiveDesignerOutlineRect & {
  kind: 'line' | 'container' | 'invalid';
};

function getNode(document: DesignerDocument, nodeId: string): DesignerNode | null {
  return document.nodes[nodeId] ?? null;
}

export function canLiveDesignerMoveNode(
  document: DesignerDocument,
  nodeId: string,
  targetParentId: string,
): boolean {
  if (!nodeId || nodeId === document.rootNodeId || nodeId === targetParentId) {
    return false;
  }

  const node = getNode(document, nodeId);
  const targetParent = getNode(document, targetParentId);
  if (!node || !targetParent || !node.parentId) {
    return false;
  }

  if (isDescendantNode(document.nodes, targetParentId, nodeId)) {
    return false;
  }

  return canMoveNodeToParent(node, targetParent);
}

export function canLiveDesignerDropOnParent(
  document: DesignerDocument,
  source: LiveDesignerDragSource,
  targetParentId: string,
): boolean {
  if (source.kind === 'palette') {
    const item = getPaletteItemById(source.itemId);
    const parent = getNode(document, targetParentId);
    if (!item || !parent) {
      return false;
    }
    return canInsertPaletteItemWithAutoWrap(item, parent);
  }

  return canLiveDesignerMoveNode(document, source.nodeId, targetParentId);
}

export function isLiveDesignerNoOpMove(
  document: DesignerDocument,
  nodeId: string,
  targetParentId: string,
  index: number,
): boolean {
  const node = getNode(document, nodeId);
  if (!node || node.parentId !== targetParentId) {
    return false;
  }

  const siblings = getNode(document, targetParentId)?.children ?? [];
  const currentIndex = siblings.indexOf(nodeId);
  if (currentIndex < 0) {
    return false;
  }

  return index === currentIndex || index === currentIndex + 1;
}

function resolveSiblingDrop(
  document: DesignerDocument,
  source: LiveDesignerDragSource,
  hitNode: DesignerNode,
  pointerY: number,
  hitRect: LiveDesignerOutlineRect | null,
): LiveDesignerDropTarget | null {
  const parentId = hitNode.parentId;
  if (!parentId) {
    return null;
  }

  const parent = getNode(document, parentId);
  if (!parent || !canLiveDesignerDropOnParent(document, source, parentId)) {
    return null;
  }

  const siblingIndex = parent.children.indexOf(hitNode.id);
  if (siblingIndex < 0) {
    return null;
  }

  const placeAfter = Boolean(hitRect && pointerY > hitRect.top + hitRect.height / 2);
  return {
    parentId,
    index: placeAfter ? siblingIndex + 1 : siblingIndex,
    placement: placeAfter ? 'after' : 'before',
    anchorNodeId: hitNode.id,
  };
}

function resolveInsideDrop(
  document: DesignerDocument,
  source: LiveDesignerDragSource,
  hitNode: DesignerNode,
): LiveDesignerDropTarget | null {
  if (!canLiveDesignerDropOnParent(document, source, hitNode.id)) {
    return null;
  }

  return {
    parentId: hitNode.id,
    index: hitNode.children.length,
    placement: 'inside',
    anchorNodeId: hitNode.id,
  };
}

/**
 * Resolve a drop target from the node under the pointer.
 * - Container + deep center zone → inside (append)
 * - Hovering the moving node itself → before/after among its siblings (so the marker stays visible)
 * - Empty canvas → inside root when valid
 */
export function resolveLiveDesignerDropTarget(
  document: DesignerDocument,
  source: LiveDesignerDragSource,
  hitNodeId: string | null,
  pointerY: number,
  hitRect: LiveDesignerOutlineRect | null,
): LiveDesignerDropTarget | null {
  if (source.kind === 'node' && (!source.nodeId || source.nodeId === document.rootNodeId)) {
    return null;
  }

  if (source.kind === 'palette' && !source.itemId) {
    return null;
  }

  if (!hitNodeId) {
    const root = getNode(document, document.rootNodeId);
    return root ? resolveInsideDrop(document, source, root) : null;
  }

  const hitNode = getNode(document, hitNodeId);
  if (!hitNode) {
    return null;
  }

  if (source.kind === 'node') {
    if (hitNodeId === source.nodeId) {
      return resolveSiblingDrop(document, source, hitNode, pointerY, hitRect);
    }

    if (isDescendantNode(document.nodes, hitNodeId, source.nodeId)) {
      return null;
    }
  }

  const preferInside = Boolean(
    hitRect
    && isContainerNode(hitNode)
    && hitRect.height > 24
    && pointerY >= hitRect.top + hitRect.height * 0.28
    && pointerY <= hitRect.top + hitRect.height * 0.72,
  );

  if (preferInside || hitNodeId === document.rootNodeId) {
    return resolveInsideDrop(document, source, hitNode);
  }

  return resolveSiblingDrop(document, source, hitNode, pointerY, hitRect);
}

export function measureLiveDesignerDropIndicator(
  placement: LiveDesignerDropPlacement,
  anchorRect: LiveDesignerOutlineRect,
): LiveDesignerDropIndicator {
  if (placement === 'inside') {
    return {
      kind: 'container',
      top: anchorRect.top,
      left: anchorRect.left,
      width: anchorRect.width,
      height: anchorRect.height,
    };
  }

  const y = placement === 'before'
    ? anchorRect.top
    : anchorRect.top + anchorRect.height;

  return {
    kind: 'line',
    top: y - 2,
    left: anchorRect.left,
    width: anchorRect.width,
    height: 4,
  };
}

export function measureLiveDesignerInvalidIndicator(
  hitRect: LiveDesignerOutlineRect,
): LiveDesignerDropIndicator {
  return {
    kind: 'invalid',
    top: hitRect.top,
    left: hitRect.left,
    width: hitRect.width,
    height: hitRect.height,
  };
}

export function liveDesignerDropTargetsEqual(
  left: LiveDesignerDropTarget | null,
  right: LiveDesignerDropTarget | null,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.parentId === right.parentId
    && left.index === right.index
    && left.placement === right.placement
    && left.anchorNodeId === right.anchorNodeId;
}
