import { describe, expect, it } from 'vitest';
import { APP_SHELL_LAYOUT_TEMPLATE } from '../appShellLayoutTemplate';
import {
  ADMIN_SHELL_CONTENT_HOST_CLASS,
  ADMIN_SHELL_ROOT_CLASS,
} from '../../../../shared/ui/surfaceClasses';

describe('appShellLayoutTemplate', () => {
  it('mirrors AppShell root and content host surfaces', () => {
    const root = APP_SHELL_LAYOUT_TEMPLATE[0];
    expect(root?.props?.className).toContain(ADMIN_SHELL_ROOT_CLASS);

    const findClass = (nodes: typeof APP_SHELL_LAYOUT_TEMPLATE, classFragment: string): boolean =>
      nodes.some((node) => {
        const className = typeof node.props?.className === 'string' ? node.props.className : '';
        if (className.includes(classFragment)) {
          return true;
        }
        return node.children ? findClass(node.children, classFragment) : false;
      });

    expect(findClass(APP_SHELL_LAYOUT_TEMPLATE, ADMIN_SHELL_CONTENT_HOST_CLASS)).toBe(true);

    const slotIds: string[] = [];
    const platformNavRefs: string[] = [];
    const collectSlots = (nodes: typeof APP_SHELL_LAYOUT_TEMPLATE): void => {
      nodes.forEach((node) => {
        if (node.type === 'system-slot' && typeof node.props?.slotId === 'string') {
          slotIds.push(node.props.slotId);
        }
        if (node.type === 'platform-nav' && typeof node.props?.navigationRef === 'string') {
          platformNavRefs.push(node.props.navigationRef);
        }
        if (node.children) {
          collectSlots(node.children);
        }
      });
    };
    collectSlots(APP_SHELL_LAYOUT_TEMPLATE);

    expect(slotIds).toContain('core.shell.sidebar-toggle');
    expect(slotIds).toContain('core.shell.logo');
    expect(slotIds).toContain('core.shell.portal-menu');
    expect(platformNavRefs).toContain('studio');
    expect(slotIds).toContain('core.shell.route-outlet');
    expect(slotIds).toContain('core.shell.header');
  });
});
