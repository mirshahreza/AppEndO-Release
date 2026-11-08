import {
  PLATFORM_NAV_FLAT_LINKS,
  PLATFORM_NAV_MEGA_MENU,
  PLATFORM_NAV_TOP_BAR,
  PLATFORM_NAV_TOP_DRAWER,
  PLATFORM_NAV_TREE_TWO_LEVEL,
  type PlatformNavComponentId,
} from '../../shared/api/contracts/platform/platformNavigationComponents';
import {
  SHELL_CHROME_HEADER,
  SHELL_CHROME_LOGO,
  SHELL_CHROME_PORTAL_MENU,
  SHELL_CHROME_SIDEBAR_TOGGLE,
} from '../../shared/lib/shellChromeSlots';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from '../../shared/lib/shellRouteOutlet';
import {
  SHELL_NAVIGATION_COMPONENT_KEY_PROP,
  SHELL_NAVIGATION_REF_PROP,
  SHELL_CHROME_DEFAULT_NAVIGATION_REF,
} from '../../shared/lib/shellNavigationProps';
import {
  SHELL_LOGO_ALT_PROP,
  SHELL_LOGO_HREF_PROP,
  SHELL_LOGO_SRC_PROP,
} from '../../shared/lib/shellLogoProps';
import {
  ADMIN_SHELL_HEADER_CLASS,
  ADMIN_SHELL_HEADER_INNER_CLASS,
  ADMIN_SHELL_SIDEBAR_CLASS,
} from '../../shared/ui/surfaceClasses';
import { APP_SHELL_LAYOUT_TEMPLATE } from './appShellLayoutSeeds';
import type { TemplateNodeSeed } from './types';

/** Default navigation JSON id — resolves to platform-registry/navigation/studio.json */
export { SHELL_CHROME_DEFAULT_NAVIGATION_REF } from '../../shared/lib/shellNavigationProps';

const toPlatformNavPaletteItemId = (componentKey: string): string =>
  `platform.nav.${componentKey.replace(/^core:/, '')}`;

const toSlotPaletteItemId = (slotId: string): string => `platform.slot.${slotId}`;

const DESIGNER_SHELL_SIDEBAR_WIDTH_CLASS =
  'designer-shell-sidebar w-[var(--designer-shell-sidebar-width,var(--admin-shell-sidebar-width,250px))] md:w-[var(--designer-shell-sidebar-width,var(--admin-shell-sidebar-width,250px))] relative max-md:-translate-x-full max-md:rtl:translate-x-full md:translate-x-0';

const buildPlatformNavSeed = (
  componentKey: PlatformNavComponentId,
  navigationRef = SHELL_CHROME_DEFAULT_NAVIGATION_REF,
): TemplateNodeSeed => ({
  type: 'platform-nav',
  paletteItemId: toPlatformNavPaletteItemId(componentKey),
  props: {
    [SHELL_NAVIGATION_COMPONENT_KEY_PROP]: componentKey,
    [SHELL_NAVIGATION_REF_PROP]: navigationRef,
    className: 'min-h-0',
  },
});

const buildSidebarNavScrollRegion = (navSeed: TemplateNodeSeed): TemplateNodeSeed => ({
  type: 'container',
  paletteItemId: 'html.container',
  props: {
    className: 'flex flex-col flex-1 min-h-0 overflow-hidden pt-2 pb-2 px-[16px]',
  },
  children: [navSeed],
});

const buildSidebarChromeBody = (navSeed: TemplateNodeSeed): TemplateNodeSeed[] => [
  {
    type: 'container',
    paletteItemId: 'html.container',
    props: { className: 'flex min-h-0 flex-1 flex-col' },
    children: [
      {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: 'flex items-center px-2 shrink-0 py-[11px] h-[91px]' },
        children: [
          {
            type: 'container',
            paletteItemId: 'html.container',
            props: { className: 'relative flex items-center justify-center w-full' },
            children: [
              {
                type: 'system-slot',
                paletteItemId: toSlotPaletteItemId(SHELL_CHROME_LOGO),
                props: { slotId: SHELL_CHROME_LOGO },
              },
            ],
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: 'shrink-0 px-[16px]' },
        children: [
          {
            type: 'system-slot',
            paletteItemId: toSlotPaletteItemId(SHELL_CHROME_PORTAL_MENU),
            props: { slotId: SHELL_CHROME_PORTAL_MENU },
          },
        ],
      },
      buildSidebarNavScrollRegion(navSeed),
    ],
  },
];

/** Full admin sidebar column — logo, portal switcher, and navigation (matches AppShellSidebar). */
export const SHELL_ADMIN_SIDEBAR_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.sidebar',
    props: {
      className: `${ADMIN_SHELL_SIDEBAR_CLASS} ${DESIGNER_SHELL_SIDEBAR_WIDTH_CLASS}`,
    },
    children: [
      {
        type: 'system-slot',
        paletteItemId: toSlotPaletteItemId(SHELL_CHROME_SIDEBAR_TOGGLE),
        props: { slotId: SHELL_CHROME_SIDEBAR_TOGGLE },
      },
      ...buildSidebarChromeBody(buildPlatformNavSeed(PLATFORM_NAV_TREE_TWO_LEVEL)),
    ],
  },
];

/** Top header bar with shell chrome slot (page title, AI, account). */
export const SHELL_HEADER_BAR_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.header',
    props: { className: ADMIN_SHELL_HEADER_CLASS },
    children: [
      {
        type: 'system-slot',
        paletteItemId: toSlotPaletteItemId(SHELL_CHROME_HEADER),
        props: {
          slotId: SHELL_CHROME_HEADER,
          className: ADMIN_SHELL_HEADER_INNER_CLASS,
        },
      },
    ],
  },
];

/** Empty header region — compose logo, nav, buttons, and slots freely. */
const SHELL_HEADER_REGION_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.header-region',
    props: {
      className: `${ADMIN_SHELL_HEADER_CLASS} gap-3`,
    },
    children: [],
  },
];

const buildShellChromeSlotTemplate = (
  paletteItemId: string,
  slotId: string,
  className = 'min-h-0',
  extraProps: Record<string, unknown> = {},
): TemplateNodeSeed[] => [
  {
    type: 'system-slot',
    paletteItemId: toSlotPaletteItemId(slotId),
    props: { slotId, className, ...extraProps },
  },
];

const SHELL_SLOT_LOGO_TEMPLATE = buildShellChromeSlotTemplate(
  'shell.chrome.slot-logo',
  SHELL_CHROME_LOGO,
  'shrink-0',
  {
    [SHELL_LOGO_SRC_PROP]: '',
    [SHELL_LOGO_ALT_PROP]: '',
    [SHELL_LOGO_HREF_PROP]: '',
  },
);

const SHELL_SLOT_PORTAL_MENU_TEMPLATE = buildShellChromeSlotTemplate(
  'shell.chrome.slot-portal-menu',
  SHELL_CHROME_PORTAL_MENU,
  'shrink-0',
);

const SHELL_SLOT_HEADER_ACTIONS_TEMPLATE = buildShellChromeSlotTemplate(
  'shell.chrome.slot-header-actions',
  SHELL_CHROME_HEADER,
  'flex min-w-0 flex-1 items-center justify-end',
);

const SHELL_SLOT_SIDEBAR_TOGGLE_TEMPLATE = buildShellChromeSlotTemplate(
  'shell.chrome.slot-sidebar-toggle',
  SHELL_CHROME_SIDEBAR_TOGGLE,
  'shrink-0',
);

/** Sidebar navigation scroll region with tree menu (default studio style). */
const SHELL_SIDEBAR_NAV_TREE_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.sidebar-nav-tree',
    props: { className: 'min-h-[120px] w-full' },
    children: [buildSidebarNavScrollRegion(buildPlatformNavSeed(PLATFORM_NAV_TREE_TWO_LEVEL))],
  },
];

const SHELL_SIDEBAR_NAV_MEGA_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.sidebar-nav-mega',
    props: { className: 'min-h-[120px] w-full' },
    children: [buildSidebarNavScrollRegion(buildPlatformNavSeed(PLATFORM_NAV_MEGA_MENU))],
  },
];

const SHELL_SIDEBAR_NAV_DRAWER_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.sidebar-nav-drawer',
    props: { className: 'min-h-[120px] w-full' },
    children: [buildSidebarNavScrollRegion(buildPlatformNavSeed(PLATFORM_NAV_TOP_DRAWER))],
  },
];

/** Horizontal top navigation bar. */
const SHELL_TOP_NAV_BAR_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.top-nav-bar',
    props: { className: 'w-full border-b border-border-divider bg-nav-active px-3 py-2' },
    children: [buildPlatformNavSeed(PLATFORM_NAV_TOP_BAR)],
  },
];

/** Flat footer link row. */
const SHELL_FOOTER_LINKS_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.footer-links',
    props: { className: 'w-full border-t border-border-divider bg-surface-shell px-4 py-3' },
    children: [buildPlatformNavSeed(PLATFORM_NAV_FLAT_LINKS)],
  },
];

/** Route outlet — page content loads here based on the active URL. */
const SHELL_ROUTE_OUTLET_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.route-outlet',
    props: {
      className: 'flex min-h-[200px] w-full flex-col rounded-lg border border-dashed border-sky-300/80 bg-sky-50/40',
    },
    children: [
      {
        type: 'system-slot',
        paletteItemId: toSlotPaletteItemId(SHELL_ROUTE_OUTLET_SLOT_ID),
        props: {
          slotId: SHELL_ROUTE_OUTLET_SLOT_ID,
          className: 'min-h-0 flex-1',
        },
      },
    ],
  },
];

/** Full app shell — sidebar, header, and route outlet in one layout. */
const SHELL_APP_LAYOUT_TEMPLATE: TemplateNodeSeed[] = APP_SHELL_LAYOUT_TEMPLATE.map((seed) => ({
  ...seed,
  paletteItemId: seed.paletteItemId ?? 'shell.chrome.app-layout',
}));

const SHELL_STICKY_ACTION_BAR_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    paletteItemId: 'shell.chrome.sticky-action-bar',
    props: {
      className: 'sticky bottom-0 z-30 w-full border-t border-border-divider bg-white px-4 py-3 flex items-center justify-between shadow-md',
    },
    children: [
      {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: 'flex flex-col gap-0.5' },
        children: [
          {
            type: 'heading',
            paletteItemId: 'html.heading',
            props: { className: 'text-sm font-bold text-slate-800', text: 'Unsaved Changes' },
          },
          {
            type: 'text',
            paletteItemId: 'html.text',
            props: { className: 'text-xs text-slate-500', text: 'You have unsaved changes on this page.' },
          },
        ],
      },
      {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: 'flex items-center gap-2' },
        children: [
          {
            type: 'link',
            paletteItemId: 'heroui.button-outline',
            props: {
              text: 'Cancel',
            },
          },
          {
            type: 'link',
            paletteItemId: 'heroui.button-solid',
            props: {
              text: 'Save Changes',
            },
          },
        ],
      },
    ],
  },
];

const buildErrorShellPageTemplate = (
  paletteItemId: 'shell.error-page' | 'shell.not-found',
  heading: string,
  message: string,
  iconName: string,
): TemplateNodeSeed[] => [
  {
    type: 'container',
    paletteItemId,
    props: {
      className: 'flex min-h-[320px] w-full flex-col items-center justify-center gap-4 px-6 py-12 text-center',
    },
    children: [
      {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: 'flex flex-col items-center gap-3 max-w-md' },
        children: [
          {
            type: 'text',
            paletteItemId: 'html.text',
            props: {
              className: 'text-5xl font-bold text-slate-300',
              text: iconName,
            },
          },
          {
            type: 'heading',
            paletteItemId: 'html.heading',
            props: {
              className: 'text-xl font-bold text-slate-800',
              text: heading,
            },
          },
          {
            type: 'text',
            paletteItemId: 'html.text',
            props: {
              className: 'text-sm text-slate-500',
              text: message,
            },
          },
          {
            type: 'link',
            paletteItemId: 'heroui.button-solid',
            // Bug found (parity audit item P3.19): left at the palette default `href: '#'` —
            // a real, clickable-looking button that navigated nowhere. Points at the app root,
            // matching the real RouteNotFoundPage's own `homeTo = '/'` default.
            props: {
              text: 'Go to dashboard',
              href: '/',
            },
          },
        ],
      },
    ],
  },
];

/** CD-E05 — branded error page preset for shell layouts. */
export const SHELL_ERROR_PAGE_TEMPLATE: TemplateNodeSeed[] = buildErrorShellPageTemplate(
  'shell.error-page',
  'Something went wrong',
  'An unexpected error occurred. Try again or contact your administrator.',
  '⚠',
);

/** CD-E05 — branded not-found page preset for shell layouts. */
export const SHELL_NOT_FOUND_PAGE_TEMPLATE: TemplateNodeSeed[] = buildErrorShellPageTemplate(
  'shell.not-found',
  'Page not found',
  'The page you requested does not exist or may have been moved.',
  '404',
);

export type ShellChromeTemplateId =
  | 'shell.chrome.sidebar'
  | 'shell.chrome.header'
  | 'shell.chrome.header-region'
  | 'shell.chrome.slot-logo'
  | 'shell.chrome.slot-portal-menu'
  | 'shell.chrome.slot-header-actions'
  | 'shell.chrome.slot-sidebar-toggle'
  | 'shell.chrome.sidebar-nav-tree'
  | 'shell.chrome.sidebar-nav-mega'
  | 'shell.chrome.sidebar-nav-drawer'
  | 'shell.chrome.top-nav-bar'
  | 'shell.chrome.footer-links'
  | 'shell.chrome.sticky-action-bar'
  | 'shell.chrome.route-outlet'
  | 'shell.chrome.app-layout'
  | 'shell.error-page'
  | 'shell.not-found';

const SHELL_CHROME_TEMPLATE_MAP: Record<ShellChromeTemplateId, TemplateNodeSeed[]> = {
  'shell.chrome.sidebar': SHELL_ADMIN_SIDEBAR_TEMPLATE,
  'shell.chrome.header': SHELL_HEADER_BAR_TEMPLATE,
  'shell.chrome.header-region': SHELL_HEADER_REGION_TEMPLATE,
  'shell.chrome.slot-logo': SHELL_SLOT_LOGO_TEMPLATE,
  'shell.chrome.slot-portal-menu': SHELL_SLOT_PORTAL_MENU_TEMPLATE,
  'shell.chrome.slot-header-actions': SHELL_SLOT_HEADER_ACTIONS_TEMPLATE,
  'shell.chrome.slot-sidebar-toggle': SHELL_SLOT_SIDEBAR_TOGGLE_TEMPLATE,
  'shell.chrome.sidebar-nav-tree': SHELL_SIDEBAR_NAV_TREE_TEMPLATE,
  'shell.chrome.sidebar-nav-mega': SHELL_SIDEBAR_NAV_MEGA_TEMPLATE,
  'shell.chrome.sidebar-nav-drawer': SHELL_SIDEBAR_NAV_DRAWER_TEMPLATE,
  'shell.chrome.top-nav-bar': SHELL_TOP_NAV_BAR_TEMPLATE,
  'shell.chrome.footer-links': SHELL_FOOTER_LINKS_TEMPLATE,
  'shell.chrome.sticky-action-bar': SHELL_STICKY_ACTION_BAR_TEMPLATE,
  'shell.chrome.route-outlet': SHELL_ROUTE_OUTLET_TEMPLATE,
  'shell.chrome.app-layout': SHELL_APP_LAYOUT_TEMPLATE,
  'shell.error-page': SHELL_ERROR_PAGE_TEMPLATE,
  'shell.not-found': SHELL_NOT_FOUND_PAGE_TEMPLATE,
};

export function isShellChromeTemplateId(value: string): value is ShellChromeTemplateId {
  return Object.prototype.hasOwnProperty.call(SHELL_CHROME_TEMPLATE_MAP, value);
}

export function resolveShellChromeTemplateSeeds(paletteItemId: string): TemplateNodeSeed[] | null {
  const normalized = paletteItemId.trim();
  if (!isShellChromeTemplateId(normalized)) {
    return null;
  }

  return SHELL_CHROME_TEMPLATE_MAP[normalized];
}
