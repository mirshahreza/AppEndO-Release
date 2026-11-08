import type { DesignerDocument, DesignerNode } from '../../domain/component-designer/types';
import { ADMIN_SHELL_ROOT_CLASS } from '../ui/surfaceClasses';
import { parseHtmlExtraAttrs } from '../../domain/component-designer/domProps';

const ADMIN_SHELL_ROOT_MARKER = 'shell-atmosphere';
const ADMIN_SHELL_ROOT_DATA_ATTR = 'data-admin-shell-root';

const isAdminShellRootNode = (node: DesignerNode): boolean => {
  if (node.type !== 'container' || typeof node.props.className !== 'string') {
    return false;
  }
  const tokens = node.props.className.split(/\s+/);
  return tokens.includes(ADMIN_SHELL_ROOT_MARKER)
    && node.props.className.includes('admin-shell-surface');
};

const mergeAdminShellRootExtraAttrs = (node: DesignerNode): string | null => {
  const extra = parseHtmlExtraAttrs(node.props.htmlExtraAttrs);
  if (extra[ADMIN_SHELL_ROOT_DATA_ATTR]) {
    return null;
  }
  extra[ADMIN_SHELL_ROOT_DATA_ATTR] = 'true';
  return JSON.stringify(extra);
};

/**
 * Published admin shells should expose the same root marker as React `AdminLayout`
 * so `dir`, collapsed rail, and atmosphere selectors target one shell root.
 */
export function ensureShellAdminRootChrome(document: DesignerDocument): DesignerDocument {
  const root = document.nodes[document.rootNodeId];
  const shellRoot = root && isAdminShellRootNode(root)
    ? root
    : Object.values(document.nodes).find(isAdminShellRootNode);

  if (!shellRoot) {
    return document;
  }

  const nextExtraAttrs = mergeAdminShellRootExtraAttrs(shellRoot);
  if (!nextExtraAttrs) {
    return document;
  }

  const className = typeof shellRoot.props.className === 'string'
    ? shellRoot.props.className
    : ADMIN_SHELL_ROOT_CLASS;

  const nodes = {
    ...document.nodes,
    [shellRoot.id]: {
      ...shellRoot,
      props: {
        ...shellRoot.props,
        className: className.includes('admin-shell-surface') ? className : ADMIN_SHELL_ROOT_CLASS,
        htmlExtraAttrs: nextExtraAttrs,
      },
    },
  };

  return { ...document, nodes };
}
