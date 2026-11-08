import type { DesignerDocument, DesignerNode } from '../../domain/component-designer/types';
import { ADMIN_SHELL_SIDEBAR_NAV_HOST_CONTAINER_CLASS } from '../ui/adminShellSidebarMetrics';

/** Side nav host in published admin shells — must be a flex column so fill-height TreeNav can stretch. */
export const SHELL_SIDE_NAV_HOST_CLASS = ADMIN_SHELL_SIDEBAR_NAV_HOST_CONTAINER_CLASS;

export const SHELL_PLATFORM_NAV_CLASS = 'flex min-h-0 flex-1 flex-col h-full w-full';

const LEGACY_SIDE_NAV_HOST_MARKERS = [
  'flex-1 min-h-0 overflow-hidden pt-2 pb-2 px-[16px]',
  'flex-1 min-h-0 overflow-hidden pt-2 pb-2',
  'flex flex-col flex-1 min-h-0 overflow-hidden pt-2 pb-2 px-[16px]',
];

const mergeClassTokens = (className: string, required: string): string => {
  const tokens = new Set(className.split(/\s+/).map((token) => token.trim()).filter(Boolean));
  for (const token of required.split(/\s+/)) {
    if (token.trim()) {
      tokens.add(token.trim());
    }
  }
  return [...tokens].join(' ');
};

const isPlatformNavNode = (node: DesignerNode): boolean => node.type === 'platform-nav';

const normalizeSideNavHostClassName = (className: string): string => {
  const trimmed = className.trim();
  if (trimmed === SHELL_SIDE_NAV_HOST_CLASS) {
    return trimmed;
  }
  if (
    trimmed.includes('admin-shell-sidebar-nav-host')
    && trimmed.includes('pt-2')
  ) {
    return SHELL_SIDE_NAV_HOST_CLASS;
  }
  for (const marker of LEGACY_SIDE_NAV_HOST_MARKERS) {
    if (trimmed.includes(marker) || trimmed === marker) {
      return SHELL_SIDE_NAV_HOST_CLASS;
    }
  }
  return mergeClassTokens(trimmed, 'flex flex-col flex-1 min-h-0 overflow-hidden');
};

const normalizePlatformNavClassName = (className: string): string => {
  const trimmed = className.trim();
  if (
    trimmed.includes('flex-1')
    && trimmed.includes('flex-col')
    && trimmed.includes('h-full')
  ) {
    return trimmed;
  }
  return mergeClassTokens(trimmed || 'min-h-0', SHELL_PLATFORM_NAV_CLASS);
};

/**
 * Published designer shells omitted `flex flex-col` on the side-nav host, so TreeNav
 * `fillHeight` could not push trailing groups to the bottom of the sidebar.
 */
export function ensureShellSideNavFillHeight(document: DesignerDocument): DesignerDocument {
  const platformNavParentIds = new Set(
    Object.values(document.nodes)
      .filter(isPlatformNavNode)
      .map((node) => node.parentId)
      .filter((parentId): parentId is string => Boolean(parentId)),
  );

  const nodes = { ...document.nodes };
  let changed = false;

  for (const node of Object.values(document.nodes)) {
    if (node.type !== 'container' || typeof node.props.className !== 'string') {
      continue;
    }
    if (!platformNavParentIds.has(node.id)) {
      continue;
    }
    const nextHostClass = normalizeSideNavHostClassName(node.props.className);
    if (nextHostClass !== node.props.className) {
      nodes[node.id] = {
        ...node,
        props: { ...node.props, className: nextHostClass },
      };
      changed = true;
    }
  }

  for (const node of Object.values(document.nodes)) {
    if (!isPlatformNavNode(node)) {
      continue;
    }
    const className = typeof node.props.className === 'string' ? node.props.className : '';
    const nextNavClass = normalizePlatformNavClassName(className);
    if (nextNavClass !== className) {
      nodes[node.id] = {
        ...node,
        props: { ...node.props, className: nextNavClass },
      };
      changed = true;
    }
  }

  return changed ? { ...document, nodes } : document;
}
