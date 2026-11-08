import {
  PLATFORM_CHROME_COMPONENT_CATALOG,
  PLATFORM_CHROME_COMMAND_PALETTE,
  PLATFORM_CHROME_NOTIFICATION_BELL,
  PLATFORM_CHROME_USER_MENU,
  isPlatformChromeComponentId,
  type PlatformChromeComponentId,
} from '../../shared/api/contracts/platform/platformChromeComponents';
import type { DesignerPaletteItem } from './types';

export {
  PLATFORM_CHROME_COMMAND_PALETTE,
  PLATFORM_CHROME_NOTIFICATION_BELL,
  PLATFORM_CHROME_USER_MENU,
  isPlatformChromeComponentId,
};

export const PLATFORM_CHROME_PALETTE_ITEM_IDS = PLATFORM_CHROME_COMPONENT_CATALOG.map((entry) => entry.id);

export const isPlatformChromePaletteItemId = (
  itemId: string | null | undefined,
): itemId is PlatformChromeComponentId =>
  typeof itemId === 'string' && isPlatformChromeComponentId(itemId);

const MOCK_NOTIFICATIONS_JSON = JSON.stringify([
  { id: 'n1', title: 'Order #1042 shipped', body: 'Tracking updated', unread: true },
  { id: 'n2', title: 'New comment', body: 'Alex replied on Invoice', unread: true },
  { id: 'n3', title: 'Weekly digest', body: '3 reports ready', unread: false },
]);

const DEFAULT_MENU_ITEMS_JSON = JSON.stringify([
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
  { id: 'logout', label: 'Logout' },
]);

const DEFAULT_COMMAND_ITEMS_JSON = JSON.stringify([
  { id: 'page-users', label: 'Users', scope: 'pages' },
  { id: 'page-orders', label: 'Orders', scope: 'pages' },
  { id: 'action-refresh', label: 'Refresh data', scope: 'actions' },
  { id: 'record-1001', label: 'Order #1001', scope: 'records' },
]);

export const buildPlatformChromePaletteItems = (): DesignerPaletteItem[] => (
  PLATFORM_CHROME_COMPONENT_CATALOG.map((entry) => {
    if (entry.id === PLATFORM_CHROME_COMMAND_PALETTE) {
      return {
        id: entry.id,
        label: entry.label,
        category: 'platform-workspace' as const,
        icon: entry.icon,
        defaultProps: {
          hotkey: 'mod+k',
          searchScopes: 'pages,records,actions',
          recentItemsCount: 5,
          items: DEFAULT_COMMAND_ITEMS_JSON,
          className: 'w-full',
          _chromeDescription: entry.description,
        },
        allowedParentTypes: ['root', 'container', 'list'],
        canHaveChildren: false,
        sourceType: 'system' as const,
        sourceRef: entry.id,
        nodeType: 'container' as const,
      };
    }
    if (entry.id === PLATFORM_CHROME_NOTIFICATION_BELL) {
      return {
        id: entry.id,
        label: entry.label,
        category: 'platform-workspace' as const,
        icon: entry.icon,
        defaultProps: {
          unreadCount: 2,
          maxItemsShown: 5,
          items: MOCK_NOTIFICATIONS_JSON,
          className: 'w-full',
          _chromeDescription: entry.description,
        },
        allowedParentTypes: ['root', 'container', 'list'],
        canHaveChildren: false,
        sourceType: 'system' as const,
        sourceRef: entry.id,
        nodeType: 'container' as const,
      };
    }
    return {
      id: entry.id,
      label: entry.label,
      category: 'platform-workspace' as const,
      icon: entry.icon,
      defaultProps: {
        displayName: 'Alex Designer',
        avatarUrl: '',
        menuItems: DEFAULT_MENU_ITEMS_JSON,
        className: 'w-full',
        _chromeDescription: entry.description,
      },
      allowedParentTypes: ['root', 'container', 'list'],
      canHaveChildren: false,
      sourceType: 'system' as const,
      sourceRef: entry.id,
      nodeType: 'container' as const,
    };
  })
);

export const DESIGNER_PLATFORM_CHROME_PALETTE_ITEMS: DesignerPaletteItem[] = buildPlatformChromePaletteItems();
