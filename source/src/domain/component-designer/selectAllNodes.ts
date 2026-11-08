import type { DesignerDocument } from './types';

/**
 * Canvas objects targeted by Ctrl+A: direct children of the document root.
 * Nested nodes stay unselected so the outline matches top-level objects.
 */
export function collectDesignerSelectAllNodeIds(document: DesignerDocument): string[] {
  const root = document.nodes[document.rootNodeId];
  if (!root) {
    return [];
  }
  return root.children.filter((id) => Boolean(document.nodes[id]));
}
