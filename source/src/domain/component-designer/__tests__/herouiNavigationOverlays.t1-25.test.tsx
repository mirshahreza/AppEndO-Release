/**
 * @vitest-environment jsdom
 * Phase T1-25 — HeroUI Navigation & Overlays audit regression tests.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import {
  createDynamicActionsEventBindingDefinition,
  createEventBindingDefinition,
  eventBindingKeyForEvent,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import { createDynamicAction, visibilityStorePathForNode } from '../bindingDynamicActionsEngine';
import { DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS } from '../designerModalChrome';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import { buildStorePathAccessExpression } from '../visibilityConditionEngine';

const NAVIGATION_OVERLAY_IDS = [
  'heroui.tabs',
  'heroui.breadcrumbs',
  'heroui.dropdown',
  'heroui.modal',
  'heroui.alert-dialog',
  'heroui.drawer',
  'heroui.toolbar',
] as const;

const EVENT_BINDING_IDS = ['heroui.tabs', 'heroui.dropdown'] as const;

const STORE_CAPABILITY_IDS = ['heroui.modal', 'heroui.drawer'] as const;

/**
 * HeroUI Tabs.Indicator requires SharedElementTransition (not available in jsdom preview).
 *
 * TabsRoot below models real internal selection state via useState (mirroring HeroUI's own
 * react-aria-backed Tabs) so tests can prove that a prop-only re-render (e.g. a Style edit
 * dispatched from the Inspector) does NOT reset the currently selected tab. If the JSX element
 * identity changes (e.g. a stray `key` tied to style/className), React would remount TabsRoot
 * and this state would reset to defaultSelectedKey — the exact regression class flagged for
 * Grid components previously.
 */
const TabsSelectionContext = React.createContext<{ selectedKey: string; select: (key: string) => void } | undefined>(undefined);

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react');
  const TabsRoot: React.FC<Record<string, unknown>> = ({
    children,
    defaultSelectedKey,
    onSelectionChange,
    className,
    style,
  }) => {
    const [selectedKey, setSelectedKey] = React.useState<string>(String(defaultSelectedKey ?? 'tab-0'));
    const select = React.useCallback((key: string) => {
      setSelectedKey(key);
      (onSelectionChange as ((key: React.Key) => void) | undefined)?.(key);
    }, [onSelectionChange]);
    return (
      <TabsSelectionContext.Provider value={{ selectedKey, select }}>
        <div
          className={className as string | undefined}
          style={style as React.CSSProperties | undefined}
          data-designer-tabs="true"
          data-selected-key={selectedKey}
        >
          {children as React.ReactNode}
        </div>
      </TabsSelectionContext.Provider>
    );
  };
  const Tab: React.FC<Record<string, unknown>> = ({ children, id }) => {
    const ctx = React.useContext(TabsSelectionContext);
    const tabId = String(id ?? '');
    return (
      <button
        type="button"
        role="tab"
        id={tabId}
        aria-selected={ctx?.selectedKey === tabId}
        onClick={() => ctx?.select(tabId)}
      >
        {children as React.ReactNode}
      </button>
    );
  };

  const Tabs = Object.assign(TabsRoot, {
    ListContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    List: ({ children }: { children?: React.ReactNode }) => <div role="tablist">{children}</div>,
    Tab,
    Indicator: () => null,
    Panel: ({ children, id }: { children?: React.ReactNode; id?: string }) => {
      const ctx = React.useContext(TabsSelectionContext);
      if (ctx && ctx.selectedKey !== String(id ?? '')) {
        return null;
      }
      return <div role="tabpanel" id={id}>{children}</div>;
    },
  });

  return {
    ...actual,
    Tabs,
  };
});

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

describe('T1-25 HeroUI Navigation & Overlays audit', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(NAVIGATION_OVERLAY_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(NAVIGATION_OVERLAY_IDS)('exports TSX for %s', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
  });

  it.each(EVENT_BINDING_IDS)('exposes Interaction binding targets for %s (T1-6 confirm)', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const targets = resolveNodeEventBindingTargets(state.document.nodes[nodeId]!);
    if (itemId === 'heroui.tabs') {
      expect(targets).toEqual(['onSelectionChange']);
    } else {
      expect(targets).toEqual(['onAction']);
    }
  });

  it.each(STORE_CAPABILITY_IDS)('lists Store capability for %s', (itemId) => {
    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('Store');
  });

  it('lists GridDetail capability for heroui.modal', () => {
    const row = getBindingCapabilityRow('heroui.modal');
    expect(row?.supportedCapabilities).toContain('GridDetail');
  });

  it.each(['heroui.breadcrumbs', 'heroui.toolbar'] as const)(
    'has no matrix binding obligations for %s',
    (itemId) => {
      const row = getBindingCapabilityRow(itemId);
      expect(row?.bindingStatus).toBe('none');
      expect(row?.supportedCapabilities).toEqual([]);
    },
  );

  it('reflects tabs item labels in canvas and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tabs');
    const tabsId = lastChildId(state, state.document.rootNodeId);
    const [pane0Id, pane1Id] = state.document.nodes[tabsId].children;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: tabsId,
      key: 'items',
      value: [
        { key: 'tab-0', label: 'Overview' },
        { key: 'tab-1', label: 'Settings' },
      ],
    });
    state = insertItem(state, 'html.text', pane0Id);
    state = insertItem(state, 'html.text', pane1Id);
    const pane0TextId = lastChildId(state, pane0Id!);
    const pane1TextId = lastChildId(state, pane1Id!);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: pane0TextId,
      key: 'text',
      value: 'Overview body',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: pane1TextId,
      key: 'text',
      value: 'Settings body',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Overview');
    expect(container.textContent).toContain('Settings');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<UiTabs');
    expect(tsx).toContain('Overview');
    expect(tsx).toContain('Settings');
    expect(tsx).toContain('defaultSelectedKey="tab-0"');
  });

  it('preserves the selected tab across a Style-panel prop change instead of resetting to tab-0 (Grid-detail-style remount regression class)', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.tabs');
    const tabsId = lastChildId(state, state.document.rootNodeId);
    const [pane0Id, pane1Id] = state.document.nodes[tabsId].children;
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: tabsId,
      key: 'items',
      value: [
        { key: 'tab-0', label: 'Overview' },
        { key: 'tab-1', label: 'Settings' },
      ],
    });
    state = insertItem(state, 'html.text', pane0Id);
    state = insertItem(state, 'html.text', pane1Id);
    state = designerReducer(state, { type: 'set-node-prop', nodeId: lastChildId(state, pane0Id!), key: 'text', value: 'Overview' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId: lastChildId(state, pane1Id!), key: 'text', value: 'Settings' });

    const setStateRef: { current: React.Dispatch<React.SetStateAction<DesignerState>> | null } = { current: null };
    const Harness: React.FC = () => {
      const [current, setCurrent] = React.useState(state);
      setStateRef.current = setCurrent;
      return <>{renderDesignerDocumentPreview(current.document)}</>;
    };

    render(<Harness />);

    // Select the second tab.
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    await vi.waitFor(() => {
      expect(screen.getByRole('tabpanel')).toHaveProperty('id', 'tab-1');
    });

    // Now dispatch an unrelated Style-panel prop change on the tabs node (mirrors an Inspector edit).
    const styledState = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: tabsId,
      key: 'className',
      value: 'gap-4 rounded-xl border border-slate-300 p-4',
    });
    setStateRef.current!(styledState);

    // Selection must still be tab-1 (Settings), not reset back to tab-0.
    await vi.waitFor(() => {
      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveProperty('id', 'tab-1');
      expect(panel.textContent).toContain('Settings');
    });
    expect(screen.getByRole('tab', { name: 'Settings' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('false');
  });

  it('reflects breadcrumb child labels in canvas and export (not duplicate defaults)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.breadcrumbs');
    const crumbsId = lastChildId(state, state.document.rootNodeId);

    state = insertItem(state, 'html.list-item', crumbsId);
    state = insertItem(state, 'html.list-item', crumbsId);
    const [crumb0Id, crumb1Id] = state.document.nodes[crumbsId].children;

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: crumb0Id!,
      key: 'text',
      value: 'Products',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: crumb1Id!,
      key: 'text',
      value: 'Widgets',
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Products');
    expect(container.textContent).toContain('Widgets');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Breadcrumbs');
    expect(tsx).toContain('Products');
    expect(tsx).toContain('Widgets');
    expect(tsx).not.toContain('>Home</Breadcrumbs.Item>');
    expect(tsx).not.toContain('>Section</Breadcrumbs.Item>');
  });

  it('never emits breadcrumb size in export TSX (no size variant; field removed — parity audit item 67)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.breadcrumbs');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    // Leftover prop from documents authored before Size was removed must not leak.
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'size',
      value: 'lg',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Breadcrumbs');
    expect(tsx).not.toMatch(/<Breadcrumbs\b[^>]*\ssize=/);
  });

  it('reflects dropdown label and custom items in canvas and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: 'More actions',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'items',
      value: JSON.stringify([
        { id: 'edit', textValue: 'Edit row' },
        { id: 'delete', textValue: 'Delete row' },
      ]),
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('More actions');
    expect(container.textContent).toContain('Edit row');
    expect(container.textContent).toContain('Delete row');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Dropdown');
    expect(tsx).toContain('More actions');
    expect(tsx).toContain('Edit row');
    expect(tsx).toContain('Delete row');
  });

  it('fires dropdown onAction and writes store (T1-6 confirm)', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId,
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

  it('reflects modal title and size in canvas and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.modal');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'title',
      value: 'Edit profile',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'size',
      value: 'lg',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isOpen',
      value: true,
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(screen.getByText('Edit profile')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<CreateEditModalShell');
    expect(tsx).toContain('Edit profile');
    expect(tsx).toContain('size="lg"');
  });

  it('reflects alert-dialog title in canvas and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.alert-dialog');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'title',
      value: 'Delete item?',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isOpen',
      value: true,
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(screen.getByText('Delete item?')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<ConfirmDialogShell');
    expect(tsx).toContain('Delete item?');
  });

  it('renders alert-dialog body message and action footer in runtime preview (not header-only)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.alert-dialog');
    const dialogId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: dialogId,
      key: 'title',
      value: 'Delete content?',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: dialogId,
      key: 'isOpen',
      value: true,
    });

    state = insertItem(state, 'html.text', dialogId);
    const messageId = lastChildId(state, dialogId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: messageId,
      key: 'text',
      value: 'Delete this content? This cannot be undone.',
    });

    state = insertItem(state, 'layout.flex-row', dialogId);
    const footerId = lastChildId(state, dialogId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: footerId,
      key: 'className',
      value: DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS,
    });
    state = insertItem(state, 'heroui.button-outline', footerId);
    const cancelId = lastChildId(state, footerId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: cancelId,
      key: 'text',
      value: 'Cancel',
    });
    state = insertItem(state, 'heroui.button-solid', footerId);
    const deleteId = lastChildId(state, footerId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: deleteId,
      key: 'text',
      value: 'Delete',
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(screen.getByText('Delete content?')).toBeTruthy();
    expect(screen.getByText('Delete this content? This cannot be undone.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('reflects drawer title in canvas and export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.drawer');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'title',
      value: 'Filters panel',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isOpen',
      value: true,
    });

    render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(screen.getByText('Filters panel')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Drawer');
    expect(tsx).toContain('Filters panel');
  });

  it('wires modal isOpen to visibility store path in export when showHide targets it', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const buttonId = lastChildId(state, state.document.rootNodeId);

    state = insertItem(state, 'heroui.modal');
    const modalId = lastChildId(state, state.document.rootNodeId);

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = modalId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [showAction]),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const path = visibilityStorePathForNode(modalId);
    // Shells close via onClose → patchDesignerStore; visibility condition mounts the shell.
    expect(tsx).toContain(`patchDesignerStore(${JSON.stringify(path)}, false)`);
    expect(tsx).toContain('<CreateEditModalShell');
  });

  it('wires drawer isOpen to visibility store path in export when showHide targets it (T1-6 confirm)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const buttonId = lastChildId(state, state.document.rootNodeId);

    state = insertItem(state, 'heroui.drawer');
    const drawerId = lastChildId(state, state.document.rootNodeId);

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
    expect(tsx).toContain(`isOpen={${buildStorePathAccessExpression('designerStore', path)} === true}`);
    expect(tsx).toContain(`patchDesignerStore(${JSON.stringify(path)}, false)`);
  });

  it('reflects toolbar size and aria-label in canvas and export (T1-4 confirm)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.toolbar');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'size',
      value: 'sm',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'ariaLabel',
      value: 'Editor toolbar',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'dataTestId',
      value: 'main-toolbar',
    });

    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<Toolbar');
    expect(tsx).toContain('size="sm"');
    expect(tsx).toContain('aria-label="Editor toolbar"');
    expect(tsx).toContain('data-testid="main-toolbar"');
  });

  it('renders long dropdown label without breaking preview', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const longLabel = 'Actions '.repeat(30).trim();

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'label',
      value: longLabel,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Actions');
  });

  it('closes an open drawer by clicking its backdrop (regression: Drawer previously rendered without a Backdrop, so it could never be dismissed by the user)', async () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.button-solid');
    const buttonId = lastChildId(state, state.document.rootNodeId);

    state = insertItem(state, 'heroui.drawer');
    const drawerId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: drawerId,
      key: 'title',
      value: 'Filters panel',
    });

    const showAction = createDynamicAction('showHide');
    showAction.targetNodeId = drawerId;
    showAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: buttonId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [showAction]),
    });

    const visibilityPath = visibilityStorePathForNode(drawerId);
    let latestStore: Record<string, unknown> = {};

    const PreviewHarness: React.FC = () => {
      const [store, setStore] = React.useState<Record<string, unknown>>({});
      latestStore = store;
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
    expect(screen.queryByText('Filters panel')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /action/i }));
    await vi.waitFor(() => {
      expect(screen.getByText('Filters panel')).toBeTruthy();
    });

    const backdrop = document.querySelector('[data-slot="drawer-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop!);
    fireEvent.mouseDown(backdrop!);
    fireEvent.click(backdrop!);

    await vi.waitFor(() => {
      const segments = visibilityPath.split('.');
      let cursor: unknown = latestStore;
      for (const segment of segments) {
        cursor = (cursor as Record<string, unknown> | undefined)?.[segment];
      }
      expect(cursor).toBe(false);
    });
  });

  it('exports modal overlays as CreateEditModalShell (Base Components Create/Edit parity)', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.modal');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: 'audit-modal-dialog-mark',
    });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isOpen', value: true });

    render(<>{renderDesignerDocumentPreview(state.document, { interactive: true })}</>);
    expect(screen.getByText('Modal')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<CreateEditModalShell');
    expect(tsx).toContain('bodyOuterClassName="-mb-[15px]"');
    expect(tsx).toContain('footerClassName="!mt-0"');
    expect(tsx).not.toContain('<Modal');
    expect(tsx).not.toContain('Modal.Backdrop');
  });

  it('ignores HeroUI backdrop/placement/scrollBehavior on export — shells use admin dialog chrome', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.modal');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'backdrop', value: 'opaque' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'placement', value: 'top' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'scrollBehavior', value: 'inside' });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('<CreateEditModalShell');
    expect(tsx).not.toContain('Modal.Backdrop');
    expect(tsx).not.toContain('backdrop="opaque"');
    expect(tsx).not.toContain('scrollBehavior="inside"');
    expect(tsx).not.toContain('scroll="inside"');
  });

  it("does not offer non-functional 'Loading' / 'Close On Select' Inspector controls for heroui.dropdown (regression: DesignerRuntimeDropdown.tsx derives its own isLoading from the async items fetch and never read node.props.isLoading or closeOnSelect at all)", () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.dropdown');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[nodeId];
    const keys = resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
    expect(keys).not.toContain('isLoading');
    expect(keys).not.toContain('closeOnSelect');
  });
});
