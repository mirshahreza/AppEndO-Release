// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../../domain/component-designer/state';
import { useLiveDesignerOutline } from '../useLiveDesignerOutline';

function buildDocument() {
  let state = createInitialDesignerState('outline-hook');
  const rootId = state.document.rootNodeId;
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.container',
    parentId: rootId,
  });
  const containerId = state.document.nodes[rootId]!.children[0]!;
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: 'html.text',
    parentId: containerId,
  });
  return {
    document: state.document,
    bindingDefinitions: state.bindingDefinitions,
    rootId,
    containerId,
  };
}

describe('useLiveDesignerOutline', () => {
  it('builds expandable outline rows from the document tree', () => {
    const { document, bindingDefinitions, rootId, containerId } = buildDocument();
    const { result } = renderHook(() => useLiveDesignerOutline(document, bindingDefinitions));

    expect(result.current.rows[0]?.id).toBe(rootId);
    expect(result.current.rows.some((row) => row.id === containerId)).toBe(true);
    expect(result.current.rows.length).toBeGreaterThanOrEqual(3);

    act(() => {
      result.current.toggleCollapsed(containerId);
    });

    expect(result.current.rows.map((row) => row.id)).toEqual([rootId, containerId]);
  });
});
