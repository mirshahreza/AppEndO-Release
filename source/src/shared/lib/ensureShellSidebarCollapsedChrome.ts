import type { DesignerDocument, DesignerNode } from '../../domain/component-designer/types';
import {
  ADMIN_SHELL_SIDEBAR_INSET_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS,
  ADMIN_SHELL_SIDEBAR_NAV_HOST_CLASS,
} from '../ui/surfaceClasses';

const mergeClassTokens = (className: string, required: string): string => {
  const tokens = new Set(className.split(/\s+/).map((token) => token.trim()).filter(Boolean));
  for (const token of required.split(/\s+/)) {
    if (token.trim()) {
      tokens.add(token.trim());
    }
  }
  return [...tokens].join(' ');
};

const isSidebarRoot = (node: DesignerNode): boolean => {
  if (node.props.id === 'admin-shell-sidebar') {
    return true;
  }
  const className = typeof node.props.className === 'string' ? node.props.className : '';
  return className.split(/\s+/).includes('designer-shell-sidebar');
};

const isPlatformNavNode = (node: DesignerNode): boolean => node.type === 'platform-nav';

const collectDescendantIds = (document: DesignerDocument, rootId: string): Set<string> => {
  const ids = new Set<string>();
  const visit = (parentId: string) => {
    for (const node of Object.values(document.nodes)) {
      if (node.parentId !== parentId) {
        continue;
      }
      ids.add(node.id);
      visit(node.id);
    }
  };
  visit(rootId);
  return ids;
};

const patchNodeClassName = (
  nodes: Record<string, DesignerNode>,
  nodeId: string,
  patch: (className: string) => string,
): boolean => {
  const node = nodes[nodeId];
  if (!node || node.type !== 'container') {
    return false;
  }
  const className = typeof node.props.className === 'string' ? node.props.className : '';
  const nextClassName = patch(className);
  if (nextClassName === className) {
    return false;
  }
  nodes[nodeId] = {
    ...node,
    props: { ...node.props, className: nextClassName },
  };
  return true;
};

/**
 * Published designer shells kept `px-[16px]` on the nav host when the sidebar rail is 81px wide,
 * so collapsed RTL labels and icons overlapped. Adds semantic hooks for collapsed padding CSS.
 */
export function ensureShellSidebarCollapsedChrome(document: DesignerDocument): DesignerDocument {
  const sidebarRoot = Object.values(document.nodes).find(isSidebarRoot);
  if (!sidebarRoot) {
    return document;
  }

  const descendantIds = collectDescendantIds(document, sidebarRoot.id);
  const nodes = { ...document.nodes };
  let changed = false;

  for (const nodeId of descendantIds) {
    const node = nodes[nodeId];
    if (!node || node.type !== 'container' || typeof node.props.className !== 'string') {
      continue;
    }

    const className = node.props.className;
    const hostsPlatformNav = Object.values(nodes).some(
      (candidate) => candidate.parentId === nodeId && isPlatformNavNode(candidate),
    );

    if (hostsPlatformNav) {
      changed = patchNodeClassName(nodes, nodeId, (value) =>
        mergeClassTokens(value, ADMIN_SHELL_SIDEBAR_NAV_HOST_CLASS),
      ) || changed;
      continue;
    }

    if (className.includes('h-[91px]') && className.includes('py-[11px]')) {
      changed = patchNodeClassName(nodes, nodeId, (value) =>
        mergeClassTokens(value, ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS),
      ) || changed;
      continue;
    }

    if (className.includes('shrink-0') && className.includes('px-[16px]') && !className.includes('flex-1')) {
      changed = patchNodeClassName(nodes, nodeId, (value) =>
        mergeClassTokens(value, ADMIN_SHELL_SIDEBAR_INSET_CLASS),
      ) || changed;
    }
  }

  return changed ? { ...document, nodes } : document;
}
