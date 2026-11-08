import React from 'react';
import { Zap } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import {
  DASHBOARD_BODY_PAD_STRIP_CLASS,
  DASHBOARD_CAPTION_ACTION_GLYPH_CLASS,
  DASHBOARD_HEADER_ICON_CLASS,
  dashboardFitCaptionGridClass,
} from '../dashboardDensity';
import type { DashboardQuickAction } from '../types';
import { DashboardFitAction } from './DashboardFitAction';
import { useDashboardWidgetFit } from './DashboardWidgetFitContext';
import { DashboardWidgetShell } from './DashboardWidgetShell';

type DashboardQuickActionsProps = {
  actions: DashboardQuickAction[];
  className?: string;
};

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({ actions, className }) => {
  const t = useCultureT();
  const fit = useDashboardWidgetFit();

  return (
    <DashboardWidgetShell
      title={t('dashboard.quickActions.title')}
      headerIcon={<Zap className={DASHBOARD_HEADER_ICON_CLASS} />}
      className={className}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      <div className={actions.length <= 3 ? 'grid grid-cols-3 gap-1' : dashboardFitCaptionGridClass(fit.iconColumns)}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DashboardFitAction
              key={action.path}
              layout="caption"
              iconOnly
              icon={<Icon className={cn(DASHBOARD_CAPTION_ACTION_GLYPH_CLASS, 'shrink-0')} />}
              label={action.label}
              description={action.description}
              hintTone="amber"
              to={action.path}
            />
          );
        })}
      </div>
    </DashboardWidgetShell>
  );
};
