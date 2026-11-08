import type { TemplateNodeSeed } from '../types';
import {
  CMS_SITE_BRAND_SLOT,
  CMS_SITE_CTA_SLOT,
  CMS_SITE_FOOTER_SLOT,
  CMS_SITE_NAV_SLOT,
} from '../../../shared/lib/cmsSiteSlots';

const cmsSlot = (slotId: string, className?: string): TemplateNodeSeed => ({
  type: 'system-slot',
  props: {
    slotId,
    className: className ?? 'contents',
  },
});

/** Public site chrome: CMS-backed brand, nav, CTA, footer, plus route outlet. */
export const SITE_SHELL_LAYOUT_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'html.container',
    props: {
      className: 'site-shell min-h-0 h-full overflow-y-auto',
      dataTestId: 'site-layout',
    },
    children: [
      {
        type: 'link',
        paletteItemId: 'html.link',
        props: {
          text: 'Skip to site content',
          href: '#site-main',
          target: '_self',
          rel: '',
          className: 'site-shell-skip',
        },
      },
      {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: 'site-shell-header' },
        children: [
          {
            type: 'container',
            paletteItemId: 'html.container',
            props: { className: 'site-shell-header-inner' },
            children: [
              cmsSlot(CMS_SITE_BRAND_SLOT),
              {
                type: 'container',
                paletteItemId: 'html.container',
                props: { className: 'site-shell-header-controls' },
                children: [
                  cmsSlot(CMS_SITE_NAV_SLOT),
                  cmsSlot(CMS_SITE_CTA_SLOT),
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'html.container',
        props: {
          className: 'site-shell-main',
          id: 'site-main',
          tabIndex: -1,
        },
        children: [
          {
            type: 'system-slot',
            props: { slotId: 'core.shell.route-outlet', className: 'w-full' },
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: 'site-shell-footer' },
        children: [
          cmsSlot(CMS_SITE_FOOTER_SLOT),
        ],
      },
    ],
  },
];
