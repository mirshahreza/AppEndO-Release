import { SHELL_CHROME_DEFAULT_NAVIGATION_REF } from '../../shared/lib/shellNavigationProps';
import type { DesignerPaletteItem } from './types';

export const SHELL_CHROME_PALETTE_ITEM_ID_PREFIX = 'shell.chrome.';

export const isShellChromePaletteItemId = (itemId: string): boolean =>
  itemId.startsWith(SHELL_CHROME_PALETTE_ITEM_ID_PREFIX);

const SHELL_CHROME_PALETTE_ENTRIES: Array<{
  id: string;
  label: string;
  description: string;
  icon: string;
  canHaveChildren?: boolean;
}> = [
  {
    id: 'shell.chrome.sidebar',
    label: 'Admin Sidebar',
    description: 'Full sidebar with logo, portal menu, and tree navigation.',
    icon: 'PanelLeft',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.header',
    label: 'Shell Header Bar',
    description: 'Built-in top header (page title, AppEndO, account). Use Custom Header Region to compose your own.',
    icon: 'PanelTop',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.header-region',
    label: 'Custom Header Region',
    description: 'Empty header bar styled like the app shell — add logo, nav, buttons, and slots in any layout.',
    icon: 'PanelTop',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.slot-logo',
    label: 'Shell Logo',
    description: 'Application logo slot — typically placed in sidebar or custom header.',
    icon: 'Sparkles',
  },
  {
    id: 'shell.chrome.slot-portal-menu',
    label: 'Portal Menu',
    description: 'Portal switcher slot — switches between studio portals.',
    icon: 'Layers',
  },
  {
    id: 'shell.chrome.slot-header-actions',
    label: 'Header Actions',
    description: 'Built-in header actions: page title, AppEndO assistant, fullscreen, and account menu.',
    icon: 'UserRound',
  },
  {
    id: 'shell.chrome.slot-sidebar-toggle',
    label: 'Sidebar Toggle',
    description: 'Collapse/expand control for the admin sidebar.',
    icon: 'ChevronsLeftRight',
  },
  {
    id: 'shell.chrome.sidebar-nav-tree',
    label: 'Sidebar Menu (Tree)',
    description: 'Two-level expandable sidebar menu — default studio style.',
    icon: 'Menu',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.sidebar-nav-mega',
    label: 'Sidebar Menu (Mega)',
    description: 'Multi-column mega menu for dense navigation trees.',
    icon: 'LayoutGrid',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.sidebar-nav-drawer',
    label: 'Sidebar Menu (Drawer)',
    description: 'Collapsible drawer navigation for mobile-first layouts.',
    icon: 'PanelLeft',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.top-nav-bar',
    label: 'Top Navigation Bar',
    description: 'Horizontal top navigation bar.',
    icon: 'PanelTop',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.footer-links',
    label: 'Footer Links',
    description: 'Flat footer link row.',
    icon: 'Rows4',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.sticky-action-bar',
    label: 'Sticky Action Bar',
    description: 'Sticky actions toolbar anchored to the bottom of the viewport.',
    icon: 'PanelBottom',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.route-outlet',
    label: 'Route Outlet',
    description: 'Page content loads here based on the active URL — place anywhere in your layout.',
    icon: 'LayoutTemplate',
    canHaveChildren: true,
  },
  {
    id: 'shell.chrome.app-layout',
    label: 'App Shell Layout',
    description: 'Full layout with sidebar, header, and route outlet for page content.',
    icon: 'LayoutGrid',
    canHaveChildren: true,
  },
  {
    id: 'shell.error-page',
    label: 'Error Page',
    description: 'Branded shell page for unexpected errors (500-style).',
    icon: 'TriangleAlert',
    canHaveChildren: true,
  },
  {
    id: 'shell.not-found',
    label: 'Not Found Page',
    description: 'Branded shell page for missing routes (404).',
    icon: 'SearchX',
    canHaveChildren: true,
  },
];

export const buildShellChromePaletteItems = (): DesignerPaletteItem[] => (
  SHELL_CHROME_PALETTE_ENTRIES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    category: 'platform-workspace',
    icon: entry.icon,
    defaultProps: {
      _shellChromeDescription: entry.description,
      navigationRef: SHELL_CHROME_DEFAULT_NAVIGATION_REF,
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: entry.canHaveChildren ?? false,
    sourceType: 'system',
    sourceRef: entry.id,
    nodeType: 'container',
  }))
);
