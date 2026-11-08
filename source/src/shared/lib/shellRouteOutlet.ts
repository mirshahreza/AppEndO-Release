import type { DesignerDocument } from '../../domain/component-designer/types';

export const SHELL_ROUTE_OUTLET_SLOT_ID = 'core.shell.route-outlet';

export function documentHasShellRouteOutletSlot(document: DesignerDocument): boolean {
  return Object.values(document.nodes).some(
    (node) => node.type === 'system-slot'
      && typeof node.props.slotId === 'string'
      && node.props.slotId.trim() === SHELL_ROUTE_OUTLET_SLOT_ID,
  );
}

/** Inject route-outlet slot into legacy app-shell workspace placeholders. */
export function ensureShellRouteOutletSlot(document: DesignerDocument): DesignerDocument {
  if (documentHasShellRouteOutletSlot(document)) {
    return document;
  }

  const workspaceTextNode = Object.values(document.nodes).find(
    (node) => node.type === 'text'
      && typeof node.props.text === 'string'
      && node.props.text.trim() === 'Workspace',
  );
  if (!workspaceTextNode?.parentId) {
    return document;
  }

  const parent = document.nodes[workspaceTextNode.parentId];
  if (!parent) {
    return document;
  }

  const slotNodeId = `shell-route-outlet-${workspaceTextNode.id}`;
  const nodes = { ...document.nodes };

  nodes[parent.id] = {
    ...parent,
    children: parent.children.map((childId) => (
      childId === workspaceTextNode.id ? slotNodeId : childId
    )),
  };

  const { [workspaceTextNode.id]: _removed, ...remainingNodes } = nodes;
  void _removed;

  remainingNodes[slotNodeId] = {
    id: slotNodeId,
    type: 'system-slot',
    parentId: parent.id,
    order: workspaceTextNode.order,
    props: {
      slotId: SHELL_ROUTE_OUTLET_SLOT_ID,
      className: 'min-h-0 flex-1',
    },
    layout: {},
    binding: {},
    children: [],
  };

  return {
    ...document,
    nodes: remainingNodes,
  };
}
