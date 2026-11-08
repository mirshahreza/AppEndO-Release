import { describe, expect, it } from 'vitest';
import { createInitialDesignerState } from '../state';
import { validateDesignerDocument } from '../validation';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';

describe('repeater validation', () => {
  it('warns when nested repeaters use duplicate item aliases', () => {
    const state = createInitialDesignerState('Repeater Test');
    const rootId = state.document.rootNodeId;
    const parentRepeaterId = 'parent-repeater';
    const childRepeaterId = 'child-repeater';

    const document = {
      ...state.document,
      nodes: {
        ...state.document.nodes,
        [rootId]: {
          ...state.document.nodes[rootId],
          children: [parentRepeaterId],
        },
        [parentRepeaterId]: {
          id: parentRepeaterId,
          type: 'component-container',
          parentId: rootId,
          order: 0,
          props: {
            [DESIGNER_PALETTE_ITEM_ID_PROP]: 'logic.repeater',
            itemAlias: 'duplicate_alias',
          },
          layout: {},
          binding: {},
          children: [childRepeaterId],
        },
        [childRepeaterId]: {
          id: childRepeaterId,
          type: 'component-container',
          parentId: parentRepeaterId,
          order: 0,
          props: {
            [DESIGNER_PALETTE_ITEM_ID_PROP]: 'logic.repeater',
            itemAlias: 'duplicate_alias',
          },
          layout: {},
          binding: {},
          children: [],
        },
      },
    };

    const diagnostics = validateDesignerDocument(document);
    const repeaterWarning = diagnostics.find(
      (item) => item.code === 'ambiguous-repeater-alias' && item.nodeId === childRepeaterId
    );

    expect(repeaterWarning).toBeDefined();
    expect(repeaterWarning?.level).toBe('warning');
    expect(repeaterWarning?.message).toContain("Ambiguous nested repeater alias 'duplicate_alias'");
  });

  it('does not warn when nested repeaters use unique item aliases', () => {
    const state = createInitialDesignerState('Repeater Test');
    const rootId = state.document.rootNodeId;
    const parentRepeaterId = 'parent-repeater';
    const childRepeaterId = 'child-repeater';

    const document = {
      ...state.document,
      nodes: {
        ...state.document.nodes,
        [rootId]: {
          ...state.document.nodes[rootId],
          children: [parentRepeaterId],
        },
        [parentRepeaterId]: {
          id: parentRepeaterId,
          type: 'component-container',
          parentId: rootId,
          order: 0,
          props: {
            [DESIGNER_PALETTE_ITEM_ID_PROP]: 'logic.repeater',
            itemAlias: 'parent_alias',
          },
          layout: {},
          binding: {},
          children: [childRepeaterId],
        },
        [childRepeaterId]: {
          id: childRepeaterId,
          type: 'component-container',
          parentId: parentRepeaterId,
          order: 0,
          props: {
            [DESIGNER_PALETTE_ITEM_ID_PROP]: 'logic.repeater',
            itemAlias: 'child_alias',
          },
          layout: {},
          binding: {},
          children: [],
        },
      },
    };

    const diagnostics = validateDesignerDocument(document);
    const repeaterWarning = diagnostics.find(
      (item) => item.code === 'ambiguous-repeater-alias'
    );

    expect(repeaterWarning).toBeUndefined();
  });
});
