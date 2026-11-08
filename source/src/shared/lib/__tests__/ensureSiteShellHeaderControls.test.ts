import { describe, expect, it } from 'vitest';
import { SITE_SHELL_LAYOUT_KEY } from '../../api/contracts/platform/mountConstants';
import {
  CMS_SITE_BRAND_SLOT,
  CMS_SITE_CTA_SLOT,
  CMS_SITE_NAV_SLOT,
} from '../cmsSiteSlots';
import { ensureSiteShellHeaderControls } from '../ensureSiteShellHeaderControls';
import type { DesignerDocument } from '../../../domain/component-designer/types';

const buildLegacySiteShellDocument = (): DesignerDocument => {
  const rootId = 'root';
  const headerInnerId = 'header-inner';
  const brandId = 'brand';
  const navId = 'nav';
  const ctaId = 'cta';

  return {
    rootNodeId: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        type: 'container',
        parentId: null,
        order: 0,
        props: { className: 'site-shell' },
        layout: {},
        binding: {},
        children: [headerInnerId],
      },
      [headerInnerId]: {
        id: headerInnerId,
        type: 'container',
        parentId: rootId,
        order: 0,
        props: { className: 'site-shell-header-inner' },
        layout: {},
        binding: {},
        children: [brandId, navId, ctaId],
      },
      [brandId]: {
        id: brandId,
        type: 'system-slot',
        parentId: headerInnerId,
        order: 0,
        props: { slotId: CMS_SITE_BRAND_SLOT },
        layout: {},
        binding: {},
        children: [],
      },
      [navId]: {
        id: navId,
        type: 'system-slot',
        parentId: headerInnerId,
        order: 1,
        props: { slotId: CMS_SITE_NAV_SLOT },
        layout: {},
        binding: {},
        children: [],
      },
      [ctaId]: {
        id: ctaId,
        type: 'system-slot',
        parentId: headerInnerId,
        order: 2,
        props: { slotId: CMS_SITE_CTA_SLOT },
        layout: {},
        binding: {},
        children: [],
      },
    },
  };
};

describe('ensureSiteShellHeaderControls', () => {
  it('wraps legacy nav and CTA slots in header controls for site-shell', () => {
    const next = ensureSiteShellHeaderControls(buildLegacySiteShellDocument(), SITE_SHELL_LAYOUT_KEY);
    const controls = Object.values(next.nodes).find((node) => {
      const className = typeof node.props.className === 'string' ? node.props.className : '';
      return className.includes('site-shell-header-controls');
    });
    expect(controls?.children).toHaveLength(2);
    expect(next.nodes[controls!.children[0]].props.slotId).toBe(CMS_SITE_NAV_SLOT);
    expect(next.nodes[controls!.children[1]].props.slotId).toBe(CMS_SITE_CTA_SLOT);
  });

  it('is a no-op when header controls already exist', () => {
    const legacy = buildLegacySiteShellDocument();
    const first = ensureSiteShellHeaderControls(legacy, SITE_SHELL_LAYOUT_KEY);
    const second = ensureSiteShellHeaderControls(first, SITE_SHELL_LAYOUT_KEY);
    expect(second).toBe(first);
  });
});
