/**
 * @vitest-environment jsdom
 *
 * Phase T1-6 — listbox onSelectionChange, dropdown onAction, tabs onSelectionChange,
 * and overlay showHide / store-path open-close coverage.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { generateDesignerTsx } from '../codegen';
import {
  createDynamicActionsEventBindingDefinition,
  createEventBindingDefinition,
  eventBindingKeyForEvent,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import {
  createDynamicAction,
  visibilityStorePathForNode,
} from '../bindingDynamicActionsEngine';
import { executeDynamicAction } from '../bindingDynamicActionsRuntime';
import { buildStorePathAccessExpression } from '../visibilityConditionEngine';

/**
 * HeroUI Tabs.Indicator requires SharedElementTransition (not available in jsdom preview).
 * Stub Tabs with a selection-callback shell so we can test onSelectionChange wiring.
 */
const TabsSelectionContext = React.createContext<((key: string) => void) | undefined>(undefined);

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react');
  const TabsRoot: React.FC<Record<string, unknown>> = ({
    children,
    onSelectionChange,
    className,
    style,
  }) => (
    <TabsSelectionContext.Provider
      value={(key: string) => {
        (onSelectionChange as ((key: React.Key) => void) | undefined)?.(key);
      }}
    >
      <div className={className as string | undefined} style={style as React.CSSProperties | undefined} data-designer-tabs="true">
        {children as React.ReactNode}
      </div>
    </TabsSelectionContext.Provider>
  );
  const Tab: React.FC<Record<string, unknown>> = ({ children, id }) => {
    const onSelect = React.useContext(TabsSelectionContext);
    return (
      <button type="button" role="tab" id={String(id ?? '')} onClick={() => onSelect?.(String(id ?? ''))}>
        {children as React.ReactNode}
      </button>
    );
  };

  const Tabs = Object.assign(TabsRoot, {
    ListContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    List: ({ children }: { children?: React.ReactNode }) => <div role="tablist">{children}</div>,
    Tab,
    Indicator: () => null,
    Panel: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
      <div role="tabpanel" id={id}>{children}</div>
    ),
  });

  return {
    ...actual,
    Tabs,
  };
});

describe('T1-6 listbox / dropdown / tabs event wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('exposes Interaction binding targets for listbox, dropdown, and tabs', () => {
    let state = createInitialDesignerState();
    for (const itemId of ['heroui.listbox', 'heroui.dropdown', 'heroui.tabs'] as const) {
      state = designerReducer(state, {
        type: 'insert-palette-item',
        itemId,
        parentId: state.document.rootNodeId,
      });
    }
    const [listboxId, dropdownId, tabsId] = state.document.nodes[state.document.rootNodeId].children;

    expect(resolveNodeEventBindingTargets(state.document.nodes[listboxId!])).toEqual(['onSelectionChange']);
    expect(resolveNodeEventBindingTargets(state.document.nodes[dropdownId!])).toEqual(['onAction']);
    expect(resolveNodeEventBindingTargets(state.document.nodes[tabsId!])).toEqual(['onSelectionChange']);
  });

  it('emits adapted onSelectionChange in export TSX for ListBox and Tabs', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.listbox',
      parentId: state.document.rootNodeId,
    });
    const listboxId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: listboxId,
      bindingKey: eventBindingKeyForEvent('onSelectionChange'),
      definition: createEventBindingDefinition('onSelectionChange', '/api/v1/listbox', 'POST'),
    });

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.tabs',
      parentId: state.document.rootNodeId,
    });
    const tabsId = state.document.nodes[state.document.rootNodeId].children[1]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: tabsId,
      bindingKey: eventBindingKeyForEvent('onSelectionChange'),
      definition: createEventBindingDefinition('onSelectionChange', '/api/v1/tabs', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<ListBox');
    expect(tsx).toMatch(/onSelectionChange=\{\(nextKeys\) => handleonSelectionChange_/);
    expect(tsx).toContain('nextKeys === \'all\' ? \'all\' : Array.from(nextKeys).join(\',\')');
    expect(tsx).toContain('<UiTabs');
    expect(tsx).toMatch(/onSelectionChange=\{\(nextKey\) => handleonSelectionChange_/);
    expect(tsx).toContain('defaultSelectedKey="tab-0"');
  });

  it('emits adapted onAction on Dropdown.Menu in export TSX', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.dropdown',
      parentId: state.document.rootNodeId,
    });
    const dropdownId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: dropdownId,
      bindingKey: eventBindingKeyForEvent('onAction'),
      definition: createEventBindingDefinition('onAction', '/api/v1/dropdown', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Dropdown');
    expect(tsx).toContain('<Dropdown.Menu');
    expect(tsx).toMatch(/<Dropdown\.Menu[^>]*onAction=\{\(key\) => handleonAction_/);
    expect(tsx).not.toMatch(/<Dropdown(?!\.Menu)\b[^>]*onAction=\{/);
  });

  it('selects a listbox option and writes the selected key via onSelectionChange', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.listbox',
      parentId: state.document.rootNodeId,
    });
    const listboxId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: listboxId,
      bindingKey: eventBindingKeyForEvent('onSelectionChange'),
      definition: createEventBindingDefinition('onSelectionChange', '', 'POST', undefined, {
        storeWritePath: 'selection.listbox',
      }),
    });

    const storeWrites: Array<{ path: string; value: unknown }> = [];

    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      return (
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            bindingDefinitions: state.bindingDefinitions,
            designerStore: store,
            onStoreChange: (updater) => {
              setStore((current) => {
                const next = typeof updater === 'function' ? updater(current) : updater;
                const nextValue = (next as { selection?: { listbox?: unknown } }).selection?.listbox;
                const prevValue = (current as { selection?: { listbox?: unknown } }).selection?.listbox;
                if (nextValue !== prevValue) {
                  storeWrites.push({ path: 'selection.listbox', value: nextValue });
                }
                return next;
              });
            },
          })}
        </>
      );
    };

    render(<PreviewHarness />);

    const option = screen.getByRole('option', { name: 'Option 2' });
    fireEvent.click(option);

    await vi.waitFor(() => {
      expect(storeWrites.some((entry) => entry.value === 'option-2')).toBe(true);
    });
    expect(option.getAttribute('aria-selected')).toBe('true');
  });

  it('clicks a dropdown menu item and writes the action key via onAction', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.dropdown',
      parentId: state.document.rootNodeId,
    });
    const dropdownId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: dropdownId,
      bindingKey: eventBindingKeyForEvent('onAction'),
      definition: createEventBindingDefinition('onAction', '', 'POST', undefined, {
        storeWritePath: 'selection.dropdown',
      }),
    });

    const storeWrites: Array<{ path: string; value: unknown }> = [];

    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      return (
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            bindingDefinitions: state.bindingDefinitions,
            designerStore: store,
            onStoreChange: (updater) => {
              setStore((current) => {
                const next = typeof updater === 'function' ? updater(current) : updater;
                const nextValue = (next as { selection?: { dropdown?: unknown } }).selection?.dropdown;
                const prevValue = (current as { selection?: { dropdown?: unknown } }).selection?.dropdown;
                if (nextValue !== prevValue) {
                  storeWrites.push({ path: 'selection.dropdown', value: nextValue });
                }
                return next;
              });
            },
          })}
        </>
      );
    };

    render(<PreviewHarness />);

    const menu = document.querySelector('[data-designer-dropdown-menu="true"]') as HTMLElement | null;
    expect(menu).not.toBeNull();
    fireEvent.click(within(menu!).getByRole('menuitem', { name: 'Option 3' }));

    await vi.waitFor(() => {
      expect(storeWrites.some((entry) => entry.value === 'option-3')).toBe(true);
    });
  });

  it('changes tab selection and writes the tab key via onSelectionChange', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.tabs',
      parentId: state.document.rootNodeId,
    });
    const tabsId = state.document.nodes[state.document.rootNodeId].children[0]!;
    const [pane0Id, pane1Id] = state.document.nodes[tabsId].children;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: pane0Id,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: pane1Id,
    });
    const pane0TextId = state.document.nodes[pane0Id!].children[0]!;
    const pane1TextId = state.document.nodes[pane1Id!].children[0]!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: pane0TextId,
      key: 'text',
      value: 'First panel',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: pane1TextId,
      key: 'text',
      value: 'Second panel',
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: tabsId,
      bindingKey: eventBindingKeyForEvent('onSelectionChange'),
      definition: createEventBindingDefinition('onSelectionChange', '', 'POST', undefined, {
        storeWritePath: 'selection.tab',
      }),
    });

    const storeWrites: Array<{ path: string; value: unknown }> = [];

    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      return (
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            bindingDefinitions: state.bindingDefinitions,
            designerStore: store,
            onStoreChange: (updater) => {
              setStore((current) => {
                const next = typeof updater === 'function' ? updater(current) : updater;
                const nextValue = (next as { selection?: { tab?: unknown } }).selection?.tab;
                const prevValue = (current as { selection?: { tab?: unknown } }).selection?.tab;
                if (nextValue !== prevValue) {
                  storeWrites.push({ path: 'selection.tab', value: nextValue });
                }
                return next;
              });
            },
          })}
        </>
      );
    };

    render(<PreviewHarness />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(tabs[1]!);

    await vi.waitFor(() => {
      expect(storeWrites.some((entry) => entry.value === 'tab-1')).toBe(true);
    });
  });
});

describe('T1-6 modal / alert-dialog / drawer via showHide store path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('opens and closes a modal through showHide Dynamic Action store path', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    const modalId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: modalId,
      key: 'title',
      value: 'Detail Modal',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: modalId,
      key: 'isOpen',
      value: false,
    });

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [showAction]),
    });

    const visibilityPath = visibilityStorePathForNode(modalId);
    let designerStore: Record<string, unknown> = {};

    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      designerStore = store;
      return (
        <>
          {renderDesignerDocumentPreview(state.document, {
            interactive: true,
            bindingDefinitions: state.bindingDefinitions,
            designerStore: store,
            onStoreChange: (updater) => {
              setStore((current) => (typeof updater === 'function' ? updater(current) : updater));
            },
          })}
        </>
      );
    };

    render(<PreviewHarness />);
    expect(screen.queryByText('Detail Modal')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /action/i }));

    await vi.waitFor(() => {
      expect(screen.getByText('Detail Modal')).toBeTruthy();
    });

    // Same store key Modal Backdrop onOpenChange already patches on dismiss.
    expect(visibilityPath).toBe(`ui.visibility.${modalId}`);
    await vi.waitFor(() => {
      const segments = visibilityPath.split('.');
      let cursor: unknown = designerStore;
      for (const segment of segments) {
        cursor = (cursor as Record<string, unknown> | undefined)?.[segment];
      }
      expect(cursor).toBe(true);
    });

    await executeDynamicAction(
      {
        id: 'hide',
        type: 'showHide',
        targetNodeId: modalId,
        visibilityStorePath: visibilityPath,
        showHideEffect: 'hide',
      },
      {
        designerStore,
        patchStore: (path, value) => {
          const segments = path.split('.').filter(Boolean);
          const next = structuredClone(designerStore);
          let cursor: Record<string, unknown> = next;
          for (let index = 0; index < segments.length - 1; index += 1) {
            const segment = segments[index]!;
            const existing = cursor[segment];
            if (!existing || typeof existing !== 'object') {
              cursor[segment] = {};
            }
            cursor = cursor[segment] as Record<string, unknown>;
          }
          cursor[segments[segments.length - 1]!] = value;
          designerStore = next;
        },
      },
    );

    expect(
      (designerStore as { ui?: { visibility?: Record<string, unknown> } }).ui?.visibility?.[modalId],
    ).toBe(false);
  });

  it('wires drawer isOpen to the same visibility store path in export when showHide targets it', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.button-solid',
      parentId: state.document.rootNodeId,
    });
    const buttonId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.drawer',
      parentId: state.document.rootNodeId,
    });
    const drawerId = state.document.nodes[state.document.rootNodeId].children.at(-1)!;

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = drawerId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [showAction]),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const path = visibilityStorePathForNode(drawerId);
    // Rooted at designerStore (the actually-declared preamble identifier) with bracket
    // notation (node ids are always hyphenated) — see modalDrawerVisibilityStorePathHyphenBug.test.ts.
    expect(tsx).toContain(`isOpen={${buildStorePathAccessExpression('designerStore', path)} === true}`);
    expect(tsx).toContain(`patchDesignerStore(${JSON.stringify(path)}, false)`);
  });
});
