import { describe, expect, it } from 'vitest';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import { ADMIN_SHELL_ROOT_CLASS } from '../../ui/surfaceClasses';
import { ensureShellAdminRootChrome } from '../ensureShellAdminRootChrome';

const buildDocument = (): DesignerDocument => ({
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'container',
      parentId: null,
      children: [],
      props: { className: ADMIN_SHELL_ROOT_CLASS },
    },
  },
});

describe('ensureShellAdminRootChrome', () => {
  it('adds data-admin-shell-root to the admin shell root container', () => {
    const patched = ensureShellAdminRootChrome(buildDocument());
    const extra = patched.nodes.root?.props.htmlExtraAttrs;
    expect(extra).toContain('data-admin-shell-root');
    expect(ensureShellAdminRootChrome(patched)).toBe(patched);
  });
});
