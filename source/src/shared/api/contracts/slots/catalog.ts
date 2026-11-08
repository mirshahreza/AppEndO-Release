export type SlotCatalogEntry = {
  id: string;
  label: string;
  description: string;
  surface: 'admin-shell' | 'portal' | 'settings';
  propsHint?: string;
  exampleManifest?: {
    componentKey: string;
    slotId: string;
    entry: string;
    order?: number;
  };
};

export const CORE_SLOT_CATALOG: SlotCatalogEntry[] = [
  {
    id: 'core.sidebar.navigation',
    label: 'Sidebar Navigation',
    description: 'Primary sidebar menu items contributed by plugins.',
    surface: 'admin-shell',
    propsHint: 'Navigation context is provided by AdminLayout.',
    exampleManifest: {
      componentKey: 'crm-nav',
      slotId: 'core.sidebar.navigation',
      entry: 'ui/NavLink.tsx',
      order: 100,
    },
  },
  {
    id: 'core.dashboard.widgets',
    label: 'Dashboard Widgets',
    description: 'Summary widgets rendered on the portal dashboard grid.',
    surface: 'portal',
    propsHint: 'Widget host is a responsive grid cell; keep cards compact.',
    exampleManifest: {
      componentKey: 'crm-summary',
      slotId: 'core.dashboard.widgets',
      entry: 'ui/DashboardWidget.tsx',
      order: 10,
    },
  },
  {
    id: 'core.settings.sections',
    label: 'Settings Sections',
    description: 'Optional settings tabs/sections injected into /settings.',
    surface: 'settings',
    exampleManifest: {
      componentKey: 'notification-settings',
      slotId: 'core.settings.sections',
      entry: 'ui/SettingsSection.tsx',
      order: 50,
    },
  },
  {
    id: 'core.toolbar.actions',
    label: 'Page Toolbar Actions',
    description: 'Supplemental toolbar actions on eligible admin pages.',
    surface: 'admin-shell',
    exampleManifest: {
      componentKey: 'export-action',
      slotId: 'core.toolbar.actions',
      entry: 'ui/ToolbarAction.tsx',
      order: 20,
    },
  },
  {
    id: 'core.shell.route-outlet',
    label: 'Route Outlet',
    description: 'Dynamic application page content for the active URL.',
    surface: 'admin-shell',
    propsHint: 'Renders the routed page module inside portal shells.',
  },
  {
    id: 'core.shell.nav.top',
    label: 'Top Navigation',
    description: 'Horizontal navigation region (top bar).',
    surface: 'admin-shell',
    propsHint: 'Set navigationRef to a navigation JSON id (e.g. studio → platform-registry/navigation/studio.json).',
  },
  {
    id: 'core.shell.nav.side',
    label: 'Side Navigation',
    description: 'Primary sidebar navigation region.',
    surface: 'admin-shell',
    propsHint: 'Set navigationRef to a navigation JSON id (e.g. studio → platform-registry/navigation/studio.json).',
  },
  {
    id: 'core.shell.nav.footer',
    label: 'Footer Links',
    description: 'Flat footer link navigation region.',
    surface: 'admin-shell',
  },
  {
    id: 'core.shell.logo',
    label: 'Shell Logo',
    description: 'Application logo in the admin shell sidebar or custom header.',
    surface: 'admin-shell',
    propsHint: 'Upload a logo image or set logoSrc to a URL. Optional logoHref for click target.',
  },
  {
    id: 'core.shell.portal-menu',
    label: 'Portal Menu',
    description: 'Portal switcher below the shell logo.',
    surface: 'admin-shell',
  },
  {
    id: 'core.shell.header',
    label: 'Shell Header',
    description: 'Top header chrome with page title, AI, and account actions.',
    surface: 'admin-shell',
  },
  {
    id: 'core.shell.sidebar-toggle',
    label: 'Sidebar Toggle',
    description: 'Collapse/expand control for the admin shell sidebar.',
    surface: 'admin-shell',
  },
  {
    id: 'cms.site.brand',
    label: 'CMS Site Brand',
    description: 'Public site mark loaded from published CMS fragments.',
    surface: 'portal',
  },
  {
    id: 'cms.site.nav',
    label: 'CMS Site Navigation',
    description: 'Public top links loaded from published CMS pages.',
    surface: 'portal',
  },
  {
    id: 'cms.site.cta',
    label: 'CMS Site Call To Action',
    description: 'Public header button loaded from published CMS content.',
    surface: 'portal',
  },
  {
    id: 'cms.site.footer',
    label: 'CMS Site Footer',
    description: 'Public footer copy and links loaded from published CMS content.',
    surface: 'portal',
  },
];

export type SlotCatalogResponse = {
  slots: SlotCatalogEntry[];
  registered: Array<{
    slotId: string;
    packageId: string;
    componentKey: string;
    order: number;
  }>;
  active: Array<{
    slotId: string;
    packageId: string;
    componentKey: string;
    order: number;
    version: string;
    moduleUrl: string;
  }>;
};

/** Studio pages packed with a dummy dashboard slot (`folder/name` keys) are not shell widgets. */
export function isPackedStudioPageSlotBinding(binding: {
  slotId: string;
  componentKey: string;
}): boolean {
  return binding.slotId === 'core.dashboard.widgets' && binding.componentKey.includes('/');
}
