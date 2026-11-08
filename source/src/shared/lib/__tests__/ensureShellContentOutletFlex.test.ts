import { describe, expect, it } from 'vitest';
import {
  ensureShellContentOutletFlex,
  LEGACY_SHELL_CONTENT_SCROLL_HOST_CLASS,
  SHELL_CONTENT_SCROLL_HOST_CLASS,
  SHELL_ROUTE_OUTLET_SLOT_CLASS,
} from '../ensureShellContentOutletFlex';
import { SHELL_CHROME_HEADER } from '../shellChromeSlots';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from '../shellRouteOutlet';
import type { DesignerDocument } from '../../../domain/component-designer/types';

const buildDocument = (): DesignerDocument => ({
  schemaVersion: '1.0.0',
  id: 'shell-doc',
  name: 'shell',
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'root',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: ['scroll-host'],
    },
    'scroll-host': {
      id: 'scroll-host',
      type: 'container',
      parentId: 'root',
      order: 0,
      props: { className: LEGACY_SHELL_CONTENT_SCROLL_HOST_CLASS },
      layout: {},
      binding: {},
      children: ['outlet'],
    },
    outlet: {
      id: 'outlet',
      type: 'system-slot',
      parentId: 'scroll-host',
      order: 0,
      props: { slotId: SHELL_ROUTE_OUTLET_SLOT_ID, className: 'min-h-0 flex-1' },
      layout: {},
      binding: {},
      children: [],
    },
  },
  metadata: { createdAt: '', updatedAt: '' },
  diagnostics: [],
});

describe('ensureShellContentOutletFlex', () => {
  it('upgrades legacy scroll host and outlet slot classes', () => {
    const patched = ensureShellContentOutletFlex(buildDocument());
    expect(patched.nodes['scroll-host']?.props.className).toBe(SHELL_CONTENT_SCROLL_HOST_CLASS);
    expect(patched.nodes.outlet?.props.className).toBe(SHELL_ROUTE_OUTLET_SLOT_CLASS);
  });

  it('is idempotent', () => {
    const once = ensureShellContentOutletFlex(buildDocument());
    const twice = ensureShellContentOutletFlex(once);
    expect(twice).toEqual(once);
  });

  it('disables duplicate header logo when sidebar already has brand chrome', () => {
    const doc = buildDocument();
    doc.nodes.header = {
      id: 'header',
      type: 'system-slot',
      parentId: 'root',
      order: 1,
      props: { slotId: SHELL_CHROME_HEADER },
      layout: {},
      binding: {},
      children: [],
    };
    doc.nodes.root.children.push('header');
    const patched = ensureShellContentOutletFlex(doc);
    expect(patched.nodes.header?.props.showLogo).toBe(false);
  });
});
