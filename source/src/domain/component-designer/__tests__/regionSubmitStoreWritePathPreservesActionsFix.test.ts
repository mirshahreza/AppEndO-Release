/**
 * Bug found (parity audit item 34): editing "Store Write Path" in the Inspector called
 * `commitRegionSubmit` which rebuilt the binding via `createRegionSubmitEventBindingDefinition()`
 * with no second argument — wiping wizard-generated trueActions/invalidateQueries silently.
 * Fixed in InspectorEventBindingPanel.tsx: spread the current definition and only override
 * storeWritePath.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInitialDesignerState, designerReducer } from '../state';
import { createDynamicAction } from '../bindingDynamicActionsEngine';
import { createRegionSubmitEventBindingDefinition } from '../bindingRegionEngine';
import type { DesignerBindingDefinition, DesignerState } from '../types';

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

/**
 * Mirrors the fixed `commitRegionSubmit` merge so the regression is locked even if the panel
 * component is hard to mount in isolation.
 */
const commitRegionSubmitPreservingActions = (
  currentDefinition: DesignerBindingDefinition,
  targetEvent: string,
  nextStoreWritePath: string,
): DesignerBindingDefinition => {
  const trimmedStoreWritePath = nextStoreWritePath.trim();
  return {
    ...currentDefinition,
    sourceType: currentDefinition.sourceType ?? 'apiRef',
    bindingRole: 'event',
    targetEvent,
    regionSubmit: true,
    storeWritePath: trimmedStoreWritePath.length > 0 ? trimmedStoreWritePath : undefined,
  };
};

describe('regionSubmit Store Write Path preserves success chain (item 34)', () => {
  it('keeps trueActions and invalidateQueries when only storeWritePath changes', () => {
    let state = createInitialDesignerState();
    state = insert(state, 'heroui.button-solid');
    const buttonNodeId = lastChild(state);

    const refreshAction = createDynamicAction('refreshDataSource');
    refreshAction.dataSourceRef = 'orders';
    const toastAction = createDynamicAction('showToast');
    toastAction.toastTitle = 'Saved successfully';
    toastAction.toastVariant = 'success';

    const original = createRegionSubmitEventBindingDefinition('onClick', {
      trueActions: [refreshAction, toastAction],
      invalidateQueries: ['region:orders'],
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonNodeId,
      bindingKey: 'event:onClick',
      definition: original,
    });

    const current = state.document.nodes[buttonNodeId]!.binding['event:onClick']!;
    const next = commitRegionSubmitPreservingActions(current, 'onClick', 'ui.formSaved');

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonNodeId,
      bindingKey: 'event:onClick',
      definition: next,
    });

    const saved = state.document.nodes[buttonNodeId]!.binding['event:onClick']!;
    expect(saved.storeWritePath).toBe('ui.formSaved');
    expect(saved.trueActions).toHaveLength(2);
    expect(saved.trueActions?.map((action) => action.type)).toEqual(['refreshDataSource', 'showToast']);
    expect(saved.invalidateQueries).toEqual(['region:orders']);
    expect(saved.regionSubmit).toBe(true);
  });

  it('legacy recreate-from-scratch path would wipe the chain (documents the bug)', () => {
    const refreshAction = createDynamicAction('refreshDataSource');
    refreshAction.dataSourceRef = 'orders';
    const withChain = createRegionSubmitEventBindingDefinition('onClick', {
      trueActions: [refreshAction],
      invalidateQueries: ['region:orders'],
    });

    const broken = {
      ...createRegionSubmitEventBindingDefinition('onClick'),
      storeWritePath: 'ui.formSaved',
    };

    expect(withChain.trueActions).toHaveLength(1);
    expect(broken.trueActions).toBeUndefined();
    expect(broken.invalidateQueries).toBeUndefined();
  });

  it('InspectorEventBindingPanel commitRegionSubmit spreads currentDefinition', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../features/component-designer/components/InspectorEventBindingPanel.tsx'),
      'utf8',
    );
    expect(source).toContain('...currentDefinition');
    expect(source).toContain('parity audit item 34');
    expect(source).not.toMatch(
      /commitRegionSubmit[\s\S]{0,400}\.\.\.createRegionSubmitEventBindingDefinition\(targetEvent\)/,
    );
  });
});
