import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import {
  parseDesignerTabItems,
  readUiTabsAlignment,
  readUiTabsPlacement,
  readUiTabsVariant,
  readUiTabsWidth,
} from '../designerTabItems';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';

describe('parseDesignerTabItems', () => {
  it('reads catalog arrays and inspector JSON strings', () => {
    expect(parseDesignerTabItems([
      { key: 'overview', label: 'Overview' },
      { id: 'settings', label: 'Settings' },
    ])).toEqual([
      { key: 'overview', label: 'Overview' },
      { key: 'settings', label: 'Settings' },
    ]);

    expect(parseDesignerTabItems(JSON.stringify([
      { key: 'tab-0', label: 'Tab 1' },
      { key: 'tab-1', label: 'Tab 2' },
    ]))).toEqual([
      { key: 'tab-0', label: 'Tab 1' },
      { key: 'tab-1', label: 'Tab 2' },
    ]);
  });

  it('falls back to two default tabs when items are empty', () => {
    expect(parseDesignerTabItems([])).toEqual([
      { key: 'tab-0', label: 'Tab 1' },
      { key: 'tab-1', label: 'Tab 2' },
    ]);
    expect(parseDesignerTabItems('')).toEqual([
      { key: 'tab-0', label: 'Tab 1' },
      { key: 'tab-1', label: 'Tab 2' },
    ]);
  });

  it('maps UiTabs layout props', () => {
    expect(readUiTabsPlacement('end')).toBe('end');
    expect(readUiTabsPlacement('bottom')).toBe('top');
    expect(readUiTabsAlignment('center')).toBe('center');
    expect(readUiTabsWidth('equal')).toBe('equal');
    expect(readUiTabsVariant('contained')).toBe('contained');
  });
});

describe('designer tabs insert and inspector', () => {
  it('inserts two panes and exposes layout fields in Content', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.tabs',
      parentId: initial.document.rootNodeId,
    });
    const tabsId = inserted.document.nodes[inserted.document.rootNodeId].children[0]!;
    const tabs = inserted.document.nodes[tabsId]!;
    expect(tabs.children).toHaveLength(2);
    expect(tabs.props.placement).toBe('top');
    expect(tabs.props.variant).toBe('line');

    const fieldKeys = new Set(
      resolveInspectorFieldSections(tabs).flatMap((section) => section.fields.map((field) => field.key)),
    );
    expect(fieldKeys.has('items')).toBe(true);
    expect(fieldKeys.has('placement')).toBe(true);
    expect(fieldKeys.has('alignment')).toBe(true);
    expect(fieldKeys.has('width')).toBe(true);
    expect(fieldKeys.has('variant')).toBe(true);
    expect(fieldKeys.has('defaultSelectedKey')).toBe(true);

    const withPlacement = designerReducer(inserted, {
      type: 'set-node-prop',
      nodeId: tabsId,
      key: 'placement',
      value: 'start',
    });
    const withVariant = designerReducer(withPlacement, {
      type: 'set-node-prop',
      nodeId: tabsId,
      key: 'variant',
      value: 'contained',
    });
    const tsx = generateDesignerTsx(withVariant.document, withVariant.bindingDefinitions);
    expect(tsx).toContain('import { UiTabs } from \'@/shared/ui\'');
    expect(tsx).toContain('<UiTabs');
    expect(tsx).toContain('placement="start"');
    expect(tsx).toContain('variant="contained"');
  });

  it('drops content into the active pane instead of as a sibling tab', () => {
    const initial = createInitialDesignerState();
    let state = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.tabs',
      parentId: initial.document.rootNodeId,
    });
    const tabsId = state.document.nodes[state.document.rootNodeId].children[0]!;
    const [pane0Id] = state.document.nodes[tabsId].children;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: tabsId,
    });
    expect(state.document.nodes[tabsId].children).toEqual([pane0Id, state.document.nodes[tabsId].children[1]]);
    expect(state.document.nodes[pane0Id!].children).toHaveLength(1);
  });
});
