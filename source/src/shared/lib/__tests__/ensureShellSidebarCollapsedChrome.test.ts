import { describe, expect, it } from 'vitest';
import { createStateFromAdminShellLayoutTemplate } from '../../../domain/component-designer/layout-presets/adminShellLayoutTemplate';
import {
  ADMIN_SHELL_SIDEBAR_INSET_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS,
  ADMIN_SHELL_SIDEBAR_NAV_HOST_CLASS,
} from '../../ui/surfaceClasses';
import { ensureShellSidebarCollapsedChrome } from '../ensureShellSidebarCollapsedChrome';

describe('ensureShellSidebarCollapsedChrome', () => {
  it('tags logo, portal inset, and nav host regions in the admin shell template', () => {
    const initial = createStateFromAdminShellLayoutTemplate();
    const withoutMarkers = Object.fromEntries(
      Object.entries(initial.state.document.nodes).map(([id, node]) => {
        if (node.type !== 'container' || typeof node.props.className !== 'string') {
          return [id, node];
        }
        const className = node.props.className
          .replace(ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS, '')
          .replace(ADMIN_SHELL_SIDEBAR_INSET_CLASS, '')
          .replace(ADMIN_SHELL_SIDEBAR_NAV_HOST_CLASS, '')
          .replace(/\s+/g, ' ')
          .trim();
        return [id, { ...node, props: { ...node.props, className } }];
      }),
    );

    const patched = ensureShellSidebarCollapsedChrome({
      ...initial.state.document,
      nodes: withoutMarkers,
    });

    const classNames = Object.values(patched.nodes)
      .map((node) => (typeof node.props.className === 'string' ? node.props.className : ''))
      .join(' ');

    expect(classNames).toContain(ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS);
    expect(classNames).toContain(ADMIN_SHELL_SIDEBAR_INSET_CLASS);
    expect(classNames).toContain(ADMIN_SHELL_SIDEBAR_NAV_HOST_CLASS);
  });
});
