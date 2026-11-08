import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer, touchDesignerDocument } from '../state';
import { validateDesignerDocument } from '../validation';

describe('component designer phase D state', () => {
  it('creates desktop viewport by default with empty canvas', () => {
    const state = createInitialDesignerState();

    expect(state.viewMode).toBe('split');
    expect(state.viewport.preset).toBe('desktop');
    expect(state.viewport.width).toBe(1280);
    expect(state.viewport.height).toBe(800);
    expect(state.document.nodes[state.document.rootNodeId].children).toHaveLength(0);
    expect(state.history.past).toHaveLength(0);
    expect(state.history.future).toHaveLength(0);
    expect(state.bindingDefinitions.definitions.defaultVisibility?.sourceType).toBe('static');
    expect(state.syncDiagnostics).toHaveLength(0);
  });

  it('stores and clears sync diagnostics without mutating history', () => {
    const initial = createInitialDesignerState();

    const withDiagnostics = designerReducer(initial, {
      type: 'set-sync-diagnostics',
      diagnostics: [
        {
          id: 'parse-json:1',
          code: 'parse-json',
          level: 'error',
          message: 'Invalid payload',
        },
      ],
    });

    expect(withDiagnostics.syncDiagnostics).toHaveLength(1);
    expect(withDiagnostics.history.past).toHaveLength(0);

    const cleared = designerReducer(withDiagnostics, { type: 'clear-sync-diagnostics' });
    expect(cleared.syncDiagnostics).toHaveLength(0);
    expect(cleared.history.past).toHaveLength(0);
  });

  it('replaces document from code sync and keeps valid selection fallback', () => {
    const initial = createInitialDesignerState();

    const nextDocument = structuredClone(initial.document);
    nextDocument.nodes['container-1'] = {
      id: 'container-1',
      type: 'container',
      parentId: nextDocument.rootNodeId,
      order: 0,
      props: { className: 'p-4' },
      layout: {},
      binding: {},
      children: [],
    };
    nextDocument.nodes[nextDocument.rootNodeId] = {
      ...nextDocument.nodes[nextDocument.rootNodeId],
      children: ['container-1'],
    };

    const replaced = designerReducer(initial, {
      type: 'replace-document-from-code',
      document: nextDocument,
      bindingDefinitions: {
        definitions: {
          apiData: {
            sourceType: 'apiRef',
            endpointRef: 'customer.list',
          },
        },
        storeSegments: {},
      },
      preferredSelectedNodeId: 'unknown-node',
    });

    expect(replaced.document.nodes[replaced.document.rootNodeId].children).toEqual(['container-1']);
    expect(replaced.selectedNodeId).toBe(replaced.document.rootNodeId);
    expect(replaced.bindingDefinitions.definitions.apiData?.endpointRef).toBe('customer.list');
    expect(replaced.history.past.length).toBeGreaterThan(0);
  });

  it('updates selection and view mode', () => {
    const initial = createInitialDesignerState();

    const selected = designerReducer(initial, { type: 'select-node', nodeId: 'root' });
    const modeChanged = designerReducer(selected, { type: 'set-view-mode', viewMode: 'design' });

    expect(selected.selectedNodeId).toBe('root');
    expect(modeChanged.viewMode).toBe('design');
  });

  it('does not replace state when hover target is unchanged', () => {
    const initial = createInitialDesignerState();
    const hovered = designerReducer(initial, { type: 'hover-node', nodeId: 'root' });
    const again = designerReducer(hovered, { type: 'hover-node', nodeId: 'root' });

    expect(hovered.hoveredNodeId).toBe('root');
    expect(again).toBe(hovered);
  });

  it('changes viewport size and keeps minimum bounds', () => {
    const initial = createInitialDesignerState();

    const resized = designerReducer(initial, { type: 'resize-canvas', width: 120, height: 100 });

    expect(resized.viewport.preset).toBe('custom');
    expect(resized.viewport.width).toBe(240);
    expect(resized.viewport.height).toBe(240);
  });

  it('supports preset switching and fill modes', () => {
    const initial = createInitialDesignerState();

    const mobile = designerReducer(initial, { type: 'set-viewport-preset', preset: 'mobile' });
    const fill = designerReducer(mobile, { type: 'set-fill-mode', fillMode: 'fill-both' });

    expect(mobile.viewport.width).toBe(390);
    expect(mobile.viewport.height).toBe(844);
    expect(fill.viewport.fillMode).toBe('fill-both');
  });

  it('restores viewport when hydrating a document', () => {
    const initial = createInitialDesignerState('component-a');
    const customized = designerReducer(initial, { type: 'resize-canvas', width: 960, height: 720 });

    const hydrated = designerReducer(customized, {
      type: 'hydrate-document',
      document: {
        ...customized.document,
        id: 'component-b',
        name: 'component-b',
      },
      bindingDefinitions: customized.bindingDefinitions,
      viewport: {
        preset: 'tablet',
        width: 834,
        height: 1112,
        fillMode: 'manual',
      },
    });

    expect(hydrated.document.id).toBe('component-b');
    expect(hydrated.viewport).toEqual({
      preset: 'tablet',
      width: 834,
      height: 1112,
      fillMode: 'manual',
    });
  });

  it('resets viewport when requested during hydrate', () => {
    const initial = createInitialDesignerState();
    const customized = designerReducer(initial, { type: 'resize-canvas', width: 960, height: 720 });

    const hydrated = designerReducer(customized, {
      type: 'hydrate-document',
      document: customized.document,
      bindingDefinitions: customized.bindingDefinitions,
      resetViewport: true,
    });

    expect(hydrated.viewport.preset).toBe('desktop');
    expect(hydrated.viewport.width).toBe(1280);
    expect(hydrated.viewport.height).toBe(800);
  });

  it('restores viewport through restore-viewport action', () => {
    const initial = createInitialDesignerState();

    const restored = designerReducer(initial, {
      type: 'restore-viewport',
      viewport: {
        preset: 'custom',
        width: 640,
        height: 480,
        fillMode: 'fill-height',
      },
    });

    expect(restored.viewport).toEqual({
      preset: 'custom',
      width: 640,
      height: 480,
      fillMode: 'fill-height',
    });
  });

  it('touch helper marks document as dirty and updates metadata timestamp', () => {
    const initial = createInitialDesignerState();

    const next = touchDesignerDocument(initial);

    expect(next.isDirty).toBe(true);
    expect(new Date(next.document.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(initial.document.metadata.updatedAt).getTime(),
    );
  });

  it('inserts palette items under valid parents and selects the new node', () => {
    const initial = createInitialDesignerState();

    const next = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });

    const rootChildren = next.document.nodes[next.document.rootNodeId].children;
    expect(rootChildren).toHaveLength(1);
    expect(next.selectedNodeId).toBe(rootChildren[0]);
    expect(next.document.nodes[rootChildren[0]].type).toBe('container');
    expect(next.history.past.length).toBeGreaterThan(0);
  });

  it('rejects invalid parent insertions', () => {
    const initial = createInitialDesignerState();
    const withText = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: initial.document.rootNodeId,
    });

    const textNodeId = withText.document.nodes[withText.document.rootNodeId].children[0];
    const rejected = designerReducer(withText, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: textNodeId,
    });

    expect(rejected.document.nodes[textNodeId].children).toHaveLength(0);
    expect(rejected.document.nodes[rejected.document.rootNodeId].children).toHaveLength(1);
  });

  it('reorders nodes within the same parent', () => {
    const initial = createInitialDesignerState();
    const withSection = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const withText = designerReducer(withSection, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: withSection.document.rootNodeId,
    });

    const [sectionId, textId] = withText.document.nodes[withText.document.rootNodeId].children;
    const reordered = designerReducer(withText, {
      type: 'move-node',
      nodeId: textId,
      targetParentId: withText.document.rootNodeId,
      index: 0,
    });

    expect(reordered.document.nodes[reordered.document.rootNodeId].children).toEqual([textId, sectionId]);
    expect(reordered.document.nodes[textId].order).toBe(0);
    expect(reordered.document.nodes[sectionId].order).toBe(1);
  });

  it('reparents nodes into another valid container', () => {
    const initial = createInitialDesignerState();
    const withSection = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const sectionId = withSection.document.nodes[withSection.document.rootNodeId].children[0];
    const withCard = designerReducer(withSection, {
      type: 'insert-palette-item',
      itemId: 'html.list',
      parentId: withSection.document.rootNodeId,
    });
    const cardId = withCard.document.nodes[withCard.document.rootNodeId].children[1];
    const withText = designerReducer(withCard, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: withCard.document.rootNodeId,
    });
    const textId = withText.document.nodes[withText.document.rootNodeId].children[2];

    const moved = designerReducer(withText, {
      type: 'move-node',
      nodeId: textId,
      targetParentId: sectionId,
      index: 0,
    });

    expect(moved.document.nodes[moved.document.rootNodeId].children).toEqual([sectionId, cardId]);
    expect(moved.document.nodes[sectionId].children).toEqual([textId]);
    expect(moved.document.nodes[textId].parentId).toBe(sectionId);
  });

  it('supports undo and redo history for domain mutations', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });

    expect(inserted.document.nodes[inserted.document.rootNodeId].children).toHaveLength(1);
    expect(inserted.history.past).toHaveLength(1);

    const undone = designerReducer(inserted, { type: 'undo' });
    expect(undone.document.nodes[undone.document.rootNodeId].children).toHaveLength(0);
    expect(undone.history.future).toHaveLength(1);

    const redone = designerReducer(undone, { type: 'redo' });
    expect(redone.document.nodes[redone.document.rootNodeId].children).toHaveLength(1);
    expect(redone.history.past).toHaveLength(1);
  });

  it('removes selected node recursively and falls back selection to parent', () => {
    const initial = createInitialDesignerState();
    const withContainer = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const containerId = withContainer.document.nodes[withContainer.document.rootNodeId].children[0];

    const withTextChild = designerReducer(withContainer, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: containerId,
    });
    const textChildId = withTextChild.document.nodes[containerId].children[0];

    const selectedChild = designerReducer(withTextChild, {
      type: 'select-node',
      nodeId: textChildId,
    });

    const removedContainer = designerReducer(selectedChild, {
      type: 'remove-node',
      nodeId: containerId,
    });

    expect(removedContainer.document.nodes[containerId]).toBeUndefined();
    expect(removedContainer.document.nodes[textChildId]).toBeUndefined();
    expect(removedContainer.document.nodes[removedContainer.document.rootNodeId].children).toHaveLength(0);
    expect(removedContainer.selectedNodeId).toBe(removedContainer.document.rootNodeId);
    expect(removedContainer.history.past.length).toBeGreaterThan(selectedChild.history.past.length);
  });

  it('ignores remove-node on root', () => {
    const initial = createInitialDesignerState();
    const next = designerReducer(initial, {
      type: 'remove-node',
      nodeId: initial.document.rootNodeId,
    });

    expect(next).toBe(initial);
  });

  it('auto-wraps list-item drops in a list when parent is root or container', () => {
    const initial = createInitialDesignerState();
    const withListItem = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.list-item',
      parentId: initial.document.rootNodeId,
    });

    const rootChildren = withListItem.document.nodes[withListItem.document.rootNodeId].children;
    expect(rootChildren).toHaveLength(1);

    const listId = rootChildren[0];
    const listNode = withListItem.document.nodes[listId];
    expect(listNode.type).toBe('list');
    expect(listNode.children).toHaveLength(1);

    const listItemId = listNode.children[0];
    const listItemNode = withListItem.document.nodes[listItemId];
    expect(listItemNode.type).toBe('list-item');
    expect(listItemNode.parentId).toBe(listId);
    expect(withListItem.selectedNodeId).toBe(listItemId);
  });

  it('updates props through inspector actions and emits diagnostics for invalid values', () => {
    const initial = createInitialDesignerState();
    const withText = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: initial.document.rootNodeId,
    });

    const textNodeId = withText.document.nodes[withText.document.rootNodeId].children[0];
    const invalid = designerReducer(withText, {
      type: 'set-node-prop',
      nodeId: textNodeId,
      key: 'text',
      value: '',
    });

    expect(invalid.document.diagnostics.some((item) => item.code === 'required-prop' && item.nodeId === textNodeId)).toBe(true);

    const fixed = designerReducer(invalid, {
      type: 'set-node-prop',
      nodeId: textNodeId,
      key: 'text',
      value: 'Ready',
    });

    expect(fixed.document.diagnostics.some((item) => item.code === 'required-prop' && item.nodeId === textNodeId)).toBe(false);
  });

  it('derives tailwind utility prop keys when layout palette items are inserted', () => {
    const initial = createInitialDesignerState();
    const withFlexRow = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'layout.flex-row',
      parentId: initial.document.rootNodeId,
    });
    const flexRowId = withFlexRow.document.nodes[withFlexRow.document.rootNodeId].children[0];
    const flexRowNode = withFlexRow.document.nodes[flexRowId];

    expect(flexRowNode.props.twFlexDirection).toBe('flex-row');
    expect(flexRowNode.props.twGap).toBe('gap-3');
    expect(flexRowNode.props.twItems).toBe('items-start');
  });

  it('derives tailwind utility prop keys when className is updated from the inspector', () => {
    const initial = createInitialDesignerState();
    const withContainer = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const containerId = withContainer.document.nodes[withContainer.document.rootNodeId].children[0];

    const withClassName = designerReducer(withContainer, {
      type: 'set-node-prop',
      nodeId: containerId,
      key: 'className',
      value: 'flex flex-col gap-4 p-4',
    });

    const node = withClassName.document.nodes[containerId];
    expect(node.props.twFlexDirection).toBe('flex-col');
    expect(node.props.twGap).toBe('gap-4');
    expect(node.props.twPadding).toBe('p-4');
  });

  it('removes prop keys when inspector sets undefined', () => {
    const initial = createInitialDesignerState();
    const withText = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: initial.document.rootNodeId,
    });

    const textNodeId = withText.document.nodes[withText.document.rootNodeId].children[0];
    const cleared = designerReducer(withText, {
      type: 'set-node-prop',
      nodeId: textNodeId,
      key: 'text',
      value: undefined,
    });

    expect(Object.prototype.hasOwnProperty.call(cleared.document.nodes[textNodeId].props, 'text')).toBe(false);
  });

  it('updates global binding definitions in state', () => {
    const initial = createInitialDesignerState();
    const withDefinition = designerReducer(initial, {
      type: 'set-binding-definition',
      bindingKey: 'api.customerList',
      definition: {
        sourceType: 'apiRef',
        endpointRef: 'customers.list',
        timeoutMs: 5000,
      },
    });

    expect(withDefinition.bindingDefinitions.definitions['api.customerList']?.endpointRef).toBe('customers.list');

    const removed = designerReducer(withDefinition, {
      type: 'remove-binding-definition',
      bindingKey: 'api.customerList',
    });

    expect(removed.bindingDefinitions.definitions['api.customerList']).toBeUndefined();
  });

  it('validates root presence, parent-child rules, and orphan nodes', () => {
    const initial = createInitialDesignerState();
    const document = structuredClone(initial.document);

    document.nodes['n-text'] = {
      id: 'n-text',
      type: 'text',
      parentId: 'root',
      order: 0,
      props: { text: 'hello' },
      layout: {},
      binding: {},
      children: ['n-container'],
    };

    document.nodes['n-container'] = {
      id: 'n-container',
      type: 'container',
      parentId: 'n-text',
      order: 0,
      props: { className: 'bad relation' },
      layout: {},
      binding: {},
      children: [],
    };

    document.nodes['n-orphan'] = {
      id: 'n-orphan',
      type: 'text',
      parentId: 'missing-parent',
      order: 0,
      props: { text: 'orphan' },
      layout: {},
      binding: {},
      children: [],
    };

    document.nodes[document.rootNodeId] = {
      ...document.nodes[document.rootNodeId],
      children: ['n-text'],
    };

    const diagnostics = validateDesignerDocument(document);

    expect(diagnostics.some((item) => (item.code === 'invalid-parent-child' || item.code === 'html5-content-model') && item.nodeId === 'n-container')).toBe(true);
    expect(diagnostics.some((item) => item.code === 'orphan-node' && item.nodeId === 'n-orphan')).toBe(true);
  });

  it('syncs static list item texts in one mutation', () => {
    const initial = createInitialDesignerState();
    const withList = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.list',
      parentId: initial.document.rootNodeId,
    });
    const listNodeId = withList.selectedNodeId;
    expect(listNodeId).toBeTruthy();

    const synced = designerReducer(withList, {
      type: 'sync-list-item-texts',
      listNodeId: listNodeId!,
      texts: ['Alpha', 'Beta', 'Gamma'],
    });

    const listNode = synced.document.nodes[listNodeId!];
    expect(listNode.children).toHaveLength(3);
    const childTexts = listNode.children.map((childId) => {
      const child = synced.document.nodes[childId];
      expect(child?.type).toBe('list-item');
      return child?.props.text;
    });
    expect(childTexts).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(synced.selectedNodeId).toBe(listNodeId);
  });

  it('validates root node invariants', () => {
    const initial = createInitialDesignerState();
    const document = structuredClone(initial.document);
    delete document.nodes[document.rootNodeId];

    const diagnostics = validateDesignerDocument(document);
    expect(diagnostics.some((item) => item.code === 'root-missing')).toBe(true);
  });
});
