export type {
  DashboardLayoutBlockId,
  DashboardLayoutPreference,
  DashboardWidgetId,
} from '../../shared/lib/userDashboardLayout';
export {
  DASHBOARD_LAYOUT_BLOCK_IDS,
  isDashboardLayoutBlockId,
  isDashboardLayoutFullWidthBlock,
  isDashboardWidgetId,
  mergeDashboardWidgetOrder,
  parseDashboardLayout,
  resolveVisibleDashboardWidgets,
} from '../../shared/lib/userDashboardLayout';
export {
  buildDashboardUniformLayoutRows,
  resolveDashboardWidgetLayoutSpan,
  type DashboardWidgetLayoutSpan,
} from './dashboardWidgetLayoutSpan';
import type { DashboardLayoutBlockId } from '../../shared/lib/userDashboardLayout';

export const buildDefaultDashboardWidgetOrder = (input: {
  isAdmin: boolean;
  feedbackEnabled: boolean;
}): DashboardLayoutBlockId[] => {
  const blocks: DashboardLayoutBlockId[] = [];

  if (input.isAdmin) {
    blocks.push('kpi');
    blocks.push('insights');
  }

  blocks.push('my-inbox');

  if (input.isAdmin) {
    blocks.push('health');
  }

  blocks.push('my-links');
  blocks.push('my-shortcuts');
  blocks.push('quick-actions');

  if (input.feedbackEnabled) {
    blocks.push('feedback');
  }

  return blocks;
};
