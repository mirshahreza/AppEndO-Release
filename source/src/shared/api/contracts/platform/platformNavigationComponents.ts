export const PLATFORM_NAV_TREE_TWO_LEVEL = 'core:TreeNavTwoLevel' as const;
export const PLATFORM_NAV_MEGA_MENU = 'core:MegaMenu' as const;
export const PLATFORM_NAV_TOP_DRAWER = 'core:TopDrawerNav' as const;
export const PLATFORM_NAV_TOP_BAR = 'core:TopBarNav' as const;
export const PLATFORM_NAV_FLAT_LINKS = 'core:FlatLinks' as const;

export const PLATFORM_NAV_COMPONENT_IDS = [
  PLATFORM_NAV_TREE_TWO_LEVEL,
  PLATFORM_NAV_MEGA_MENU,
  PLATFORM_NAV_TOP_DRAWER,
  PLATFORM_NAV_TOP_BAR,
  PLATFORM_NAV_FLAT_LINKS,
] as const;

export type PlatformNavComponentId = (typeof PLATFORM_NAV_COMPONENT_IDS)[number];

export type PlatformNavComponentMeta = {
  id: PlatformNavComponentId;
  label: string;
  description: string;
  region: 'side' | 'top' | 'footer';
};

export const PLATFORM_NAV_COMPONENT_CATALOG: PlatformNavComponentMeta[] = [
  {
    id: PLATFORM_NAV_TREE_TWO_LEVEL,
    label: 'Tree navigation (two-level)',
    description: 'Sidebar tree with expandable groups — default studio menu style.',
    region: 'side',
  },
  {
    id: PLATFORM_NAV_MEGA_MENU,
    label: 'Mega menu navigation',
    description: 'Multi-column mega menu for dense navigation trees.',
    region: 'side',
  },
  {
    id: PLATFORM_NAV_TOP_DRAWER,
    label: 'Top drawer navigation',
    description: 'Collapsible drawer navigation suited for mobile-first layouts.',
    region: 'side',
  },
  {
    id: PLATFORM_NAV_TOP_BAR,
    label: 'Top bar navigation',
    description: 'Horizontal top navigation bar.',
    region: 'top',
  },
  {
    id: PLATFORM_NAV_FLAT_LINKS,
    label: 'Flat links navigation',
    description: 'Simple flat link row — typical footer navigation.',
    region: 'footer',
  },
];

export function isPlatformNavComponentId(value: string): value is PlatformNavComponentId {
  return (PLATFORM_NAV_COMPONENT_IDS as readonly string[]).includes(value.trim());
}

export function getPlatformNavComponentMeta(
  componentKey: string,
): PlatformNavComponentMeta | undefined {
  const normalized = componentKey.trim();
  return PLATFORM_NAV_COMPONENT_CATALOG.find((entry) => entry.id === normalized);
}
