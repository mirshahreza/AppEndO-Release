import type { AdminShellNavGroup } from '../types';

export type NavRendererProps = {
  groups: AdminShellNavGroup[];
  pathname: string;
  isSidebarCollapsed: boolean;
  isRtl: boolean;
  expandedGroups: Set<string>;
  onExpandedGroupsChange: (groups: Set<string>) => void;
  onNavigate: (path: string) => void;
  isExperienceMount?: boolean;
  /** When true, only one headed group is expanded. Combined with lockActiveGroup, the active route group stays open as well. */
  accordion?: boolean;
  /** When true (default), the group containing the active route cannot be collapsed. */
  lockActiveGroup?: boolean;
  /** When true, menu fills parent height; each expanded group body scrolls independently. */
  fillHeight?: boolean;
  /** Vertical gap between navigation groups in pixels (0–30). */
  groupGapPx?: number;
  /** When true, at least one headed group stays expanded; the last open group cannot collapse. Default false. */
  requireOpenGroup?: boolean;
};
