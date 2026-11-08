/**
 * Platform chrome widgets catalog (Phase 53) — Command Palette / Notification Bell / User Menu.
 * Fed into the Dynamic Platform Palette the same way slots/nav entries are (not a one-off local hack).
 */
export const PLATFORM_CHROME_COMMAND_PALETTE = 'platform-navigation.command-palette' as const;
export const PLATFORM_CHROME_NOTIFICATION_BELL = 'platform-navigation.notification-bell' as const;
export const PLATFORM_CHROME_USER_MENU = 'platform-navigation.user-menu' as const;

export const PLATFORM_CHROME_COMPONENT_IDS = [
  PLATFORM_CHROME_COMMAND_PALETTE,
  PLATFORM_CHROME_NOTIFICATION_BELL,
  PLATFORM_CHROME_USER_MENU,
] as const;

export type PlatformChromeComponentId = (typeof PLATFORM_CHROME_COMPONENT_IDS)[number];

export type PlatformChromeComponentMeta = {
  id: PlatformChromeComponentId;
  label: string;
  description: string;
  icon: string;
};

export const PLATFORM_CHROME_COMPONENT_CATALOG: PlatformChromeComponentMeta[] = [
  {
    id: PLATFORM_CHROME_COMMAND_PALETTE,
    label: 'Command Palette',
    description: 'Global ⌘K / Ctrl+K search across pages, records, and actions.',
    icon: 'Command',
  },
  {
    id: PLATFORM_CHROME_NOTIFICATION_BELL,
    label: 'Notification Bell',
    description: 'In-app notification center bell with unread badge (live feed via Phase 55).',
    icon: 'Bell',
  },
  {
    id: PLATFORM_CHROME_USER_MENU,
    label: 'User Menu',
    description: 'Account avatar + display name menu (session-bound).',
    icon: 'CircleUserRound',
  },
];

export function isPlatformChromeComponentId(value: string): value is PlatformChromeComponentId {
  return (PLATFORM_CHROME_COMPONENT_IDS as readonly string[]).includes(value.trim());
}

export function getPlatformChromeComponentMeta(
  componentId: string,
): PlatformChromeComponentMeta | undefined {
  const normalized = componentId.trim();
  return PLATFORM_CHROME_COMPONENT_CATALOG.find((entry) => entry.id === normalized);
}
