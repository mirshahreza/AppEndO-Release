/**
 * @vitest-environment jsdom
 * Phase T1-27 — Logic category audit regression tests.
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { getPaletteItemById } from '../catalog';
import { generateDesignerTsx } from '../codegen';
import {
  buildRepeaterBindingWizardActions,
  createRepeaterListResourceBindingDefinition,
  REPEATER_LIST_RESOURCE_BINDING_KEY,
  resolveRepeaterListDataVarName,
} from '../bindingRepeaterEngine';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS } from '../paletteCapabilities';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const LOGIC_ITEM_IDS = ['logic.repeater', 'logic.visibility-container'] as const;

const API_PRODUCT_ROWS = [
  { id: 101, name: 'Alpha' },
  { id: 102, name: 'Beta' },
  { id: 103, name: 'Gamma' },
  { id: 104, name: 'Delta' },
  { id: 105, name: 'Epsilon' },
];

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

const collectInspectorFieldKeys = (state: DesignerState, nodeId: string): string[] => {
  const node = state.document.nodes[nodeId];
  return resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
};

describe('T1-27 Logic category audit', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(LOGIC_ITEM_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(LOGIC_ITEM_IDS)('exports TSX for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
  });

  it('logic.repeater uses static fallback with 3 preview rows when no API data is connected', () => {
    const state = insertItem(createInitialDesignerState(), 'logic.repeater');
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('[data-designer-repeater-preview="true"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-designer-repeater-index]')).toHaveLength(3);
  });

  it('logic.repeater renders the correct item count from a real API-shaped array in hydration data', () => {
    let state = insertItem(createInitialDesignerState(), 'logic.repeater');
    const repeaterId = lastChildId(state, state.document.rootNodeId);
    const dataVar = resolveRepeaterListDataVarName(repeaterId);

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'products',
      dataSource: {
        id: 'products',
        name: 'Products',
        endpoint: '/api/products',
        fields: ['id', 'name'],
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: repeaterId,
      bindingKey: REPEATER_LIST_RESOURCE_BINDING_KEY,
      definition: createRepeaterListResourceBindingDefinition('products'),
    });

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: repeaterId,
      key: 'dataPath',
      value: dataVar,
    });

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          hydrationData: {
            [dataVar]: API_PRODUCT_ROWS,
          },
        })}
      </>,
    );

    expect(container.querySelectorAll('[data-designer-repeater-index]')).toHaveLength(API_PRODUCT_ROWS.length);
  });

  it('logic.repeater reflects dataPath and className changes in canvas preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'logic.repeater');
    const repeaterId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: repeaterId,
      key: 'dataPath',
      value: 'orders',
    });

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: repeaterId,
      key: 'className',
      value: 'flex flex-col gap-4 border-2 border-violet-300 p-4',
    });

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          hydrationData: {
            orders: API_PRODUCT_ROWS.slice(0, 2),
          },
        })}
      </>,
    );

    expect(container.querySelector('.border-violet-300')).toBeTruthy();
    expect(container.querySelectorAll('[data-designer-repeater-index]')).toHaveLength(2);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('orders');
    expect(tsx).toContain('border-violet-300');
    expect(tsx).toContain('.map(');
  });

  it('logic.repeater wizard actions wire list resource and auto dataPath', () => {
    let state = insertItem(createInitialDesignerState(), 'logic.repeater');
    const repeaterId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[repeaterId]!;
    const dataSource = {
      id: 'catalog',
      name: 'Catalog',
      endpoint: '/api/catalog',
      fields: ['sku', 'title'],
    };

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: dataSource.id,
      dataSource,
    });

    for (const action of buildRepeaterBindingWizardActions(node, dataSource)) {
      state = designerReducer(state, action);
    }

    expect(state.document.nodes[repeaterId].binding[REPEATER_LIST_RESOURCE_BINDING_KEY]?.dataSourceRef).toBe('catalog');
    expect(state.document.nodes[repeaterId].props.dataPath).toBe(resolveRepeaterListDataVarName(repeaterId));

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('useDataFetch');
    expect(tsx).toContain(resolveRepeaterListDataVarName(repeaterId));
  });

  it('logic.repeater keeps multi-capability Layout + Data inspector surfaces', () => {
    const item = getPaletteItemById('logic.repeater');
    expect(item?.capabilities).toEqual(
      expect.arrayContaining(['container', 'repeatable', 'bindable']),
    );

    const state = insertItem(createInitialDesignerState(), 'logic.repeater');
    const repeaterId = lastChildId(state, state.document.rootNodeId);
    const keys = collectInspectorFieldKeys(state, repeaterId);

    expect(keys).toContain('twFlexDirection');
    expect(keys).toContain('twGap');
    expect(keys).toContain('dataPath');
    expect(keys).toContain('itemAlias');
  });

  it('logic.visibility-container hides unrelated container Layout fields', () => {
    const item = getPaletteItemById('logic.visibility-container');
    expect(item?.capabilities).toEqual([]);

    const state = insertItem(createInitialDesignerState(), 'logic.visibility-container');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const keys = collectInspectorFieldKeys(state, nodeId);

    expect(keys).toContain('visibleCondition');
    for (const layoutKey of INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS) {
      expect(keys).not.toContain(layoutKey);
    }
  });

  it('logic.visibility-container reflects visibleCondition in export', () => {
    let state = insertItem(createInitialDesignerState(), 'logic.visibility-container');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'visibleCondition',
      value: 'store.ui.panelOpen === true',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalVisibilityContainer');
    expect(tsx).toContain('store.ui.panelOpen === true');
  });

  it('hides its children in interactive preview when visibleCondition is false, and shows them when true (regression: DesignerUniversalVisibilityContainer previously ignored visibleCondition entirely and always rendered children)', () => {
    let state = insertItem(createInitialDesignerState(), 'logic.visibility-container');
    const containerId = lastChildId(state, state.document.rootNodeId);
    state = insertItem(state, 'html.text', containerId);
    const textId = state.document.nodes[containerId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: textId,
      key: 'text',
      value: 'Secret panel content',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: containerId,
      key: 'visibleCondition',
      value: 'store.ui.panelOpen === true',
    });

    const { container: hiddenContainer } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          designerStore: { ui: { panelOpen: false } },
        })}
      </>,
    );
    expect(hiddenContainer.textContent).not.toContain('Secret panel content');
    cleanup();

    const { container: shownContainer } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          designerStore: { ui: { panelOpen: true } },
        })}
      </>,
    );
    expect(shownContainer.textContent).toContain('Secret panel content');
  });

  it('evaluates data.-scoped conditions against real fetched data in interactive preview (regression: RuntimeRenderOptions never threaded dataContext through, so data.-scoped conditions always evaluated against null)', () => {
    let state = insertItem(createInitialDesignerState(), 'logic.visibility-container');
    const containerId = lastChildId(state, state.document.rootNodeId);
    state = insertItem(state, 'html.text', containerId);
    const textId = state.document.nodes[containerId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: textId,
      key: 'text',
      value: 'Premium content',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: containerId,
      key: 'visibleCondition',
      value: "data.plan === 'premium'",
    });

    const { container: hiddenContainer } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          hydrationData: { plan: 'basic' },
        })}
      </>,
    );
    expect(hiddenContainer.textContent).not.toContain('Premium content');
    cleanup();

    const { container: shownContainer } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          hydrationData: { plan: 'premium' },
        })}
      </>,
    );
    expect(shownContainer.textContent).toContain('Premium content');
  });
});
