import React from 'react';
import { Activity, Inbox, LineChart, Users } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import {
  DASHBOARD_BODY_PAD_STRIP_CLASS,
  DASHBOARD_CAPTION_ACTION_GLYPH_CLASS,
  DASHBOARD_HEADER_ICON_CLASS,
  dashboardFitCaptionGridClass,
} from '../dashboardDensity';
import type { DashboardInsightLink } from '../types';
import { DashboardFitAction } from './DashboardFitAction';
import { useDashboardWidgetFit } from './DashboardWidgetFitContext';
import { DashboardWidgetShell } from './DashboardWidgetShell';

const INSIGHT_ICONS = {
  'studio-insights-ops': Activity,
  'studio-insights-work': Inbox,
  'studio-insights-people': Users,
} as const;

type DashboardInsightsProps = {
  links: DashboardInsightLink[];
  className?: string;
};

export const DashboardInsights: React.FC<DashboardInsightsProps> = ({ links = [], className }) => {
  const t = useCultureT();
  const fit = useDashboardWidgetFit();

  return (
    <DashboardWidgetShell
      title={t('dashboard.insights.title')}
      headerIcon={<LineChart className={DASHBOARD_HEADER_ICON_CLASS} />}
      className={className}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      {links.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-500">{t('dashboard.insights.empty')}</p>
      ) : (
        <div className={links.length <= 3 ? 'grid grid-cols-3 gap-1' : dashboardFitCaptionGridClass(fit.iconColumns)}>
          {links.map((link) => {
            const Icon = INSIGHT_ICONS[link.pageKey as keyof typeof INSIGHT_ICONS] ?? LineChart;
            return (
              <DashboardFitAction
                key={link.pageKey}
                layout="caption"
                iconOnly
                icon={<Icon className={cn(DASHBOARD_CAPTION_ACTION_GLYPH_CLASS, 'shrink-0')} />}
                label={t(link.labelKey)}
                description={t(link.descriptionKey)}
                hintTone="cyan"
                to={link.path}
              />
            );
          })}
        </div>
      )}
    </DashboardWidgetShell>
  );
};
