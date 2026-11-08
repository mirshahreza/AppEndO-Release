/** Designer shell chrome slot ids (logo, header, portal menu). */
export const SHELL_CHROME_LOGO = 'core.shell.logo' as const;
export const SHELL_CHROME_PORTAL_MENU = 'core.shell.portal-menu' as const;
export const SHELL_CHROME_HEADER = 'core.shell.header' as const;
export const SHELL_CHROME_SIDEBAR_TOGGLE = 'core.shell.sidebar-toggle' as const;

export const SHELL_CHROME_SLOT_IDS = [
  SHELL_CHROME_LOGO,
  SHELL_CHROME_PORTAL_MENU,
  SHELL_CHROME_HEADER,
  SHELL_CHROME_SIDEBAR_TOGGLE,
] as const;

export type ShellChromeSlotId = (typeof SHELL_CHROME_SLOT_IDS)[number];

export function isShellChromeSlotId(slotId: string): slotId is ShellChromeSlotId {
  return (SHELL_CHROME_SLOT_IDS as readonly string[]).includes(slotId);
}
