/** Collapsed admin-shell sidebar rail (geometry lock). */
export const ADMIN_SHELL_SIDEBAR_WIDTH_COLLAPSED_PX = 81;

/** Default expanded sidebar width when portal does not override. */
export const ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX = 250;

export const ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MIN_PX = 220;
export const ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MAX_PX = 360;

export const clampAdminShellSidebarExpandedWidthPx = (value: number): number => (
  Math.min(
    ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MAX_PX,
    Math.max(ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MIN_PX, Math.round(value)),
  )
);

export const resolveAdminShellSidebarExpandedWidthPx = (
  portalWidthPx: number | undefined | null,
): number => clampAdminShellSidebarExpandedWidthPx(
  portalWidthPx ?? ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
);

export const formatAdminShellSidebarWidthCss = (px: number): string => `${px}px`;

export const applyAdminShellSidebarWidthCssVariables = (expandedWidthPx: number): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const clamped = clampAdminShellSidebarExpandedWidthPx(expandedWidthPx);
  document.documentElement.style.setProperty(
    '--admin-shell-sidebar-width',
    formatAdminShellSidebarWidthCss(clamped),
  );
};
