import React, { useCallback } from 'react';
import type { HomeWidgetRegistryEntry } from '../../../shared/api/contracts/home-widgets';
import { isDashboardLayoutBlockId, type DashboardWidgetId } from '../../../shared/lib/userDashboardLayout';
import { useDashboardPage } from '../hooks/useDashboardPage';

type DashboardPageModel = ReturnType<typeof useDashboardPage>;
import { resolveHomeWidgetRegistryEntry } from '../homeWidgetRegistry';
import { ModuleHomeWidgetHost } from './ModuleHomeWidgetHost';
import { DashboardFeedbackBox } from './DashboardFeedbackBox';
import { DashboardInsights } from './DashboardInsights';
import { DashboardKpiRow } from './DashboardKpiRow';
import { DashboardMyLinks } from './DashboardMyLinks';
import { DashboardMyShortcuts } from './DashboardMyShortcuts';
import { DashboardMyInbox } from './DashboardMyInbox';
import { DashboardQuickActions } from './DashboardQuickActions';
import { DashboardSystemHealth } from './DashboardSystemHealth';

type UseDashboardWidgetRendererInput = {
  page: DashboardPageModel;
  registry: HomeWidgetRegistryEntry[];
};

export function useDashboardWidgetRenderer({ page, registry }: UseDashboardWidgetRendererInput) {
  return useCallback((widgetId: DashboardWidgetId): React.ReactNode => {
    if (isDashboardLayoutBlockId(widgetId)) {
      switch (widgetId) {
        case 'kpi':
          return <DashboardKpiRow cards={page.kpiCards} isLoading={page.isLoadingAdminData} />;
        case 'insights':
          return <DashboardInsights links={page.insightLinks} />;
        case 'my-inbox':
          return <DashboardMyInbox />;
        case 'feedback':
          return <DashboardFeedbackBox />;
        case 'health':
          return <DashboardSystemHealth rows={page.healthRows} />;
        case 'quick-actions':
          return <DashboardQuickActions actions={page.quickActions} />;
        case 'my-links':
          return <DashboardMyLinks links={page.myLinks} />;
        case 'my-shortcuts':
          return <DashboardMyShortcuts />;
        default:
          return null;
      }
    }

    const entry = resolveHomeWidgetRegistryEntry(registry, widgetId);
    if (!entry) {
      return null;
    }
    return <ModuleHomeWidgetHost entry={entry} />;
  }, [
    page.healthRows,
    page.insightLinks,
    page.isLoadingAdminData,
    page.kpiCards,
    page.myLinks,
    page.quickActions,
    registry,
  ]);
}
