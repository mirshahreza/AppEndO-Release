import { describe, expect, it } from 'vitest';
import { SITE_SHELL_LAYOUT_TEMPLATE } from '../siteShellLayoutTemplate';
import {
  CMS_SITE_BRAND_SLOT,
  CMS_SITE_CTA_SLOT,
  CMS_SITE_FOOTER_SLOT,
  CMS_SITE_NAV_SLOT,
} from '../../../../shared/lib/cmsSiteSlots';

describe('siteShellLayoutTemplate', () => {
  it('ships a public shell with CMS chrome slots and a route outlet', () => {
    const root = SITE_SHELL_LAYOUT_TEMPLATE[0];
    expect(String(root?.props?.className ?? '')).toContain('site-shell');
    expect(root?.props?.dataTestId).toBe('site-layout');

    const slotIds: string[] = [];
    const outletClassNames: string[] = [];

    const walk = (nodes: typeof SITE_SHELL_LAYOUT_TEMPLATE): void => {
      nodes.forEach((node) => {
        if (node.type === 'system-slot' && typeof node.props?.slotId === 'string') {
          slotIds.push(node.props.slotId);
          if (node.props.slotId === 'core.shell.route-outlet' && typeof node.props.className === 'string') {
            outletClassNames.push(node.props.className);
          }
        }
        if (node.children) {
          walk(node.children);
        }
      });
    };
    walk(SITE_SHELL_LAYOUT_TEMPLATE);

    expect(slotIds).toEqual(expect.arrayContaining([
      CMS_SITE_BRAND_SLOT,
      CMS_SITE_NAV_SLOT,
      CMS_SITE_CTA_SLOT,
      CMS_SITE_FOOTER_SLOT,
      'core.shell.route-outlet',
    ]));
    expect(outletClassNames).toContain('w-full');
  });
});
