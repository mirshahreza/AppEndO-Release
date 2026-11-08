import { describe, expect, it } from 'vitest';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import {
  ensureShellSideNavFillHeight,
  SHELL_SIDE_NAV_HOST_CLASS,
} from '../ensureShellSideNavFillHeight';

const buildDocument = (): DesignerDocument => ({
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'container',
      parentId: null,
      children: ['host'],
      props: { className: '' },
    },
    host: {
      id: 'host',
      type: 'container',
      parentId: 'root',
      children: ['nav'],
      props: { className: 'flex-1 min-h-0 overflow-hidden pt-2 pb-2 px-[16px]' },
    },
    nav: {
      id: 'nav',
      type: 'platform-nav',
      parentId: 'host',
      children: [],
      props: { className: 'min-h-0' },
    },
  },
});

describe('ensureShellSideNavFillHeight', () => {
  it('adds flex-col to legacy side-nav host containers', () => {
    const patched = ensureShellSideNavFillHeight(buildDocument());
    expect(patched.nodes.host?.props.className).toBe(SHELL_SIDE_NAV_HOST_CLASS);
    expect(patched.nodes.nav?.props.className).toContain('h-full');
    expect(patched.nodes.nav?.props.className).toContain('flex-1');
  });

  it('is idempotent', () => {
    const once = ensureShellSideNavFillHeight(buildDocument());
    const twice = ensureShellSideNavFillHeight(once);
    expect(twice).toBe(once);
  });
});
