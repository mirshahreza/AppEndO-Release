import {
  DASHBOARD_HOME_SHORTCUT_MIME,
  readDashboardHomeShortcutDrag,
  type DashboardHomeShortcut,
} from '../../shared/lib/dashboardHomeShortcuts';

export const isDashboardHomeShortcutDrag = (types: readonly string[]): boolean =>
  types.includes(DASHBOARD_HOME_SHORTCUT_MIME);

export const prepareDashboardHomeShortcutDrop = (event: React.DragEvent): boolean => {
  if (!isDashboardHomeShortcutDrag(event.dataTransfer.types)) {
    return false;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  return true;
};

export const takeDashboardHomeShortcutDrop = (
  event: React.DragEvent,
): DashboardHomeShortcut | null => {
  if (!prepareDashboardHomeShortcutDrop(event)) {
    return null;
  }
  return readDashboardHomeShortcutDrag(event.dataTransfer);
};
