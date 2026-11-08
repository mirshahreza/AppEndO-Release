import type { DesignerDocument, DesignerNode } from './types';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';

export const SHELL_NOT_FOUND_PALETTE_ITEM_ID = 'shell.not-found';
export const SHELL_ERROR_PAGE_PALETTE_ITEM_ID = 'shell.error-page';

function nodePaletteItemId(node: DesignerNode | undefined): string | null {
  if (!node) return null;
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim() ? stored.trim() : null;
}

/** True when the designer document contains a `shell.not-found` palette template node. */
export function documentContainsShellNotFoundTemplate(document: DesignerDocument): boolean {
  return Object.values(document.nodes).some(
    (node) => nodePaletteItemId(node) === SHELL_NOT_FOUND_PALETTE_ITEM_ID,
  );
}

/** True when the designer document contains a `shell.error-page` palette template node. */
export function documentContainsShellErrorPageTemplate(document: DesignerDocument): boolean {
  return Object.values(document.nodes).some(
    (node) => nodePaletteItemId(node) === SHELL_ERROR_PAGE_PALETTE_ITEM_ID,
  );
}
