import { canInsertPaletteItem, canMoveNodeToParent, getCompoundPaletteDefaultChildCount, getPaletteItemById, isCompoundPaletteItemId, isContainerNode } from './catalog';
import { canInsertTemplateSeeds, cloneTemplateSeedsToNodes } from './builtInTemplateClone';
import { cloneDesignerNodeSubtree } from './nodeSubtreeClone';
import { resolveShellChromeTemplateSeeds } from './shellChromeTemplates';
import { isDescendantNode, normalizeChildrenOrder, normalizeDesignerDocument } from './documentTree';
import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from './documentSchema';
import { normalizeDesignerDocumentFromPersist } from './documentPersist';
import {
  LAYOUT_DOCK_PANE_PAGE_CONTENT_CLASS,
  LAYOUT_DOCK_PANE_PALETTE_ITEM_ID,
} from './layoutPaletteConstants';
import {
  applyLayoutDockPaneHostSync,
  isLeadingLayoutDock,
  isVerticalLayoutDock,
  LAYOUT_DOCK_HOST_PROP,
  layoutDockHostClassName,
  layoutDockHostPaletteItemId,
  readLayoutDockEdge,
  type LayoutDockEdge,
} from './layoutDockPane';
import { applyAddLayoutTrack, resolveLayoutStructureHint } from './layoutStructure';
import { syncLayoutGridNodeColumnSizing } from './layoutGridColumnWidths';
import {
  createLayoutColumnSlotNode as buildLayoutColumnSlotNode,
  syncLayoutGridSlotChildren,
} from './layoutGridSlots';
import { cloneBindingDefinitions, createDefaultBindingDefinitions, normalizeBindingDefinitions, remapDataSourceReferencesInDocument } from './bindingRegistry';
import { validateStoreDependencies } from './bindingStoreEngine';
import { syncTailwindPropKeys } from './tailwindClasses';
import { applyShellLayoutSettingsToDocument } from '../../shared/lib/shellLayoutWidthDocument';
import {
  readShellBoundedEdge,
  readShellBoundedMaxWidth,
  readShellLayoutWidth,
  readShellLayoutWidthUserControl,
} from '../../shared/ui/shell-foundation/shellLayoutWidth';
import { invalidateHydrationCache } from './designerPreviewHydrationCache';
import { deriveDesignerLegacyAllowedRoles } from './designerPageAccess';
import { buildNodeVisibilityLayoutPatch, NODE_VISIBILITY_ACCESS_LAYOUT_KEY } from './designerNodeVisibilityAccess';
import { normalizeFunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import {
  type DesignerAction,
  type DesignerCanvasFillMode,
  type DesignerNode,
  type DesignerState,
  type DesignerViewport,
  type DesignerViewportPreset,
  type TemplateNodeSeed,
} from './types';
import { validateDesignerDocument } from './validation';
import { alignNodesInFlexParent } from './nodeFlexAlign';
import {
  buildGridListBindingWithToolbarQueryParams,
  getNodeGridListResourceRef,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from './bindingGridEngine';
import {
  normalizeDesignerGridToolbarConfig,
  serializeDesignerGridToolbarConfig,
} from './designerGridToolbarConfig';
import {
  DEFAULT_DESIGNER_TAB_ITEMS,
  isDesignerTabPaneNode,
  LAYOUT_TAB_PANE_CLASS,
  LAYOUT_TAB_PANE_PROP,
  parseDesignerTabItems,
} from './designerTabItems';

const VIEWPORT_PRESETS: Record<Exclude<DesignerViewportPreset, 'custom'>, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1280, height: 800 },
};

const VIEWPORT_PRESET_VALUES: ReadonlyArray<DesignerViewportPreset> = ['mobile', 'tablet', 'desktop', 'custom'];
const CANVAS_FILL_MODES: ReadonlyArray<DesignerCanvasFillMode> = ['manual', 'fill-width', 'fill-height', 'fill-both'];

export const normalizeDesignerViewport = (value: unknown): DesignerViewport | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.preset !== 'string'
    || !VIEWPORT_PRESET_VALUES.includes(candidate.preset as DesignerViewportPreset)
    || typeof candidate.width !== 'number'
    || typeof candidate.height !== 'number'
    || typeof candidate.fillMode !== 'string'
    || !CANVAS_FILL_MODES.includes(candidate.fillMode as DesignerCanvasFillMode)
  ) {
    return null;
  }

  return {
    preset: candidate.preset as DesignerViewportPreset,
    width: Math.max(240, Math.round(candidate.width)),
    height: Math.max(240, Math.round(candidate.height)),
    fillMode: candidate.fillMode as DesignerCanvasFillMode,
  };
};

export const createDefaultDesignerViewport = (): DesignerViewport => ({
  preset: 'desktop',
  width: VIEWPORT_PRESETS.desktop.width,
  height: VIEWPORT_PRESETS.desktop.height,
  fillMode: 'manual',
});

const ROOT_NODE_ID = 'root';
const HISTORY_LIMIT = 80;

const clampInsertIndex = (length: number, index?: number): number => {
  if (typeof index !== 'number' || Number.isNaN(index)) {
    return length;
  }

  return Math.max(0, Math.min(index, length));
};

const insertChildId = (children: string[], childId: string, index?: number): string[] => {
  const nextChildren = [...children];
  const insertionIndex = clampInsertIndex(nextChildren.length, index);
  nextChildren.splice(insertionIndex, 0, childId);
  return nextChildren;
};

const createNodeId = (itemId: string): string => `${itemId.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const createNodeFromPaletteItem = (itemId: string, parentId: string, order: number): DesignerNode | null => {
  const item = getPaletteItemById(itemId);
  if (!item) {
    return null;
  }

  const props: Record<string, unknown> = {
    ...item.defaultProps,
    _designerPaletteItemId: itemId,
  };

  if (typeof props.className === 'string') {
    if (props.className.trim().length > 0) {
      Object.assign(props, syncTailwindPropKeys(props.className));
    } else {
      delete props.className;
    }
  }

  return {
    id: createNodeId(itemId),
    type: item.nodeType,
    parentId,
    order,
    props,
    layout: {},
    binding: {},
    componentRef: item.sourceRef
      ? {
          refType: item.sourceType === 'system' ? 'system' : 'reusable',
          refId: item.sourceRef,
        }
      : undefined,
    children: [],
  };
};

const cloneDocument = (document: DesignerState['document']): DesignerState['document'] => structuredClone(document);

const cloneBindingDefinitionsState = (bindingDefinitions: DesignerState['bindingDefinitions']): DesignerState['bindingDefinitions'] =>
  cloneBindingDefinitions(bindingDefinitions);

const snapshotState = (state: DesignerState) => ({
  document: cloneDocument(state.document),
  bindingDefinitions: cloneBindingDefinitionsState(state.bindingDefinitions),
  selectedNodeId: state.selectedNodeId,
  selectedNodeIds: state.selectedNodeIds,
});

const selectionState = (nodeId: string | null): Pick<DesignerState, 'selectedNodeId' | 'selectedNodeIds'> => ({
  selectedNodeId: nodeId,
  selectedNodeIds: nodeId ? [nodeId] : [],
});

const pushHistory = (previousState: DesignerState, nextState: DesignerState): DesignerState => {
  const past = [...previousState.history.past, snapshotState(previousState)];
  const boundedPast = past.length > previousState.history.limit ? past.slice(past.length - previousState.history.limit) : past;

  return {
    ...nextState,
    history: {
      ...previousState.history,
      past: boundedPast,
      future: [],
    },
  };
};

const areDiagnosticsEqual = (left: DesignerState['document']['diagnostics'], right: DesignerState['document']['diagnostics']): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const other = right[index];
    if (
      current.id !== other.id ||
      current.code !== other.code ||
      current.level !== other.level ||
      current.message !== other.message ||
      current.nodeId !== other.nodeId ||
      current.field !== other.field
    ) {
      return false;
    }
  }

  return true;
};

const withDiagnostics = (state: DesignerState): DesignerState => {
  const diagnostics = [
    ...validateDesignerDocument(state.document),
    ...validateStoreDependencies(state.document),
  ];
  if (areDiagnosticsEqual(state.document.diagnostics, diagnostics)) {
    return state;
  }

  return {
    ...state,
    document: {
      ...state.document,
      diagnostics,
    },
  };
};

const commitStateMutation = (previousState: DesignerState, nextState: DesignerState): DesignerState => {
  if (nextState === previousState) {
    return previousState;
  }

  const validated = withDiagnostics(nextState);
  const touched = withTouchedDocument(validated);
  return pushHistory(previousState, touched);
};

const createLayoutColumnSlotNode = (parentId: string, order: number): DesignerNode =>
  buildLayoutColumnSlotNode(parentId, order, () => createNodeId('layout-column'));

const insertCompoundPaletteItem = (state: DesignerState, itemId: string, parentId: string, index?: number): DesignerState => {
  const parentNode = state.document.nodes[parentId];
  const item = getPaletteItemById(itemId);

  if (!parentNode || !item || !canInsertPaletteItem(item, parentNode)) {
    return state;
  }

  const nextParent = createNodeFromPaletteItem(itemId, parentId, clampInsertIndex(parentNode.children.length, index));
  if (!nextParent) {
    return state;
  }

  const columnCount = getCompoundPaletteDefaultChildCount(itemId);
  const columnNodes = Array.from({ length: columnCount }, (_, order) => createLayoutColumnSlotNode(nextParent.id, order));
  nextParent.children = columnNodes.map((columnNode) => columnNode.id);

  let nodes: Record<string, DesignerNode> = {
    ...state.document.nodes,
    [parentId]: {
      ...parentNode,
      children: insertChildId(parentNode.children, nextParent.id, index),
    },
    [nextParent.id]: nextParent,
  };

  for (const columnNode of columnNodes) {
    nodes[columnNode.id] = columnNode;
  }

  nodes = normalizeChildrenOrder(nodes, parentId);
  nodes = normalizeChildrenOrder(nodes, nextParent.id);

  return {
    ...state,
    document: {
      ...state.document,
      nodes,
    },
    ...selectionState(nextParent.id),
  };
};

const insertBuiltInTemplate = (
  state: DesignerState,
  templateRoots: TemplateNodeSeed[],
  parentId: string,
  index?: number,
): DesignerState => {
  const parentNode = state.document.nodes[parentId];

  if (!parentNode || templateRoots.length === 0 || !canInsertTemplateSeeds(templateRoots, parentNode)) {
    return state;
  }

  const insertionIndex = clampInsertIndex(parentNode.children.length, index);
  const { nodes: clonedNodes, rootNodeIds } = cloneTemplateSeedsToNodes(templateRoots, parentId, insertionIndex);

  let nextChildren = [...parentNode.children];
  nextChildren.splice(insertionIndex, 0, ...rootNodeIds);

  let nodes: Record<string, DesignerNode> = {
    ...state.document.nodes,
    ...clonedNodes,
    [parentId]: {
      ...parentNode,
      children: nextChildren,
    },
  };

  nodes = normalizeChildrenOrder(nodes, parentId);

  return {
    ...state,
    document: {
      ...state.document,
      nodes,
    },
    ...selectionState(rootNodeIds[0] ?? state.selectedNodeId),
  };
};

const isDesignerTabsNode = (node: DesignerNode | undefined): boolean =>
  node?.props._designerPaletteItemId === 'heroui.tabs';

const createDesignerTabPaneNode = (parentId: string, order: number): DesignerNode => {
  const pane = createNodeFromPaletteItem('layout.flex-column', parentId, order);
  if (!pane) {
    return {
      id: createNodeId('tab-pane'),
      type: 'container',
      parentId,
      order,
      props: {
        className: LAYOUT_TAB_PANE_CLASS,
        _designerPaletteItemId: 'layout.flex-column',
        [LAYOUT_TAB_PANE_PROP]: true,
        ...syncTailwindPropKeys(LAYOUT_TAB_PANE_CLASS),
      },
      layout: {},
      binding: {},
      children: [],
    };
  }

  const classed = applyNodeClassName(pane, LAYOUT_TAB_PANE_CLASS);
  return {
    ...classed,
    props: {
      ...classed.props,
      [LAYOUT_TAB_PANE_PROP]: true,
    },
  };
};

const syncDesignerTabPaneChildren = (
  nodes: Record<string, DesignerNode>,
  tabsId: string,
): Record<string, DesignerNode> => {
  const tabs = nodes[tabsId];
  if (!tabs || !isDesignerTabsNode(tabs)) {
    return nodes;
  }

  const items = parseDesignerTabItems(tabs.props.items);
  const targetCount = Math.max(items.length, 1);
  let nextNodes = { ...nodes };
  let paneIds = tabs.children.filter((childId) => {
    const child = nextNodes[childId];
    return child && isDesignerTabPaneNode(child);
  });
  const extraIds = tabs.children.filter((childId) => !paneIds.includes(childId));

  while (paneIds.length < targetCount) {
    const pane = createDesignerTabPaneNode(tabsId, paneIds.length);
    nextNodes[pane.id] = pane;
    paneIds = [...paneIds, pane.id];
  }

  while (paneIds.length > targetCount) {
    const lastPaneId = paneIds[paneIds.length - 1];
    if (!lastPaneId) {
      break;
    }
    paneIds = paneIds.slice(0, -1);
    const removed = collectNodeAndDescendantIds(nextNodes, lastPaneId);
    for (const id of removed) {
      delete nextNodes[id];
    }
  }

  if (extraIds.length > 0 && paneIds[0]) {
    const firstPane = nextNodes[paneIds[0]];
    if (firstPane) {
      nextNodes[paneIds[0]] = {
        ...firstPane,
        children: [...firstPane.children, ...extraIds],
      };
      for (const extraId of extraIds) {
        const extra = nextNodes[extraId];
        if (extra) {
          nextNodes[extraId] = {
            ...extra,
            parentId: paneIds[0],
          };
        }
      }
    }
  }

  nextNodes[tabsId] = {
    ...tabs,
    children: paneIds,
    props: {
      ...tabs.props,
      defaultSelectedKey: items.some((item) => item.key === tabs.props.defaultSelectedKey)
        ? tabs.props.defaultSelectedKey
        : (items[0]?.key ?? 'tab-0'),
    },
  };

  return normalizeChildrenOrder(nextNodes, tabsId);
};

const resolveTabsDropParentId = (
  nodes: Record<string, DesignerNode>,
  parentId: string,
): string => {
  const parent = nodes[parentId];
  if (!parent || !isDesignerTabsNode(parent)) {
    return parentId;
  }

  const paneIds = parent.children.filter((childId) => {
    const child = nodes[childId];
    return child && isDesignerTabPaneNode(child);
  });
  if (paneIds.length === 0) {
    return parentId;
  }

  const items = parseDesignerTabItems(parent.props.items);
  const selectedKey = typeof parent.props.defaultSelectedKey === 'string' && parent.props.defaultSelectedKey.trim()
    ? parent.props.defaultSelectedKey.trim()
    : items[0]?.key;
  const selectedIndex = Math.max(0, items.findIndex((item) => item.key === selectedKey));
  return paneIds[selectedIndex] ?? paneIds[0] ?? parentId;
};

const insertDesignerTabs = (state: DesignerState, parentId: string, index?: number): DesignerState => {
  const parentNode = state.document.nodes[parentId];
  const item = getPaletteItemById('heroui.tabs');
  if (!parentNode || !item || !canInsertPaletteItem(item, parentNode)) {
    return state;
  }

  const tabsNode = createNodeFromPaletteItem(
    'heroui.tabs',
    parentId,
    clampInsertIndex(parentNode.children.length, index),
  );
  if (!tabsNode) {
    return state;
  }

  const items = parseDesignerTabItems(tabsNode.props.items);
  const panes = (items.length > 0 ? items : DEFAULT_DESIGNER_TAB_ITEMS).map((_, paneIndex) => (
    createDesignerTabPaneNode(tabsNode.id, paneIndex)
  ));
  tabsNode.children = panes.map((pane) => pane.id);

  let nodes: Record<string, DesignerNode> = {
    ...state.document.nodes,
    [parentId]: {
      ...parentNode,
      children: insertChildId(parentNode.children, tabsNode.id, index),
    },
    [tabsNode.id]: tabsNode,
  };
  for (const pane of panes) {
    nodes[pane.id] = pane;
  }
  nodes = normalizeChildrenOrder(nodes, parentId);
  nodes = normalizeChildrenOrder(nodes, tabsNode.id);

  return {
    ...state,
    document: {
      ...state.document,
      nodes,
    },
    ...selectionState(tabsNode.id),
  };
};

const applyNodeClassName = (node: DesignerNode, className: string): DesignerNode => ({
  ...node,
  props: {
    ...node.props,
    className,
    ...syncTailwindPropKeys(className),
  },
});

const isHorizontalFlexParent = (node: DesignerNode): boolean => {
  const itemId = typeof node.props._designerPaletteItemId === 'string' ? node.props._designerPaletteItemId : '';
  if (itemId === 'layout.flex-row') {
    return true;
  }
  const className = typeof node.props.className === 'string' ? node.props.className : '';
  return /(?:^|\s)flex-row(?:-reverse)?(?:\s|$)/.test(className);
};

const isVerticalFlexParent = (node: DesignerNode): boolean => {
  const itemId = typeof node.props._designerPaletteItemId === 'string' ? node.props._designerPaletteItemId : '';
  if (itemId === 'layout.flex-column') {
    return true;
  }
  const className = typeof node.props.className === 'string' ? node.props.className : '';
  return /(?:^|\s)flex-col(?:-reverse)?(?:\s|$)/.test(className);
};

const isCompatibleDockHost = (node: DesignerNode, dock: LayoutDockEdge): boolean =>
  isVerticalLayoutDock(dock) ? isVerticalFlexParent(node) : isHorizontalFlexParent(node);

const insertLayoutDockPane = (state: DesignerState, parentId: string, index?: number): DesignerState => {
  const parentNode = state.document.nodes[parentId];
  const item = getPaletteItemById(LAYOUT_DOCK_PANE_PALETTE_ITEM_ID);
  if (!parentNode || !item || !canInsertPaletteItem(item, parentNode)) {
    return state;
  }

  const dock = readLayoutDockEdge(item.defaultProps.dock);

  if (parentNode.type !== 'root' || isCompatibleDockHost(parentNode, dock)) {
    const nextNode = createNodeFromPaletteItem(
      LAYOUT_DOCK_PANE_PALETTE_ITEM_ID,
      parentId,
      clampInsertIndex(parentNode.children.length, index),
    );
    if (!nextNode) {
      return state;
    }

    let nodes: Record<string, DesignerNode> = {
      ...state.document.nodes,
      [parentId]: {
        ...parentNode,
        children: insertChildId(parentNode.children, nextNode.id, index),
      },
      [nextNode.id]: nextNode,
    };
    nodes = normalizeChildrenOrder(nodes, parentId);

    return {
      ...state,
      document: {
        ...state.document,
        nodes,
      },
      ...selectionState(nextNode.id),
    };
  }

  const host = createNodeFromPaletteItem(layoutDockHostPaletteItemId(dock), parentId, 0);
  const pane = host
    ? createNodeFromPaletteItem(LAYOUT_DOCK_PANE_PALETTE_ITEM_ID, host.id, 0)
    : null;
  const content = host
    ? createNodeFromPaletteItem('layout.flex-column', host.id, 1)
    : null;
  if (!host || !pane || !content) {
    return state;
  }

  const hostNode = applyNodeClassName(host, layoutDockHostClassName(dock));
  hostNode.props[LAYOUT_DOCK_HOST_PROP] = true;
  const contentNode = applyNodeClassName(content, LAYOUT_DOCK_PANE_PAGE_CONTENT_CLASS);
  const existingChildIds = [...parentNode.children];
  hostNode.children = isLeadingLayoutDock(dock)
    ? [pane.id, contentNode.id]
    : [contentNode.id, pane.id];
  contentNode.children = existingChildIds;

  let nodes: Record<string, DesignerNode> = { ...state.document.nodes };
  for (const childId of existingChildIds) {
    const child = nodes[childId];
    if (child) {
      nodes[childId] = { ...child, parentId: contentNode.id };
    }
  }
  nodes[parentId] = {
    ...parentNode,
    children: [hostNode.id],
  };
  nodes[hostNode.id] = hostNode;
  nodes[pane.id] = pane;
  nodes[contentNode.id] = contentNode;
  nodes = normalizeChildrenOrder(nodes, parentId);
  nodes = normalizeChildrenOrder(nodes, hostNode.id);
  nodes = normalizeChildrenOrder(nodes, contentNode.id);

  return {
    ...state,
    document: {
      ...state.document,
      nodes,
    },
    ...selectionState(pane.id),
  };
};

const insertPaletteItem = (state: DesignerState, itemId: string, parentId: string, index?: number): DesignerState => {
  const shellTemplate = resolveShellChromeTemplateSeeds(itemId);
  if (shellTemplate) {
    return insertBuiltInTemplate(state, shellTemplate, parentId, index);
  }

  if (isCompoundPaletteItemId(itemId)) {
    return insertCompoundPaletteItem(state, itemId, parentId, index);
  }

  if (itemId === LAYOUT_DOCK_PANE_PALETTE_ITEM_ID) {
    return insertLayoutDockPane(state, parentId, index);
  }

  if (itemId === 'heroui.tabs') {
    return insertDesignerTabs(state, parentId, index);
  }

  const dropParentId = resolveTabsDropParentId(state.document.nodes, parentId);
  const parentNode = state.document.nodes[dropParentId];
  const item = getPaletteItemById(itemId);

  if (!parentNode || !item) {
    return state;
  }

  if (!canInsertPaletteItem(item, parentNode)) {
    if (itemId !== 'html.list-item') {
      return state;
    }

    const listPaletteItem = getPaletteItemById('html.list');
    if (!listPaletteItem || !canInsertPaletteItem(listPaletteItem, parentNode)) {
      return state;
    }

    const listNode = createNodeFromPaletteItem('html.list', dropParentId, clampInsertIndex(parentNode.children.length, index));
    if (!listNode) {
      return state;
    }

    const listItemNode = createNodeFromPaletteItem('html.list-item', listNode.id, 0);
    if (!listItemNode) {
      return state;
    }

    listNode.children = [listItemNode.id];

    let nodes: Record<string, DesignerNode> = {
      ...state.document.nodes,
      [dropParentId]: {
        ...parentNode,
        children: insertChildId(parentNode.children, listNode.id, index),
      },
      [listNode.id]: listNode,
      [listItemNode.id]: listItemNode,
    };
    nodes = normalizeChildrenOrder(nodes, dropParentId);
    nodes = normalizeChildrenOrder(nodes, listNode.id);

    return {
      ...state,
      document: {
        ...state.document,
        nodes,
      },
      ...selectionState(listItemNode.id),
    };
  }

  const nextNode = createNodeFromPaletteItem(itemId, dropParentId, clampInsertIndex(parentNode.children.length, index));
  if (!nextNode) {
    return state;
  }

  let nodes: Record<string, DesignerNode> = {
    ...state.document.nodes,
    [dropParentId]: {
      ...parentNode,
      children: insertChildId(parentNode.children, nextNode.id, index),
    },
    [nextNode.id]: nextNode,
  };
  nodes = normalizeChildrenOrder(nodes, dropParentId);

  return {
    ...state,
    document: {
      ...state.document,
      nodes,
    },
    ...selectionState(nextNode.id),
  };
};

const moveNode = (state: DesignerState, nodeId: string, targetParentId: string, index?: number): DesignerState => {
  if (nodeId === ROOT_NODE_ID || nodeId === targetParentId) {
    return state;
  }

  const node = state.document.nodes[nodeId];
  const sourceParent = node?.parentId ? state.document.nodes[node.parentId] : null;
  const targetParent = state.document.nodes[targetParentId];

  if (!node || !sourceParent || !targetParent || !isContainerNode(targetParent) || isDescendantNode(state.document.nodes, targetParentId, nodeId)) {
    return state;
  }

  if (!canMoveNodeToParent(node, targetParent)) {
    return state;
  }

  const sourceIndex = sourceParent.children.indexOf(nodeId);
  const nextSourceChildren = sourceParent.children.filter((childId) => childId !== nodeId);
  const sameParent = sourceParent.id === targetParentId;
  const baseTargetChildren = sameParent ? nextSourceChildren : targetParent.children;
  let insertionIndex = index;
  if (
    sameParent &&
    typeof insertionIndex === 'number' &&
    sourceIndex >= 0 &&
    sourceIndex < insertionIndex
  ) {
    insertionIndex -= 1;
  }
  const nextTargetChildren = insertChildId(baseTargetChildren, nodeId, insertionIndex);

  let nodes: Record<string, DesignerNode> = {
    ...state.document.nodes,
    [sourceParent.id]: {
      ...sourceParent,
      children: sameParent ? nextTargetChildren : nextSourceChildren,
    },
    [targetParentId]: sameParent
      ? {
          ...targetParent,
          children: nextTargetChildren,
        }
      : {
          ...targetParent,
          children: nextTargetChildren,
        },
    [nodeId]: {
      ...node,
      parentId: targetParentId,
    },
  };

  nodes = normalizeChildrenOrder(nodes, sourceParent.id);
  if (!sameParent) {
    nodes = normalizeChildrenOrder(nodes, targetParentId);
  }

  return {
    ...state,
    document: {
      ...state.document,
      nodes,
    },
    ...selectionState(nodeId),
  };
};

const collectNodeAndDescendantIds = (nodes: Record<string, DesignerNode>, nodeId: string): Set<string> => {
  const ids = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || ids.has(currentId)) {
      continue;
    }

    ids.add(currentId);
    const currentNode = nodes[currentId];
    if (!currentNode) {
      continue;
    }

    for (const childId of currentNode.children) {
      stack.push(childId);
    }
  }

  return ids;
};

const insertClonedSubtree = (
  state: DesignerState,
  sourceNodes: Record<string, DesignerNode>,
  sourceRootId: string,
  targetParentId: string,
  index?: number,
): DesignerState => {
  const targetParent = state.document.nodes[targetParentId];
  const sourceRoot = sourceNodes[sourceRootId];
  if (!targetParent || !sourceRoot || !isContainerNode(targetParent)) {
    return state;
  }

  if (!canMoveNodeToParent(sourceRoot, targetParent)) {
    return state;
  }

  const insertionIndex = clampInsertIndex(targetParent.children.length, index);
  const cloned = cloneDesignerNodeSubtree(
    sourceNodes,
    sourceRootId,
    targetParentId,
    insertionIndex,
  );
  if (!cloned) {
    return state;
  }

  let nextChildren = [...targetParent.children];
  nextChildren.splice(insertionIndex, 0, cloned.rootNodeId);

  let nodes: Record<string, DesignerNode> = {
    ...state.document.nodes,
    ...cloned.nodes,
    [targetParentId]: {
      ...targetParent,
      children: nextChildren,
    },
  };

  nodes = normalizeChildrenOrder(nodes, targetParentId);

  return {
    ...state,
    document: {
      ...state.document,
      nodes,
    },
    ...selectionState(cloned.rootNodeId),
  };
};

const duplicateNode = (state: DesignerState, nodeId: string): DesignerState => {
  if (nodeId === ROOT_NODE_ID || nodeId === state.document.rootNodeId) {
    return state;
  }

  const node = state.document.nodes[nodeId];
  const parentId = node?.parentId;
  const parent = parentId ? state.document.nodes[parentId] : null;
  if (!node || !parentId || !parent) {
    return state;
  }

  const sourceIndex = parent.children.indexOf(nodeId);
  const insertAt = sourceIndex >= 0 ? sourceIndex + 1 : parent.children.length;
  return insertClonedSubtree(state, state.document.nodes, nodeId, parentId, insertAt);
};

const removeNode = (state: DesignerState, nodeId: string): DesignerState => {
  if (nodeId === ROOT_NODE_ID) {
    return state;
  }

  const node = state.document.nodes[nodeId];
  const parentId = node?.parentId;
  const parent = parentId ? state.document.nodes[parentId] : null;
  if (!node || !parentId || !parent) {
    return state;
  }

  const removedNodeIds = collectNodeAndDescendantIds(state.document.nodes, nodeId);
  const nodes: Record<string, DesignerNode> = { ...state.document.nodes };
  for (const id of removedNodeIds) {
    delete nodes[id];
  }

  nodes[parentId] = {
    ...parent,
    children: parent.children.filter((childId) => !removedNodeIds.has(childId)),
  };

  const normalized = normalizeChildrenOrder(nodes, parentId);
  const selectedNodeIds = state.selectedNodeIds.filter((id) => !removedNodeIds.has(id) && nodes[id]);
  const selectedNodeId = state.selectedNodeId && !removedNodeIds.has(state.selectedNodeId) && nodes[state.selectedNodeId]
    ? state.selectedNodeId
    : (selectedNodeIds[selectedNodeIds.length - 1] ?? parentId);
  const hoveredNodeId = state.hoveredNodeId && removedNodeIds.has(state.hoveredNodeId)
    ? null
    : state.hoveredNodeId;

  return {
    ...state,
    document: {
      ...state.document,
      nodes: normalized,
    },
    selectedNodeId,
    selectedNodeIds,
    hoveredNodeId,
  };
};

const resolveDeletableNodeIds = (state: DesignerState, nodeIds: string[]): string[] => {
  const rootId = state.document.rootNodeId;
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of nodeIds) {
    const id = raw.trim();
    if (!id || seen.has(id) || id === ROOT_NODE_ID || id === rootId || !state.document.nodes[id]) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique.filter((id) => (
    !unique.some((other) => other !== id && isDescendantNode(state.document.nodes, id, other))
  ));
};

const removeNodes = (state: DesignerState, nodeIds: string[]): DesignerState => {
  const targets = resolveDeletableNodeIds(state, nodeIds);
  if (targets.length === 0) {
    return state;
  }
  return targets.reduce((current, nodeId) => removeNode(current, nodeId), state);
};

const syncListItemTexts = (state: DesignerState, listNodeId: string, texts: string[]): DesignerState => {
  const listNode = state.document.nodes[listNodeId];
  if (!listNode || listNode.type !== 'list') {
    return state;
  }

  const item = getPaletteItemById('html.list-item');
  if (!item) {
    return state;
  }

  let nodes: Record<string, DesignerNode> = { ...state.document.nodes };

  for (const childId of listNode.children) {
    const removedIds = collectNodeAndDescendantIds(nodes, childId);
    for (const id of removedIds) {
      delete nodes[id];
    }
  }

  const trimmedTexts = texts.map((text) => text.trim()).filter((text) => text.length > 0);
  const newChildIds: string[] = [];

  for (let index = 0; index < trimmedTexts.length; index += 1) {
    const nextNode = createNodeFromPaletteItem('html.list-item', listNodeId, index);
    if (!nextNode) {
      continue;
    }

    nodes[nextNode.id] = {
      ...nextNode,
      props: {
        ...nextNode.props,
        text: trimmedTexts[index],
      },
    };
    newChildIds.push(nextNode.id);
  }

  nodes[listNodeId] = {
    ...listNode,
    children: newChildIds,
  };

  const normalized = normalizeChildrenOrder(nodes, listNodeId);

  return {
    ...state,
    document: {
      ...state.document,
      nodes: normalized,
    },
    ...selectionState(listNodeId),
  };
};

const getNodeById = (state: DesignerState, nodeId: string): DesignerNode | null => state.document.nodes[nodeId] ?? null;

const updateNode = (state: DesignerState, nodeId: string, updater: (node: DesignerNode) => DesignerNode | null): DesignerState => {
  const node = getNodeById(state, nodeId);
  if (!node) {
    return state;
  }

  const nextNode = updater(node);
  if (!nextNode) {
    return state;
  }

  return {
    ...state,
    document: {
      ...state.document,
      nodes: {
        ...state.document.nodes,
        [nodeId]: nextNode,
      },
    },
  };
};

export const createInitialDesignerState = (name = 'untitled-component'): DesignerState => {
  const now = new Date().toISOString();

  const baseState: DesignerState = {
    document: {
      schemaVersion: DESIGNER_DOCUMENT_SCHEMA_VERSION,
      id: `draft-${Date.now()}`,
      name,
      rootNodeId: ROOT_NODE_ID,
      nodes: {
        [ROOT_NODE_ID]: {
          id: ROOT_NODE_ID,
          type: 'root',
          parentId: null,
          order: 0,
          props: {},
          layout: {},
          binding: {},
          children: [],
        },
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
      },
      diagnostics: [],
    },
    bindingDefinitions: createDefaultBindingDefinitions(),
    syncDiagnostics: [],
    selectedNodeId: null,
    selectedNodeIds: [],
    hoveredNodeId: null,
    paletteSearch: '',
    viewMode: 'split',
    viewport: createDefaultDesignerViewport(),
    canvasComments: [],
    history: {
      past: [],
      future: [],
      limit: HISTORY_LIMIT,
    },
    isDirty: false,
  };

  return withDiagnostics(baseState);
};

const withTouchedDocument = (state: DesignerState): DesignerState => ({
  ...state,
  document: {
    ...state.document,
    metadata: {
      ...state.document.metadata,
      updatedAt: new Date().toISOString(),
    },
  },
  isDirty: true,
});

export const touchDesignerDocument = (state: DesignerState): DesignerState => withTouchedDocument(state);

export const designerReducer = (state: DesignerState, action: DesignerAction): DesignerState => {
  switch (action.type) {
    case 'hydrate-document': {
      const document = normalizeDesignerDocument(normalizeDesignerDocumentFromPersist(action.document));
      const preferredSelectedNodeId = action.preferredSelectedNodeId ?? state.selectedNodeId;
      const selectedNodeId = preferredSelectedNodeId && document.nodes[preferredSelectedNodeId]
        ? preferredSelectedNodeId
        : document.rootNodeId;
      const viewport = action.resetViewport
        ? createDefaultDesignerViewport()
        : normalizeDesignerViewport(action.viewport) ?? state.viewport;

      return withDiagnostics({
        ...state,
        document,
        bindingDefinitions: normalizeBindingDefinitions(action.bindingDefinitions),
        ...selectionState(selectedNodeId),
        viewport,
        canvasComments: [],
        syncDiagnostics: [],
        history: {
          ...state.history,
          past: [],
          future: [],
        },
        isDirty: false,
      });
    }

    case 'restore-viewport': {
      const viewport = normalizeDesignerViewport(action.viewport);
      if (!viewport) {
        return state;
      }

      return {
        ...state,
        viewport,
      };
    }

    case 'replace-document-from-code': {
      const normalizedDocument = normalizeDesignerDocument(action.document);
      const preferredSelectedNodeId = action.preferredSelectedNodeId ?? state.selectedNodeId;
      const selectedNodeId = preferredSelectedNodeId && normalizedDocument.nodes[preferredSelectedNodeId]
        ? preferredSelectedNodeId
        : normalizedDocument.rootNodeId;

      return commitStateMutation(state, {
        ...state,
        document: normalizedDocument,
        bindingDefinitions: normalizeBindingDefinitions(action.bindingDefinitions),
        ...selectionState(selectedNodeId),
        syncDiagnostics: [],
      });
    }

    case 'set-sync-diagnostics':
      return {
        ...state,
        syncDiagnostics: action.diagnostics,
      };

    case 'clear-sync-diagnostics':
      if (state.syncDiagnostics.length === 0) {
        return state;
      }

      return {
        ...state,
        syncDiagnostics: [],
      };

    case 'select-node': {
      if (!action.nodeId) {
        return {
          ...state,
          selectedNodeId: null,
          selectedNodeIds: [],
        };
      }

      if (action.additive) {
        const exists = state.selectedNodeIds.includes(action.nodeId);
        const selectedNodeIds = exists
          ? state.selectedNodeIds.filter((id) => id !== action.nodeId)
          : [...state.selectedNodeIds, action.nodeId];
        return {
          ...state,
          selectedNodeId: action.nodeId,
          selectedNodeIds,
        };
      }

      return {
        ...state,
        selectedNodeId: action.nodeId,
        selectedNodeIds: [action.nodeId],
      };
    }

    case 'select-nodes': {
      const seen = new Set<string>();
      const nodeIds: string[] = [];
      for (const raw of action.nodeIds) {
        const id = raw.trim();
        if (!id || seen.has(id) || !state.document.nodes[id]) {
          continue;
        }
        seen.add(id);
        nodeIds.push(id);
      }
      if (nodeIds.length === 0) {
        return {
          ...state,
          selectedNodeId: null,
          selectedNodeIds: [],
        };
      }
      return {
        ...state,
        selectedNodeId: nodeIds[nodeIds.length - 1] ?? null,
        selectedNodeIds: nodeIds,
      };
    }

    case 'align-nodes-in-flex': {
      const nextDocument = alignNodesInFlexParent(state.document, action.nodeIds, action.alignment);
      if (!nextDocument) {
        return state;
      }

      return commitStateMutation(state, {
        ...state,
        document: nextDocument,
      });
    }

    case 'hover-node':
      if (state.hoveredNodeId === action.nodeId) {
        return state;
      }
      return {
        ...state,
        hoveredNodeId: action.nodeId,
      };

    case 'set-document-name':
      return {
        ...state,
        document: {
          ...state.document,
          name: action.name,
        },
      };

    case 'set-palette-search':
      return {
        ...state,
        paletteSearch: action.value,
      };

    case 'set-view-mode':
      return {
        ...state,
        viewMode: action.viewMode,
      };

    case 'set-viewport-preset': {
      if (action.preset === 'custom') {
        return {
          ...state,
          viewport: {
            ...state.viewport,
            preset: 'custom',
            width: action.width ?? state.viewport.width,
            height: action.height ?? state.viewport.height,
          },
        };
      }

      const preset = VIEWPORT_PRESETS[action.preset];
      return {
        ...state,
        viewport: {
          ...state.viewport,
          preset: action.preset,
          width: preset.width,
          height: preset.height,
        },
      };
    }

    case 'resize-canvas':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          preset: 'custom',
          width: Math.max(240, action.width),
          height: Math.max(240, action.height),
        },
      };

    case 'set-fill-mode':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          fillMode: action.fillMode,
        },
      };

    case 'insert-palette-item':
      return commitStateMutation(state, insertPaletteItem(state, action.itemId, action.parentId, action.index));

    case 'insert-built-in-template':
      return commitStateMutation(state, insertBuiltInTemplate(state, action.templateRoots, action.parentId, action.index));

    case 'move-node':
      return commitStateMutation(state, moveNode(state, action.nodeId, action.targetParentId, action.index));

    case 'remove-node':
      return commitStateMutation(state, removeNode(state, action.nodeId));

    case 'remove-nodes':
      return commitStateMutation(state, removeNodes(state, action.nodeIds));

    case 'add-layout-track': {
      const next = applyAddLayoutTrack(state, action.nodeId, action.axis, action.place ?? 'after');
      if (next === state) {
        return state;
      }
      const hostId = next.selectedNodeId ?? action.nodeId;
      let nodes = next.document.nodes;
      nodes = syncLayoutGridSlotChildren(nodes, hostId);
      nodes = normalizeChildrenOrder(nodes, hostId);
      const host = nodes[hostId];
      if (host) {
        for (const childId of host.children) {
          nodes = normalizeChildrenOrder(nodes, childId);
        }
      }
      const hint = resolveLayoutStructureHint(next.document.nodes, action.nodeId);
      if (hint?.hoveredChildId && hint.hoveredChildId !== hostId) {
        nodes = normalizeChildrenOrder(nodes, hint.hoveredChildId);
      }
      return commitStateMutation(state, {
        ...next,
        document: {
          ...next.document,
          nodes,
        },
      });
    }

    case 'duplicate-node':
      return commitStateMutation(state, duplicateNode(state, action.nodeId));

    case 'paste-node-subtree':
      return commitStateMutation(
        state,
        insertClonedSubtree(
          state,
          action.sourceNodes,
          action.sourceRootId,
          action.targetParentId,
          action.index,
        ),
      );

    case 'set-node-prop': {
      const next = updateNode(state, action.nodeId, (node) => {
        const hasKey = Object.prototype.hasOwnProperty.call(node.props, action.key);
        if (action.value === undefined) {
          if (!hasKey) {
            return null;
          }

          const props = { ...node.props };
          delete props[action.key];
          return {
            ...node,
            props,
          };
        }

        if (Object.is(node.props[action.key], action.value)) {
          return null;
        }

        const props = {
          ...node.props,
          [action.key]: action.value,
        };

        if (action.key === 'className' && typeof action.value === 'string') {
          Object.assign(props, syncTailwindPropKeys(action.value));
        }

        return {
          ...node,
          props,
        };
      });

      if (next === state) {
        return state;
      }

      let syncedNodes = next.document.nodes;
      const updatedNode = syncedNodes[action.nodeId];
      if (updatedNode) {
        const sizedNode = syncLayoutGridNodeColumnSizing(updatedNode, action.key);
        if (sizedNode !== updatedNode) {
          syncedNodes = {
            ...syncedNodes,
            [action.nodeId]: sizedNode,
          };
        }
      }

      syncedNodes = syncLayoutGridSlotChildren(syncedNodes, action.nodeId);
      syncedNodes = normalizeChildrenOrder(syncedNodes, action.nodeId);
      if (action.key === 'dock') {
        syncedNodes = applyLayoutDockPaneHostSync(syncedNodes, action.nodeId);
        const pane = syncedNodes[action.nodeId];
        if (pane?.parentId) {
          syncedNodes = normalizeChildrenOrder(syncedNodes, pane.parentId);
        }
      }
      if (action.key === 'items' && isDesignerTabsNode(syncedNodes[action.nodeId])) {
        syncedNodes = syncDesignerTabPaneChildren(syncedNodes, action.nodeId);
      }

      const syncedState = {
        ...next,
        document: {
          ...next.document,
          nodes: syncedNodes,
        },
      };

      return commitStateMutation(state, syncedState);
    }

    case 'set-grid-toolbar-config': {
      const normalized = normalizeDesignerGridToolbarConfig(action.config);
      const serialized = serializeDesignerGridToolbarConfig(normalized);
      const toolbarActive = normalized.enabled === true;

      const currentNode = getNodeById(state, action.nodeId);
      if (!currentNode) {
        return state;
      }

      const dataSourceRef = getNodeGridListResourceRef(currentNode);
      const existingBinding = currentNode.binding[GRID_LIST_RESOURCE_BINDING_KEY];
      const nextBinding = dataSourceRef
        ? buildGridListBindingWithToolbarQueryParams(
          dataSourceRef,
          toolbarActive ? normalized : undefined,
          existingBinding,
        )
        : undefined;
      const bindingChanged = Boolean(
        nextBinding
        && JSON.stringify(existingBinding?.queryParams ?? {}) !== JSON.stringify(nextBinding.queryParams ?? {}),
      );
      const propChanged = !Object.is(currentNode.props.toolbarConfig, serialized);

      if (!propChanged && !bindingChanged) {
        return state;
      }

      let next = state;
      if (propChanged) {
        next = updateNode(next, action.nodeId, (node) => ({
          ...node,
          props: {
            ...node.props,
            toolbarConfig: serialized,
          },
        }));
      }

      if (bindingChanged && nextBinding) {
        next = updateNode(next, action.nodeId, (node) => ({
          ...node,
          binding: {
            ...node.binding,
            [GRID_LIST_RESOURCE_BINDING_KEY]: nextBinding,
          },
        }));
        invalidateHydrationCache();
      }

      return commitStateMutation(state, next);
    }

    case 'set-node-layout': {
      const next = updateNode(state, action.nodeId, (node) => {
        if (Object.is(node.layout[action.key], action.value)) {
          return null;
        }

        return {
          ...node,
          layout: {
            ...node.layout,
            [action.key]: action.value,
          },
        };
      });
      return commitStateMutation(state, next);
    }

    case 'set-node-visibility': {
      const next = updateNode(state, action.nodeId, (node) => {
        if (node.layout.visible === action.visible) {
          return null;
        }

        return {
          ...node,
          layout: {
            ...node.layout,
            visible: action.visible,
          },
        };
      });
      return commitStateMutation(state, next);
    }

    case 'set-node-source-settings': {
      const next = updateNode(state, action.nodeId, (node) => {
        const nextPropsOverride = action.propsOverride !== undefined
          ? action.propsOverride
          : node.componentRef?.propsOverride;
        const nextSlotProjection = node.componentRef?.slotProjection;

        if (
          node.componentRef?.refType === action.refType &&
          node.componentRef?.refId === action.refId &&
          node.componentRef?.version === action.version &&
          JSON.stringify(node.componentRef?.propsOverride) === JSON.stringify(nextPropsOverride)
        ) {
          return null;
        }

        return {
          ...node,
          componentRef: {
            refType: action.refType,
            refId: action.refId,
            version: action.version,
            ...(nextPropsOverride && Object.keys(nextPropsOverride).length > 0 ? { propsOverride: nextPropsOverride } : {}),
            ...(nextSlotProjection && Object.keys(nextSlotProjection).length > 0 ? { slotProjection: nextSlotProjection } : {}),
          },
        };
      });
      return commitStateMutation(state, next);
    }

    case 'set-node-binding': {
      const next = updateNode(state, action.nodeId, (node) => ({
        ...node,
        binding: {
          ...node.binding,
          [action.bindingKey]: action.definition,
        },
      }));
      return commitStateMutation(state, next);
    }

    case 'remove-node-binding': {
      const next = updateNode(state, action.nodeId, (node) => {
        if (!node.binding[action.bindingKey]) {
          return null;
        }

        const binding = { ...node.binding };
        delete binding[action.bindingKey];

        return {
          ...node,
          binding,
        };
      });
      return commitStateMutation(state, next);
    }

    case 'set-binding-definition': {
      if (
        state.bindingDefinitions.definitions[action.bindingKey]
        && JSON.stringify(state.bindingDefinitions.definitions[action.bindingKey]) === JSON.stringify(action.definition)
      ) {
        return state;
      }

      return commitStateMutation(state, {
        ...state,
        bindingDefinitions: {
          ...state.bindingDefinitions,
          definitions: {
            ...state.bindingDefinitions.definitions,
            [action.bindingKey]: action.definition,
          },
        },
      });
    }

    case 'remove-binding-definition': {
      if (!state.bindingDefinitions.definitions[action.bindingKey]) {
        return state;
      }

      const definitions = { ...state.bindingDefinitions.definitions };
      delete definitions[action.bindingKey];

      return commitStateMutation(state, {
        ...state,
        bindingDefinitions: {
          ...state.bindingDefinitions,
          definitions,
        },
      });
    }

    case 'set-store-segment': {
      const segmentId = action.segmentId.trim();
      if (!segmentId) {
        return state;
      }

      const nextSegment = { ...action.segment, id: segmentId };
      if (
        JSON.stringify(state.bindingDefinitions.storeSegments[segmentId]) === JSON.stringify(nextSegment)
      ) {
        return state;
      }

      return commitStateMutation(state, {
        ...state,
        bindingDefinitions: {
          ...state.bindingDefinitions,
          storeSegments: {
            ...state.bindingDefinitions.storeSegments,
            [segmentId]: nextSegment,
          },
        },
      });
    }

    case 'remove-store-segment': {
      if (!state.bindingDefinitions.storeSegments[action.segmentId]) {
        return state;
      }

      const storeSegments = { ...state.bindingDefinitions.storeSegments };
      delete storeSegments[action.segmentId];

      return commitStateMutation(state, {
        ...state,
        bindingDefinitions: {
          ...state.bindingDefinitions,
          storeSegments,
        },
      });
    }

    case 'set-data-source': {
      const dataSourceId = action.dataSourceId.trim();
      if (!dataSourceId) {
        return state;
      }

      const nextDataSource = { ...action.dataSource, id: dataSourceId };
      if (
        JSON.stringify(state.bindingDefinitions.dataSources[dataSourceId]) === JSON.stringify(nextDataSource)
      ) {
        return state;
      }

      return commitStateMutation(state, {
        ...state,
        bindingDefinitions: {
          ...state.bindingDefinitions,
          dataSources: {
            ...state.bindingDefinitions.dataSources,
            [dataSourceId]: nextDataSource,
          },
        },
      });
    }

    case 'rename-data-source': {
      const previousDataSourceId = action.previousDataSourceId.trim();
      const dataSourceId = action.dataSourceId.trim();
      if (!previousDataSourceId || !dataSourceId || previousDataSourceId === dataSourceId) {
        return state;
      }

      if (!state.bindingDefinitions.dataSources[previousDataSourceId]) {
        return state;
      }

      const nextDataSource = { ...action.dataSource, id: dataSourceId };
      const dataSources = { ...state.bindingDefinitions.dataSources };
      delete dataSources[previousDataSourceId];
      dataSources[dataSourceId] = nextDataSource;

      return commitStateMutation(state, {
        ...state,
        document: remapDataSourceReferencesInDocument(state.document, previousDataSourceId, dataSourceId),
        bindingDefinitions: {
          ...state.bindingDefinitions,
          dataSources,
        },
      });
    }

    case 'remove-data-source': {
      if (!state.bindingDefinitions.dataSources[action.dataSourceId]) {
        return state;
      }

      const dataSources = { ...state.bindingDefinitions.dataSources };
      delete dataSources[action.dataSourceId];

      return commitStateMutation(state, {
        ...state,
        bindingDefinitions: {
          ...state.bindingDefinitions,
          dataSources,
        },
      });
    }

    case 'set-lov': {
      const lovId = action.lovId.trim();
      if (!lovId) {
        return state;
      }

      const nextLov = { ...action.lov, id: lovId };
      if (JSON.stringify(state.bindingDefinitions.lovs[lovId]) === JSON.stringify(nextLov)) {
        return state;
      }

      return commitStateMutation(state, {
        ...state,
        bindingDefinitions: {
          ...state.bindingDefinitions,
          lovs: {
            ...state.bindingDefinitions.lovs,
            [lovId]: nextLov,
          },
        },
      });
    }

    case 'remove-lov': {
      if (!state.bindingDefinitions.lovs[action.lovId]) {
        return state;
      }

      const lovs = { ...state.bindingDefinitions.lovs };
      delete lovs[action.lovId];

      return commitStateMutation(state, {
        ...state,
        bindingDefinitions: {
          ...state.bindingDefinitions,
          lovs,
        },
      });
    }

    case 'undo': {
      const previous = state.history.past[state.history.past.length - 1];
      if (!previous) {
        return state;
      }

      const current = snapshotState(state);
      const past = state.history.past.slice(0, -1);

      return withDiagnostics({
        ...state,
        document: cloneDocument(previous.document),
        bindingDefinitions: cloneBindingDefinitionsState(previous.bindingDefinitions),
        selectedNodeId: previous.selectedNodeId,
        selectedNodeIds: previous.selectedNodeIds,
        history: {
          ...state.history,
          past,
          future: [current, ...state.history.future],
        },
        isDirty: true,
      });
    }

    case 'redo': {
      const nextSnapshot = state.history.future[0];
      if (!nextSnapshot) {
        return state;
      }

      const current = snapshotState(state);
      const future = state.history.future.slice(1);

      return withDiagnostics({
        ...state,
        document: cloneDocument(nextSnapshot.document),
        bindingDefinitions: cloneBindingDefinitionsState(nextSnapshot.bindingDefinitions),
        selectedNodeId: nextSnapshot.selectedNodeId,
        selectedNodeIds: nextSnapshot.selectedNodeIds,
        history: {
          ...state.history,
          past: [...state.history.past, current],
          future,
        },
        isDirty: true,
      });
    }

    case 'set-document-allowed-roles': {
      const next = action.allowedRoles.filter((r) => typeof r === 'string' && r.trim());
      const current = state.document.allowedRoles ?? [];
      if (JSON.stringify(current) === JSON.stringify(next)) {
        return state;
      }

      return commitStateMutation(state, {
        ...state,
        document: {
          ...state.document,
          allowedRoles: next.length > 0 ? next : undefined,
          pageAccess: next.length > 0
            ? normalizeFunctionAccessControl({
              accessMode: 'specific',
              allowRoles: next,
              allowUsers: [],
              denyRoles: [],
              denyUsers: [],
            })
            : undefined,
        },
      });
    }

    case 'set-document-page-access': {
      const next = normalizeFunctionAccessControl(action.pageAccess);
      const current = state.document.pageAccess
        ? normalizeFunctionAccessControl(state.document.pageAccess)
        : null;
      if (current && JSON.stringify(current) === JSON.stringify(next)) {
        return state;
      }

      return commitStateMutation(state, {
        ...state,
        document: {
          ...state.document,
          pageAccess: next,
          allowedRoles: deriveDesignerLegacyAllowedRoles(next),
        },
      });
    }

    case 'set-shell-layout-width': {
      const currentWidth = readShellLayoutWidth(state.document);
      const currentMax = readShellBoundedMaxWidth(state.document);
      const currentEdge = readShellBoundedEdge(state.document);
      const currentUserControl = readShellLayoutWidthUserControl(state.document);
      const nextMax = action.boundedMaxWidth ?? currentMax;
      const nextEdge = action.boundedEdge ?? currentEdge;
      const nextUserControl = action.layoutWidthUserControl ?? currentUserControl;
      if (
        currentWidth === action.layoutWidth
        && currentMax === nextMax
        && currentEdge === nextEdge
        && currentUserControl === nextUserControl
      ) {
        return state;
      }
      const nextDocument = applyShellLayoutSettingsToDocument(state.document, {
        layoutWidth: action.layoutWidth,
        boundedMaxWidth: nextMax,
        boundedEdge: nextEdge,
        layoutWidthUserControl: nextUserControl,
      });
      return commitStateMutation(state, {
        ...state,
        document: nextDocument,
      });
    }

    case 'set-node-visibility-access': {
      const patch = buildNodeVisibilityLayoutPatch(action.visibilityAccess);
      const next = updateNode(state, action.nodeId, (node) => {
        const nextLayout = {
          ...node.layout,
          ...patch,
        };
        if (JSON.stringify(node.layout) === JSON.stringify(nextLayout)) {
          return null;
        }

        return {
          ...node,
          layout: nextLayout,
        };
      });
      return commitStateMutation(state, next);
    }

    case 'set-node-visible-condition': {
      const next = updateNode(state, action.nodeId, (node) => {
        const nextLayout = {
          ...node.layout,
          visibleCondition: action.visibleCondition,
          [NODE_VISIBILITY_ACCESS_LAYOUT_KEY]: undefined,
        };
        if (JSON.stringify(node.layout) === JSON.stringify(nextLayout)) {
          return null;
        }

        return {
          ...node,
          layout: nextLayout,
        };
      });
      return commitStateMutation(state, next);
    }

    case 'sync-list-item-texts':
      return commitStateMutation(state, syncListItemTexts(state, action.listNodeId, action.texts));

    case 'validate-document':
      return withDiagnostics(state);

    case 'add-canvas-comment': {
      if (state.canvasComments.some((item) => item.id === action.comment.id)) {
        return state;
      }
      return {
        ...state,
        canvasComments: [...state.canvasComments, action.comment],
      };
    }

    case 'hydrate-canvas-comments':
      return {
        ...state,
        canvasComments: Array.isArray(action.comments) ? action.comments : [],
      };

    case 'resolve-canvas-comment': {
      const index = state.canvasComments.findIndex((item) => item.id === action.commentId);
      if (index < 0) {
        return state;
      }
      const existing = state.canvasComments[index]!;
      if (existing.resolvedAt) {
        return state;
      }
      const nextComments = state.canvasComments.map((item, i) => (
        i === index
          ? { ...item, resolvedAt: action.resolvedAt, resolvedBy: action.resolvedBy }
          : item
      ));
      return {
        ...state,
        canvasComments: nextComments,
      };
    }

    default:
      return state;
  }
};
