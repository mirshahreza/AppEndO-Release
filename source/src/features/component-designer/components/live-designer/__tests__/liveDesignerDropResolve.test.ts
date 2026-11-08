import { describe, expect, it } from 'vitest';
import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../../domain/component-designer/state';
import {
  canLiveDesignerDropOnParent,
  canLiveDesignerMoveNode,
  isLiveDesignerNoOpMove,
  resolveLiveDesignerDropTarget,
} from '../liveDesignerDropResolve';

function buildDoc() {
  let state = createInitialDesignerState('drop-resolve');
  const rootId = state.document.rootNodeId;
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.container',
    parentId: rootId,
  });
  const containerId = state.document.nodes[rootId].children[0]!;
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.text',
    parentId: containerId,
  });
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.text',
    parentId: containerId,
  });
  const [firstText, secondText] = state.document.nodes[containerId].children;
  return {
    document: state.document,
    rootId,
    containerId,
    firstText: firstText!,
    secondText: secondText!,
  };
}

function nodeSource(nodeId: string) {
  return { kind: 'node' as const, nodeId };
}

describe('liveDesignerDropResolve', () => {
  it('resolves before/after sibling drop by pointer Y', () => {
    const { document, containerId, firstText, secondText } = buildDoc();
    const rect = { top: 100, left: 0, width: 200, height: 40 };

    const before = resolveLiveDesignerDropTarget(
      document,
      nodeSource(secondText),
      firstText,
      110,
      rect,
    );
    expect(before).toEqual({
      parentId: containerId,
      index: 0,
      placement: 'before',
      anchorNodeId: firstText,
    });

    const after = resolveLiveDesignerDropTarget(
      document,
      nodeSource(secondText),
      firstText,
      130,
      rect,
    );
    expect(after).toEqual({
      parentId: containerId,
      index: 1,
      placement: 'after',
      anchorNodeId: firstText,
    });
  });

  it('resolves inside drop on container center', () => {
    const { document, containerId, firstText } = buildDoc();
    const rect = { top: 0, left: 0, width: 240, height: 200 };

    const inside = resolveLiveDesignerDropTarget(
      document,
      nodeSource(firstText),
      containerId,
      100,
      rect,
    );
    expect(inside?.placement).toBe('inside');
    expect(inside?.parentId).toBe(containerId);
  });

  it('keeps a sibling marker when the pointer stays on the moving node', () => {
    const { document, containerId, firstText } = buildDoc();
    const rect = { top: 80, left: 0, width: 200, height: 40 };

    const beforeSelf = resolveLiveDesignerDropTarget(
      document,
      nodeSource(firstText),
      firstText,
      85,
      rect,
    );
    expect(beforeSelf).toEqual({
      parentId: containerId,
      index: 0,
      placement: 'before',
      anchorNodeId: firstText,
    });
    expect(isLiveDesignerNoOpMove(document, firstText, beforeSelf!.parentId, beforeSelf!.index)).toBe(true);

    const afterSelf = resolveLiveDesignerDropTarget(
      document,
      nodeSource(firstText),
      firstText,
      110,
      rect,
    );
    expect(afterSelf?.placement).toBe('after');
    expect(isLiveDesignerNoOpMove(document, firstText, afterSelf!.parentId, afterSelf!.index)).toBe(true);
  });

  it('falls back to the root when the pointer is over empty canvas', () => {
    const { document, rootId, firstText } = buildDoc();
    const insideRoot = resolveLiveDesignerDropTarget(
      document,
      nodeSource(firstText),
      null,
      0,
      null,
    );
    expect(insideRoot).toEqual({
      parentId: rootId,
      index: document.nodes[rootId].children.length,
      placement: 'inside',
      anchorNodeId: rootId,
    });
  });

  it('resolves a palette insert onto a container', () => {
    const { document, containerId } = buildDoc();
    const rect = { top: 0, left: 0, width: 240, height: 200 };
    const drop = resolveLiveDesignerDropTarget(
      document,
      { kind: 'palette', itemId: 'html.text' },
      containerId,
      100,
      rect,
    );
    expect(drop?.placement).toBe('inside');
    expect(drop?.parentId).toBe(containerId);
    expect(canLiveDesignerDropOnParent(
      document,
      { kind: 'palette', itemId: 'html.text' },
      containerId,
    )).toBe(true);
  });

  it('rejects moving into a descendant', () => {
    const { document, containerId, firstText } = buildDoc();
    expect(canLiveDesignerMoveNode(document, containerId, firstText)).toBe(false);
    expect(canLiveDesignerMoveNode(document, firstText, firstText)).toBe(false);
    expect(resolveLiveDesignerDropTarget(
      document,
      nodeSource(containerId),
      firstText,
      0,
      { top: 0, left: 0, width: 120, height: 20 },
    )).toBeNull();
  });
});
