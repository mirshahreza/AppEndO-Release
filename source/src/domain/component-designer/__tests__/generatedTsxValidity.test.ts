import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { describe, expect, it } from 'vitest';
import {
  DESIGNER_PALETTE,
  getDesignerPaletteCatalog,
  resetDesignerPaletteCatalog,
  setDesignerPaletteCatalog,
} from '../catalog';
import {
  assertNoDesignerInternalPropsInEmittedTsx,
  documentLostContentComparedTo,
  generateDesignerTsx,
  syncCodeToCanvas,
} from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import { buildPlatformNavigationPaletteItems } from '../navigationComponentPalette';
import { buildSlotPaletteItems } from '../slotPalette';
import { CORE_SLOT_CATALOG } from '../../../shared/api/contracts/slots/catalog';
import { serializeLayoutGridColumnWidths } from '../layoutGridColumnWidths';
import { LAYOUT_GRID_2_PALETTE_ITEM_ID } from '../layoutGridSlots';
import {
  createEventBindingDefinition,
  createPropertyBindingDefinition,
  createDynamicActionsEventBindingDefinition,
  eventBindingKeyForEvent,
  propertyBindingKeyForProp,
} from '../bindingEngine';
import {
  createDynamicAction,
  defaultSetValueStorePathForNode,
} from '../bindingDynamicActionsEngine';
import type { DesignerState } from '../types';

const insert = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChild = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const stateForPaletteItem = (itemId: string): DesignerState => {
  // List items must live inside a list container.
  if (itemId === 'html.list-item') {
    let state = insert(createInitialDesignerState(), 'html.list');
    return insert(state, itemId, lastChild(state));
  }
  return insert(createInitialDesignerState(), itemId);
};

const bindingScenarios: Array<{ name: string; build: () => DesignerState }> = [
  {
    name: 'property binding + debounced onChange mutation with query invalidation',
    build: () => {
      let state = insert(createInitialDesignerState(), 'heroui.input-text');
      const inputId = lastChild(state);
      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId: inputId,
        bindingKey: propertyBindingKeyForProp('placeholder'),
        definition: createPropertyBindingDefinition('placeholder', 'user.email', { fetchEndpoint: '/api/v1/user/profile' }),
      });
      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId: inputId,
        bindingKey: eventBindingKeyForEvent('onChange'),
        definition: createEventBindingDefinition('onChange', '/api/v1/user/update', 'PATCH', undefined, {
          invalidateQueries: ['/api/v1/user/profile'],
          debounceMs: 400,
        }),
      });
      return state;
    },
  },
  {
    name: 'form submit mutation with submit button',
    build: () => {
      let state = insert(createInitialDesignerState(), 'html.form');
      const formId = lastChild(state);
      state = insert(state, 'heroui.button-solid', formId);
      const buttonId = lastChild(state, formId);
      state = designerReducer(state, { type: 'set-node-prop', nodeId: buttonId, key: 'type', value: 'submit' });
      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId: formId,
        bindingKey: eventBindingKeyForEvent('onSubmit'),
        definition: createEventBindingDefinition('onSubmit', '/api/v1/user/update', 'PUT'),
      });
      return state;
    },
  },
  {
    name: 'dynamic actions: refresh + setValue + showHide',
    build: () => {
      let state = insert(createInitialDesignerState(), 'heroui.button-solid');
      const buttonId = lastChild(state);
      state = insert(state, 'layout.stack');
      const panelId = lastChild(state);
      state = designerReducer(state, {
        type: 'set-data-source',
        dataSourceId: 'users',
        dataSource: { id: 'users', name: 'Users', endpoint: '/api/users', fields: ['ID', 'NAME'] },
      });
      const refreshAction = createDynamicAction('refreshDataSource');
      refreshAction.dataSourceRef = 'users';
      const setValueAction = createDynamicAction('setValue');
      setValueAction.targetNodeId = buttonId;
      setValueAction.storePath = defaultSetValueStorePathForNode(buttonId);
      setValueAction.staticValue = 'clicked';
      const showHideAction = createDynamicAction('showHide');
      showHideAction.targetNodeId = panelId;
      showHideAction.showHideEffect = 'show';
      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId: buttonId,
        bindingKey: eventBindingKeyForEvent('onClick'),
        definition: createDynamicActionsEventBindingDefinition('onClick', [refreshAction, setValueAction, showHideAction]),
      });
      return state;
    },
  },
  {
    // T1-7 close-out — heroui.tags-input's exported add/remove interaction declares
    // per-node useState + callbacks in the component preamble (tsxParityPalette.ts
    // renderTagsInputStatePreambleLines); this exercises esbuild syntax validity for that
    // codegen path together with a bound onChange Dynamic Action (the callbacks must notify
    // the generated handler), which this file's node environment can safely esbuild-transform
    // (unlike tagsInputInteraction.test.tsx's jsdom environment).
    // Show/hide target is a plain html.container, not heroui.modal — kept that way here
    // since this case is specifically about tags-input's own preamble codegen, not
    // Modal/Drawer's. (The Modal/Drawer `isOpen={store.${visibilityPath}...}` bug this
    // comment used to flag — hyphenated node ids breaking dot notation, plus referencing
    // an undeclared `store` instead of the real `designerStore` preamble variable — was
    // found to be the actual root cause of what had been misdiagnosed as esbuild-service
    // test flakiness, and is now fixed; see modalDrawerVisibilityStorePathHyphenBug.test.ts.)
    name: 'tags-input with a bound onChange Dynamic Action',
    build: () => {
      let state = insert(createInitialDesignerState(), 'heroui.tags-input');
      const tagsId = lastChild(state);
      state = designerReducer(state, { type: 'set-node-prop', nodeId: tagsId, key: 'value', value: 'alpha,beta' });

      state = insert(state, 'html.container');
      const containerId = lastChild(state);
      const showAction = createDynamicAction('showHide');
      showAction.targetNodeId = containerId;
      showAction.showHideEffect = 'show';
      state = designerReducer(state, {
        type: 'set-node-binding',
        nodeId: tagsId,
        bindingKey: eventBindingKeyForEvent('onChange'),
        definition: createDynamicActionsEventBindingDefinition('onChange', [showAction]),
      });
      return state;
    },
  },
  {
    name: 'text props containing quotes and backslashes',
    build: () => {
      let state = insert(createInitialDesignerState(), 'html.text');
      const textId = lastChild(state);
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId: textId,
        key: 'title',
        value: 'He said "hello" \\ goodbye',
      });
      return state;
    },
  },
];

const expectValidTsx = (label: string, tsx: string): void => {
  assertValidTsxSyntax(label, tsx);
};

describe('generated TSX validity', () => {
  it('produces syntactically valid TSX for every palette item', async () => {
    for (const item of DESIGNER_PALETTE) {
      const state = stateForPaletteItem(item.id);
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('export const GeneratedComponent');
      await expectValidTsx(`palette:${item.id}`, tsx);
    }
  });

  it('round-trips every palette item through TSX codegen -> reverse parse without losing nodes', () => {
    // Regression coverage: a codegen output shape the reverse parser (jsxReverseParser.ts)
    // doesn't fully understand can "successfully" parse into a sparser document, which
    // production code must never trust silently (see draftTsxHydration.ts's content-loss
    // guard). This proves the round trip is lossless for every palette item, not just the
    // fixtures other tests happen to exercise.
    const failures: string[] = [];

    for (const item of DESIGNER_PALETTE) {
      const state = stateForPaletteItem(item.id);
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      const syncResult = syncCodeToCanvas({
        format: 'tsx',
        code: tsx,
        currentDocument: state.document,
        currentBindingDefinitions: state.bindingDefinitions,
      });

      if (syncResult.ok !== true) {
        failures.push(`${item.id}: reverse parse failed — ${syncResult.diagnostics.map((d) => d.message).join('; ')}`);
        continue;
      }

      if (documentLostContentComparedTo(state.document, syncResult.document)) {
        failures.push(
          `${item.id}: reverse-parsed document has fewer nodes than the original `
          + `(${Object.keys(syncResult.document.nodes).length} vs ${Object.keys(state.document.nodes).length})`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it('produces syntactically valid TSX for representative binding scenarios', async () => {
    for (const scenario of bindingScenarios) {
      const state = scenario.build();
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      await expectValidTsx(scenario.name, tsx);
    }
  });

  it('round-trips representative binding scenarios through TSX codegen -> reverse parse without losing nodes', () => {
    const failures: string[] = [];

    for (const scenario of bindingScenarios) {
      const state = scenario.build();
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      const syncResult = syncCodeToCanvas({
        format: 'tsx',
        code: tsx,
        currentDocument: state.document,
        currentBindingDefinitions: state.bindingDefinitions,
      });

      if (syncResult.ok !== true) {
        failures.push(`${scenario.name}: reverse parse failed — ${syncResult.diagnostics.map((d) => d.message).join('; ')}`);
        continue;
      }

      if (documentLostContentComparedTo(state.document, syncResult.document)) {
        failures.push(
          `${scenario.name}: reverse-parsed document has fewer nodes than the original `
          + `(${Object.keys(syncResult.document.nodes).length} vs ${Object.keys(state.document.nodes).length})`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps the phase-c parity controls on explicit export paths', async () => {
    let state = createInitialDesignerState();
    for (const itemId of ['heroui.toolbar', 'heroui.typography-lead', 'heroui.field-container']) {
      state = insert(state, itemId);
    }

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await expectValidTsx('phase-c parity controls', tsx);
    expect(tsx).toContain('<Toolbar');
    expect(tsx).toContain('Lead text for sections and summaries.');
    expect(tsx).toContain('<fieldset');
  });

  it('emits custom layout grid column widths as gridTemplateColumns style', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_2_PALETTE_ITEM_ID,
      parentId: state.document.rootNodeId,
    });
    const gridId = state.document.nodes[state.document.rootNodeId].children[0];
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: gridId,
      key: 'layoutGridColumnWidths',
      value: serializeLayoutGridColumnWidths([
        { value: '20', unit: '%' },
        { value: '70', unit: '%' },
      ]),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await expectValidTsx('layout grid 20/70', tsx);
    expect(tsx).toContain("gridTemplateColumns: '20% 70%'");
    expect(tsx).not.toContain('layoutGridColumnWidths');
  });

  it('keeps equal-column grids on grid-cols-N without custom template style', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: LAYOUT_GRID_2_PALETTE_ITEM_ID,
      parentId: state.document.rootNodeId,
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    await expectValidTsx('equal layout grid', tsx);
    expect(tsx).toContain('grid-cols-2');
    expect(tsx).not.toContain('gridTemplateColumns');
  });

  it('never emits designer-internal _designer props in generated TSX', async () => {
    for (const item of DESIGNER_PALETTE) {
      const state = stateForPaletteItem(item.id);
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(() => assertNoDesignerInternalPropsInEmittedTsx(tsx)).not.toThrow();
    }
  });

  it('produces syntactically valid TSX for dynamic platform-nav / platform-slot palette items', async () => {
    // Bug found (cluster F — viz/dynamic-palette audit): platform.nav.* and platform.slot.*
    // nodes were previously exported as a bare `<div componentKey="..." />` / `<div
    // slotId="..." />` — syntactically valid but functionally inert. Now exported as the real
    // PlatformNavigationHost / DesignerSlotPreview components (tsxPlatformPalette.ts). This
    // confirms the fix also keeps producing syntactically valid TSX across the full dynamic
    // catalog, not just the fixtures exercised in dynamicPaletteItems.t1-32.test.tsx.
    const dynamicItems = [
      ...buildPlatformNavigationPaletteItems(),
      ...buildSlotPaletteItems(CORE_SLOT_CATALOG),
    ];
    setDesignerPaletteCatalog([...getDesignerPaletteCatalog(), ...dynamicItems]);
    try {
      for (const item of dynamicItems) {
        const state = insert(createInitialDesignerState(), item.id);
        const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
        await expectValidTsx(`dynamic-palette:${item.id}`, tsx);
      }
    } finally {
      resetDesignerPaletteCatalog();
    }
  });

  it('round-trips dynamic platform-nav / platform-slot items through TSX codegen -> reverse parse without losing nodes', () => {
    const dynamicItems = [
      ...buildPlatformNavigationPaletteItems(),
      ...buildSlotPaletteItems(CORE_SLOT_CATALOG),
    ];
    setDesignerPaletteCatalog([...getDesignerPaletteCatalog(), ...dynamicItems]);
    const failures: string[] = [];
    try {
      for (const item of dynamicItems) {
        const state = insert(createInitialDesignerState(), item.id);
        const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
        const syncResult = syncCodeToCanvas({
          format: 'tsx',
          code: tsx,
          currentDocument: state.document,
          currentBindingDefinitions: state.bindingDefinitions,
        });

        if (syncResult.ok !== true) {
          failures.push(`${item.id}: reverse parse failed — ${syncResult.diagnostics.map((d) => d.message).join('; ')}`);
          continue;
        }

        if (documentLostContentComparedTo(state.document, syncResult.document)) {
          failures.push(
            `${item.id}: reverse-parsed document has fewer nodes than the original `
            + `(${Object.keys(syncResult.document.nodes).length} vs ${Object.keys(state.document.nodes).length})`,
          );
        }
      }
    } finally {
      resetDesignerPaletteCatalog();
    }

    expect(failures).toEqual([]);
  });

  it('round-trips a realistic composite document (nested containers, form, list, tabs) through TSX codegen -> reverse parse without losing nodes', () => {
    let state = createInitialDesignerState();
    state = insert(state, 'html.container');
    const rootContainerId = lastChild(state);

    state = insert(state, 'html.text', rootContainerId);
    state = insert(state, 'heroui.button-solid', rootContainerId);

    state = insert(state, 'html.form', rootContainerId);
    const formId = lastChild(state, rootContainerId);
    state = insert(state, 'heroui.input-text', formId);
    state = insert(state, 'heroui.button-solid', formId);

    state = insert(state, 'html.list', rootContainerId);
    const listId = lastChild(state, rootContainerId);
    state = insert(state, 'html.list-item', listId);
    state = insert(state, 'html.list-item', listId);

    state = insert(state, 'layout.stack', rootContainerId);
    const stackId = lastChild(state, rootContainerId);
    state = insert(state, 'html.text', stackId);
    state = insert(state, 'html.text', stackId);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const syncResult = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(syncResult.ok).toBe(true);
    if (syncResult.ok) {
      expect(documentLostContentComparedTo(state.document, syncResult.document)).toBe(false);
      expect(Object.keys(syncResult.document.nodes).length).toBe(Object.keys(state.document.nodes).length);
    }
  });
});
