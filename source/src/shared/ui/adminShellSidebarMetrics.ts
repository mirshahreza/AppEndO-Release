import { cn } from '../../lib/utils';
import {
  ADMIN_SHELL_SIDEBAR_INSET_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS,
  ADMIN_SHELL_SIDEBAR_NAV_HOST_CLASS,
} from './surfaceClasses';

/** Expanded logo band — matches geometry lock in ui-core.md. */
export const ADMIN_SHELL_SIDEBAR_LOGO_BAND_EXPANDED_CLASS =
  'h-[91px] px-2 py-[11px]';

/** Collapsed rail logo band. */
export const ADMIN_SHELL_SIDEBAR_LOGO_BAND_COLLAPSED_CLASS =
  'h-[74px] overflow-hidden px-1 py-0';

/** Visual nudge for expanded sidebar lockup (built-in mark). */
export const ADMIN_SHELL_SIDEBAR_LOGO_EXPANDED_NUDGE_CLASS = 'translate-y-[10px]';

export const ADMIN_SHELL_SIDEBAR_LOGO_INNER_WRAPPER_CLASS =
  'relative flex w-full max-w-full items-center justify-center';

/** Side nav host below logo / portal inset — shortcuts are first child inside `<nav>`. */
export const ADMIN_SHELL_SIDEBAR_NAV_CLASS =
  'flex min-h-0 flex-1 flex-col overflow-hidden pt-3 pb-2';

/** Horizontal inset for nav and portal menu row. */
export const adminShellSidebarNavPaddingClass = (navCollapsed: boolean): string =>
  navCollapsed ? 'px-1' : 'px-[16px]';

export const adminShellSidebarLogoRegionClassName = (navCollapsed: boolean): string =>
  cn(
    'flex shrink-0 items-center justify-center transition-[height] duration-300 ease-out',
    ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS,
    navCollapsed
      ? ADMIN_SHELL_SIDEBAR_LOGO_BAND_COLLAPSED_CLASS
      : ADMIN_SHELL_SIDEBAR_LOGO_BAND_EXPANDED_CLASS,
  );

export const adminShellSidebarNavClassName = (navCollapsed: boolean): string =>
  cn(ADMIN_SHELL_SIDEBAR_NAV_CLASS, adminShellSidebarNavPaddingClass(navCollapsed));

/** Designer / ensureShell* nav host container (wraps platform-nav). */
export const ADMIN_SHELL_SIDEBAR_NAV_HOST_CONTAINER_CLASS = cn(
  'flex flex-col flex-1 min-h-0 overflow-hidden pt-3 pb-2 px-[16px]',
  ADMIN_SHELL_SIDEBAR_NAV_HOST_CLASS,
);

/** Designer logo row seed — height tightens via global collapsed CSS when rail is 81px. */
export const ADMIN_SHELL_SIDEBAR_LOGO_REGION_TEMPLATE_CLASS = cn(
  'flex shrink-0 items-center justify-center',
  ADMIN_SHELL_SIDEBAR_LOGO_BAND_EXPANDED_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_REGION_CLASS,
);

export const ADMIN_SHELL_SIDEBAR_INSET_TEMPLATE_CLASS = cn(
  'shrink-0 px-[16px]',
  ADMIN_SHELL_SIDEBAR_INSET_CLASS,
);
