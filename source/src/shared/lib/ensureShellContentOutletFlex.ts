import type { DesignerDocument, DesignerNode } from '../../domain/component-designer/types';
import { SHELL_CHROME_HEADER } from './shellChromeSlots';
import { SHELL_HEADER_SHOW_LOGO_PROP } from './shellHeaderProps';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from './shellRouteOutlet';

/** Legacy admin-shell workspace scroll host — block layout lets the outlet hug content (~0 grid height). */
export const LEGACY_SHELL_CONTENT_SCROLL_HOST_CLASS = 'flex-1 min-h-0 overflow-auto';

/** Fills the content host and passes height to the route outlet + fill-height pages. */
export const SHELL_CONTENT_SCROLL_HOST_CLASS = 'flex flex-col flex-1 min-h-0 overflow-hidden';

export const SHELL_ROUTE_OUTLET_SLOT_CLASS =
  'flex min-h-0 min-w-0 w-full flex-1 flex-col h-full';

const mergeClassTokens = (className: string, required: string): string => {
  const tokens = new Set(className.split(/\s+/).map((token) => token.trim()).filter(Boolean));
  for (const token of required.split(/\s+/)) {
    if (token.trim()) {
      tokens.add(token.trim());
    }
  }
  return [...tokens].join(' ');
};

const isRouteOutletSlot = (node: DesignerNode): boolean =>
  node.type === 'system-slot'
  && typeof node.props.slotId === 'string'
  && node.props.slotId.trim() === SHELL_ROUTE_OUTLET_SLOT_ID;

const normalizeScrollHostClassName = (className: string): string => {
  const trimmed = className.trim();
  if (!trimmed) {
    return SHELL_CONTENT_SCROLL_HOST_CLASS;
  }
  if (trimmed.includes('flex-col') && trimmed.includes('overflow-hidden')) {
    return trimmed;
  }
  if (trimmed === LEGACY_SHELL_CONTENT_SCROLL_HOST_CLASS || trimmed.includes(LEGACY_SHELL_CONTENT_SCROLL_HOST_CLASS)) {
    return trimmed.replaceAll(LEGACY_SHELL_CONTENT_SCROLL_HOST_CLASS, SHELL_CONTENT_SCROLL_HOST_CLASS);
  }
  return mergeClassTokens(
    trimmed.replace(/\boverflow-auto\b/g, 'overflow-hidden'),
    'flex flex-col',
  );
};

/**
 * Published designer shells (studio-shell, hawiety portal layout, …) used a block
 * `overflow-auto` host around the route outlet. Fill-height grids then collapsed to
 * header+footer height with an empty virtualized tbody.
 */
export function ensureShellContentOutletFlex(document: DesignerDocument): DesignerDocument {
  const outletSlot = Object.values(document.nodes).find(isRouteOutletSlot);
  if (!outletSlot?.parentId) {
    return document;
  }

  const scrollHost = document.nodes[outletSlot.parentId];
  if (!scrollHost) {
    return document;
  }

  const nodes = { ...document.nodes };
  let changed = false;

  const nextScrollClass = normalizeScrollHostClassName(
    typeof scrollHost.props.className === 'string' ? scrollHost.props.className : '',
  );
  if (nextScrollClass !== scrollHost.props.className) {
    nodes[scrollHost.id] = {
      ...scrollHost,
      props: { ...scrollHost.props, className: nextScrollClass },
    };
    changed = true;
  }

  const outletClass = typeof outletSlot.props.className === 'string'
    ? outletSlot.props.className.trim()
    : '';
  if (outletClass !== SHELL_ROUTE_OUTLET_SLOT_CLASS) {
    nodes[outletSlot.id] = {
      ...outletSlot,
      props: { ...outletSlot.props, className: SHELL_ROUTE_OUTLET_SLOT_CLASS },
    };
    changed = true;
  }

  const headerSlot = Object.values(nodes).find(
    (node) => node.type === 'system-slot'
      && typeof node.props.slotId === 'string'
      && node.props.slotId.trim() === SHELL_CHROME_HEADER,
  );
  if (headerSlot && headerSlot.props[SHELL_HEADER_SHOW_LOGO_PROP] !== false) {
    nodes[headerSlot.id] = {
      ...headerSlot,
      props: { ...headerSlot.props, [SHELL_HEADER_SHOW_LOGO_PROP]: false },
    };
    changed = true;
  }

  return changed ? { ...document, nodes } : document;
}
