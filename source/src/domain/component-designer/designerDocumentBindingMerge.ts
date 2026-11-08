import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import type { DesignerDocument, DesignerNode } from './types';

export const mergeEmbeddedDocumentBindings = (
  embedded: DesignerDocument,
  reconciled: DesignerDocument,
): DesignerDocument => {
  const embeddedByName = new Map<string, DesignerNode>();

  for (const node of Object.values(embedded.nodes)) {
    const name = typeof node.props.name === 'string' ? node.props.name.trim() : '';
    if (name) {
      embeddedByName.set(name, node);
    }
  }

  const nodes = { ...reconciled.nodes };

  for (const [nodeId, node] of Object.entries(nodes)) {
    const name = typeof node.props.name === 'string' ? node.props.name.trim() : '';
    if (!name) {
      continue;
    }

    const embeddedNode = embeddedByName.get(name);
    if (!embeddedNode) {
      continue;
    }

    const mergedBinding = { ...node.binding };
    for (const [bindingKey, definition] of Object.entries(embeddedNode.binding)) {
      if (!mergedBinding[bindingKey]) {
        mergedBinding[bindingKey] = definition;
      }
    }

    const embeddedPalette = embeddedNode.props[DESIGNER_PALETTE_ITEM_ID_PROP];
    const props = { ...node.props };
    if (embeddedPalette === 'heroui.select' && props[DESIGNER_PALETTE_ITEM_ID_PROP] !== 'heroui.select') {
      props[DESIGNER_PALETTE_ITEM_ID_PROP] = 'heroui.select';
      delete props._jsxSourceTag;
    }

    nodes[nodeId] = {
      ...node,
      props,
      binding: mergedBinding,
    };
  }

  return {
    ...reconciled,
    nodes,
  };
};
