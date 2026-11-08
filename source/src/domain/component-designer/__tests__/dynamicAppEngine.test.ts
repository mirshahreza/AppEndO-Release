import { describe, expect, it } from 'vitest';
import { createInitialDesignerState } from '../state';
import { generateDesignerTsx } from '../codegen';
import { syncCodeToCanvas } from '../codegen';
import { propertyBindingKeyForProp } from '../bindingEngine';
import { createPropertyBindingDefinition } from '../bindingEngine';
import { createStoreReadBindingDefinition, storeBindingKeyForPath } from '../bindingStoreEngine';
import { eventBindingKeyForEvent } from '../bindingEngine';
import { compileDesignerConditionExpression, documentUsesVisibilityConditions, evaluateDesignerCondition } from '../visibilityConditionEngine';
import {
  LOGIC_REPEATER_PALETTE_ITEM_ID,
  resolveRepeaterArrayExpression,
  resolveItemScopedPathExpression,
} from '../repeaterEngine';
import { extractScopedBindingPathFromExpression } from '../bindingExpressionParser';
import ts from 'typescript';

describe('dynamic app engine', () => {
  it('compiles store and data visibility expressions', () => {
    expect(compileDesignerConditionExpression("store.user.role === 'admin'"))
      .toContain('designerStore?.user?.role');
    expect(compileDesignerConditionExpression('data.products.length > 0'))
      .toContain('dataContext?.products?.length');
    expect(compileDesignerConditionExpression('store.ui.visibility.heroui-modal-1 === true'))
      .toContain('["heroui-modal-1"]');
  });

  it('evaluates visibility for hyphenated store paths', () => {
    const store = {
      ui: {
        visibility: {
          'heroui-modal-1': true,
        },
      },
    };

    expect(evaluateDesignerCondition(
      store,
      null,
      {},
      'store.ui.visibility.heroui-modal-1 === true',
    )).toBe(true);
  });

  it('detects visibility conditions on nodes', () => {
    const state = createInitialDesignerState();
    state.document.nodes['child'] = {
      id: 'child',
      type: 'text',
      parentId: state.document.rootNodeId,
      order: 0,
      props: {},
      layout: { visibleCondition: "store.user.role === 'admin'" },
      binding: {},
      children: [],
    };

    expect(documentUsesVisibilityConditions(state.document)).toBe(true);
  });

  it('generates evaluateDesignerCondition, repeater map, and store bindings in TSX', () => {
    const state = createInitialDesignerState();
    const repeaterId = 'repeater-node';
    const cardId = 'card-node';

    state.bindingDefinitions = {
      definitions: state.bindingDefinitions.definitions,
      storeSegments: {
        filters: { id: 'filters', initialValue: { countryId: null } },
      },
    };

    state.document.nodes[repeaterId] = {
      id: repeaterId,
      type: 'container',
      parentId: state.document.rootNodeId,
      order: 0,
      props: {
        _designerPaletteItemId: LOGIC_REPEATER_PALETTE_ITEM_ID,
        dataPath: 'products',
        itemAlias: 'item',
        indexAlias: 'index',
        className: 'flex flex-col gap-2',
      },
      layout: {},
      binding: {},
      children: [cardId],
    };

    const textBinding = createPropertyBindingDefinition('text', 'item.title');
    state.document.nodes[cardId] = {
      id: cardId,
      type: 'text',
      parentId: repeaterId,
      order: 0,
      props: { _designerPaletteItemId: 'html.text' },
      layout: { visibleCondition: "store.filters.countryId === 'US'" },
      binding: {
        [propertyBindingKeyForProp('text')]: textBinding,
      },
      children: [],
    };

    state.document.nodes[state.document.rootNodeId].children = [repeaterId];

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('function evaluateDesignerCondition');
    expect(tsx).toContain('function useDesignerStore');
    expect(tsx).toContain('.map((item, index) =>');
    expect(tsx).toContain('dataContext?.products');
    expect(tsx).toContain('{item?.title ??');
    expect(tsx).toContain("evaluateDesignerCondition(designerStore, dataContext");
    expect(tsx).toContain("store.filters.countryId === 'US'");
  });

  it('resolves repeater array and item scoped expressions', () => {
    expect(resolveRepeaterArrayExpression('products')).toBe('dataContext?.products ?? []');
    expect(resolveRepeaterArrayExpression('store.filters.items')).toBe('designerStore?.filters?.items ?? []');
    expect(resolveItemScopedPathExpression('item.price', { itemVar: 'item', indexVar: 'index' }))
      .toBe('item?.price');
  });

  it('parses scoped binding paths from TS expressions', () => {
    const source = 'const value = designerStore.selection.countryId;';
    const sourceFile = ts.createSourceFile('temp.ts', source, ts.ScriptTarget.Latest, true);
    const statement = sourceFile.statements[0];
    if (!ts.isVariableStatement(statement)) {
      throw new Error('Expected variable statement');
    }

    const initializer = statement.declarationList.declarations[0]?.initializer;
    expect(extractScopedBindingPathFromExpression(initializer)?.path).toBe('selection.countryId');
  });

  it('round-trips conditional and repeater JSX through reverse parser', () => {
    const state = createInitialDesignerState();
    const repeaterId = 'repeater-node';
    const headingId = 'heading-node';

    state.document.nodes[repeaterId] = {
      id: repeaterId,
      type: 'container',
      parentId: state.document.rootNodeId,
      order: 0,
      props: {
        _designerPaletteItemId: LOGIC_REPEATER_PALETTE_ITEM_ID,
        dataPath: 'products',
        itemAlias: 'item',
        indexAlias: 'index',
      },
      layout: {},
      binding: {},
      children: [headingId],
    };

    state.document.nodes[headingId] = {
      id: headingId,
      type: 'heading',
      parentId: repeaterId,
      order: 0,
      props: { _designerPaletteItemId: 'html.heading', text: 'Static' },
      layout: { visibleCondition: "store.user.role === 'admin'" },
      binding: {
        [propertyBindingKeyForProp('text')]: createPropertyBindingDefinition('text', 'item.title'),
      },
      children: [],
    };

    state.document.nodes[state.document.rootNodeId].children = [repeaterId];

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const synced = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    if (synced.ok === false) {
      throw new Error(synced.diagnostics[0]?.message ?? 'sync failed');
    }

    expect(synced.ok).toBe(true);

    const repeater = synced.document.nodes[repeaterId];
    const heading = synced.document.nodes[headingId];

    expect(repeater?.props._designerPaletteItemId).toBe(LOGIC_REPEATER_PALETTE_ITEM_ID);
    expect(repeater?.props.dataPath).toBe('products');
    expect(heading?.layout.visibleCondition).toBe("store.user.role === 'admin'");
    expect(heading?.binding[propertyBindingKeyForProp('text')]?.dataPath).toBe('item.title');
  });

  it('round-trips store read bindings from generated TSX attributes', () => {
    const state = createInitialDesignerState();
    const nodeId = 'heading-node';
    const storeRead = createStoreReadBindingDefinition('text', 'filters.countryId');

    state.document.nodes[nodeId] = {
      id: nodeId,
      type: 'heading',
      parentId: state.document.rootNodeId,
      order: 0,
      props: { _designerPaletteItemId: 'html.heading', text: 'Country' },
      layout: {},
      binding: {
        [storeRead.bindingKey]: storeRead.definition,
        [eventBindingKeyForEvent('onClick')]: {
          sourceType: 'store',
          bindingRole: 'event',
          targetEvent: 'onClick',
          storeWritePath: 'selection.countryId',
        },
      },
      children: [],
    };

    state.document.nodes[state.document.rootNodeId].children = [nodeId];
    state.bindingDefinitions.storeSegments = {
      selection: { id: 'selection', initialValue: { countryId: null } },
      filters: { id: 'filters', initialValue: { countryId: null } },
    };

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const synced = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(synced.ok, synced.ok === false ? synced.diagnostics.map((item) => item.message).join(' | ') : undefined).toBe(true);
    if (!synced.ok) {
      return;
    }

    const node = synced.document.nodes[nodeId];
    expect(node?.binding[storeBindingKeyForPath('filters.countryId')]).toBeDefined();
    expect(node?.binding[eventBindingKeyForEvent('onClick')]?.storeWritePath).toBe('selection.countryId');
  });
});
