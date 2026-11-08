import {
  PLATFORM_NAV_COMPONENT_CATALOG,
  PLATFORM_NAV_TREE_TWO_LEVEL,
} from '../../shared/api/contracts/platform/platformNavigationComponents';
import { SHELL_CHROME_DEFAULT_NAVIGATION_REF } from '../../shared/lib/shellNavigationProps';
import type { DesignerPaletteItem } from './types';

export const PLATFORM_NAV_PALETTE_ITEM_ID_PREFIX = 'platform.nav.';

export const toPlatformNavPaletteItemId = (componentKey: string): string =>
  `${PLATFORM_NAV_PALETTE_ITEM_ID_PREFIX}${componentKey.replace(/^core:/, '')}`;

export const isPlatformNavPaletteItemId = (itemId: string | null | undefined): boolean =>
  typeof itemId === 'string' && itemId.startsWith(PLATFORM_NAV_PALETTE_ITEM_ID_PREFIX);

export const buildPlatformNavigationPaletteItems = (): DesignerPaletteItem[] => (
  PLATFORM_NAV_COMPONENT_CATALOG.map((entry) => ({
    id: toPlatformNavPaletteItemId(entry.id),
    label: entry.label,
    category: 'platform-workspace',
    icon: entry.region === 'top' ? 'PanelTop' : entry.region === 'footer' ? 'Rows4' : 'Menu',
    defaultProps: {
      componentKey: entry.id,
      navigationRef: SHELL_CHROME_DEFAULT_NAVIGATION_REF,
      className: 'min-h-0',
      _navRegion: entry.region,
      _navDescription: entry.description,
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'system',
    sourceRef: entry.id,
    nodeType: 'platform-nav',
  }))
);

export const DEFAULT_PLATFORM_NAV_COMPONENT_KEY = PLATFORM_NAV_TREE_TWO_LEVEL;
