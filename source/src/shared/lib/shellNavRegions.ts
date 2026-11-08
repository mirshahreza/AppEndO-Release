/** Designer shell navigation region slot ids (RLE-1.2 / RLE-4). */
export const SHELL_NAV_REGION_TOP = 'core.shell.nav.top' as const;
export const SHELL_NAV_REGION_SIDE = 'core.shell.nav.side' as const;
export const SHELL_NAV_REGION_FOOTER = 'core.shell.nav.footer' as const;

export const SHELL_NAV_REGION_SLOT_IDS = [
  SHELL_NAV_REGION_TOP,
  SHELL_NAV_REGION_SIDE,
  SHELL_NAV_REGION_FOOTER,
] as const;

export type ShellNavRegionSlotId = (typeof SHELL_NAV_REGION_SLOT_IDS)[number];

export function isShellNavRegionSlotId(slotId: string): slotId is ShellNavRegionSlotId {
  return (SHELL_NAV_REGION_SLOT_IDS as readonly string[]).includes(slotId);
}
