import type { DesignerDocument, DesignerNode } from '../../domain/component-designer/types';
import {
  CMS_SITE_CTA_SLOT,
  CMS_SITE_NAV_SLOT,
} from './cmsSiteSlots';
import { SITE_SHELL_LAYOUT_KEY } from '../api/contracts/platform/mountConstants';

const HEADER_INNER_CLASS = 'site-shell-header-inner';
const HEADER_CONTROLS_CLASS = 'site-shell-header-controls';

function isSiteShellDocument(document: DesignerDocument): boolean {
  return Object.values(document.nodes).some((node) => {
    const className = typeof node.props.className === 'string' ? node.props.className : '';
    return className.split(/\s+/).includes('site-shell');
  });
}

function slotId(node: DesignerNode): string | null {
  if (node.type !== 'system-slot' || typeof node.props.slotId !== 'string') {
    return null;
  }
  return node.props.slotId.trim();
}

/** Group CMS nav + CTA slots under `site-shell-header-controls` on legacy published site shells. */
export function ensureSiteShellHeaderControls(
  document: DesignerDocument,
  shellKey: string,
): DesignerDocument {
  if (shellKey.trim() !== SITE_SHELL_LAYOUT_KEY || !isSiteShellDocument(document)) {
    return document;
  }

  const headerInner = Object.values(document.nodes).find((node) => {
    const className = typeof node.props.className === 'string' ? node.props.className : '';
    return className.split(/\s+/).includes(HEADER_INNER_CLASS);
  });
  if (!headerInner) {
    return document;
  }

  const hasControls = headerInner.children.some((childId) => {
    const child = document.nodes[childId];
    if (!child) {
      return false;
    }
    const className = typeof child.props.className === 'string' ? child.props.className : '';
    return className.split(/\s+/).includes(HEADER_CONTROLS_CLASS);
  });
  if (hasControls) {
    return document;
  }

  const navChildId = headerInner.children.find((childId) => slotId(document.nodes[childId]!) === CMS_SITE_NAV_SLOT);
  const ctaChildId = headerInner.children.find((childId) => slotId(document.nodes[childId]!) === CMS_SITE_CTA_SLOT);
  if (!navChildId || !ctaChildId) {
    return document;
  }

  const controlsId = `site-shell-header-controls-${headerInner.id}`;
  const nodes = { ...document.nodes };
  const navNode = nodes[navChildId];
  const ctaNode = nodes[ctaChildId];
  if (!navNode || !ctaNode) {
    return document;
  }

  nodes[headerInner.id] = {
    ...headerInner,
    children: headerInner.children.filter((id) => id !== navChildId && id !== ctaChildId).concat(controlsId),
  };

  nodes[controlsId] = {
    id: controlsId,
    type: 'container',
    parentId: headerInner.id,
    order: Math.max(navNode.order, ctaNode.order),
    props: {
      className: HEADER_CONTROLS_CLASS,
    },
    layout: {},
    binding: {},
    children: [navChildId, ctaChildId],
  };

  nodes[navChildId] = { ...navNode, parentId: controlsId };
  nodes[ctaChildId] = { ...ctaNode, parentId: controlsId };

  return { ...document, nodes };
}
