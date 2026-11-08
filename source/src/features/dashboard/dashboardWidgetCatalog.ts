import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Bookmark,
  Inbox,
  LineChart,
  MessagesSquare,
  UserRound,
  Zap,
} from 'lucide-react';
import type { AppSurfaceBoxTone } from '../../shared/ui/surfaceClasses';
import type { DashboardLayoutBlockId } from '../../shared/lib/userDashboardLayout';

export type DashboardWidgetCatalogEntry = {
  id: DashboardLayoutBlockId;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  tone: AppSurfaceBoxTone;
};

export const DASHBOARD_WIDGET_CATALOG: readonly DashboardWidgetCatalogEntry[] = [
  {
    id: 'kpi',
    labelKey: 'dashboard.layout.widget.kpi',
    descriptionKey: 'dashboard.layout.widget.kpi.description',
    icon: BarChart3,
    tone: 'slate',
  },
  {
    id: 'insights',
    labelKey: 'dashboard.insights.title',
    descriptionKey: 'dashboard.layout.widget.insights.description',
    icon: LineChart,
    tone: 'cyan',
  },
  {
    id: 'my-inbox',
    labelKey: 'dashboard.myInbox.title',
    descriptionKey: 'dashboard.layout.widget.my-inbox.description',
    icon: Inbox,
    tone: 'violet',
  },
  {
    id: 'my-links',
    labelKey: 'dashboard.myLinks.title',
    descriptionKey: 'dashboard.layout.widget.my-links.description',
    icon: UserRound,
    tone: 'indigo',
  },
  {
    id: 'my-shortcuts',
    labelKey: 'dashboard.myShortcuts.title',
    descriptionKey: 'dashboard.layout.widget.my-shortcuts.description',
    icon: Bookmark,
    tone: 'violet',
  },
  {
    id: 'feedback',
    labelKey: 'dashboard.feedback.title',
    descriptionKey: 'dashboard.layout.widget.feedback.description',
    icon: MessagesSquare,
    tone: 'rose',
  },
  {
    id: 'health',
    labelKey: 'dashboard.health.title',
    descriptionKey: 'dashboard.layout.widget.health.description',
    icon: Activity,
    tone: 'emerald',
  },
  {
    id: 'quick-actions',
    labelKey: 'dashboard.quickActions.title',
    descriptionKey: 'dashboard.layout.widget.quick-actions.description',
    icon: Zap,
    tone: 'amber',
  },
] as const;

export const resolveDashboardWidgetCatalog = (
  availableIds: readonly DashboardLayoutBlockId[],
): DashboardWidgetCatalogEntry[] => {
  const available = new Set(availableIds);
  return DASHBOARD_WIDGET_CATALOG.filter((entry) => available.has(entry.id));
};

export const resolveDashboardWidgetCatalogEntry = (
  widgetId: DashboardLayoutBlockId,
): DashboardWidgetCatalogEntry | undefined =>
  DASHBOARD_WIDGET_CATALOG.find((entry) => entry.id === widgetId);
