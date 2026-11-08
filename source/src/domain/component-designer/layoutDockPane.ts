import {
  isLeadingUiDockPane,
  isVerticalUiDockPane,
  readUiDockPaneDock,
  type UiDockPaneDock,
} from '../../shared/ui/UiDockPane';
import { LAYOUT_DOCK_PANE_PALETTE_ITEM_ID } from './layoutPaletteConstants';
import { getNodePaletteItemId } from './runtimeShared';
import { syncTailwindPropKeys } from './tailwindClasses';
import type { DesignerNode } from './types';

export const LAYOUT_DOCK_HOST_PROP = '_designerDockHost';

export type LayoutDockEdge = UiDockPaneDock;

export const readLayoutDockEdge = readUiDockPaneDock;

export const isVerticalLayoutDock = isVerticalUiDockPane;

export const isLeadingLayoutDock = isLeadingUiDockPane;

export const isLayoutDockPaneNode = (node: DesignerNode): boolean =>
  getNodePaletteItemId(node) === LAYOUT_DOCK_PANE_PALETTE_ITEM_ID;

export const isDesignerDockHostNode = (node: DesignerNode): boolean =>
  node.props[LAYOUT_DOCK_HOST_PROP] === true || node.props[LAYOUT_DOCK_HOST_PROP] === 'true';

export const layoutDockHostPaletteItemId = (
  dock: LayoutDockEdge,
): 'layout.flex-row' | 'layout.flex-column' =>
  isVerticalLayoutDock(dock) ? 'layout.flex-column' : 'layout.flex-row';

export const layoutDockHostClassName = (dock: LayoutDockEdge): string =>
  isVerticalLayoutDock(dock)
    ? 'flex h-full min-h-0 w-full flex-col items-stretch'
    : 'flex h-full min-h-0 w-full flex-row items-stretch';

export const applyLayoutDockPaneHostSync = (
  nodes: Record<string, DesignerNode>,
  paneId: string,
): Record<string, DesignerNode> => {
  const pane = nodes[paneId];
  if (!pane || !isLayoutDockPaneNode(pane) || !pane.parentId) {
    return nodes;
  }

  const parent = nodes[pane.parentId];
  if (!parent || !isDesignerDockHostNode(parent)) {
    return nodes;
  }

  const dock = readLayoutDockEdge(pane.props.dock);
  const className = layoutDockHostClassName(dock);
  const paletteId = layoutDockHostPaletteItemId(dock);
  const otherIds = parent.children.filter((id) => id !== paneId);
  const children = isLeadingLayoutDock(dock) ? [paneId, ...otherIds] : [...otherIds, paneId];
  const nextParent: DesignerNode = {
    ...parent,
    props: {
      ...parent.props,
      _designerPaletteItemId: paletteId,
      className,
      ...syncTailwindPropKeys(className),
      [LAYOUT_DOCK_HOST_PROP]: true,
    },
    children,
  };

  if (
    nextParent.props._designerPaletteItemId === parent.props._designerPaletteItemId
    && nextParent.props.className === parent.props.className
    && nextParent.children.join('\0') === parent.children.join('\0')
  ) {
    return nodes;
  }

  return {
    ...nodes,
    [parent.id]: nextParent,
  };
};
