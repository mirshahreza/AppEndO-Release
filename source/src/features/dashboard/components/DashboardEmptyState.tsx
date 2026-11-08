import React from 'react';
import { cn } from '../../../lib/utils';
import { DASHBOARD_EMPTY_STATE_CLASS } from '../dashboardDensity';

type DashboardEmptyStateProps = {
  children: React.ReactNode;
  tone?: 'neutral' | 'error';
  className?: string;
};

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  children,
  tone = 'neutral',
  className,
}) => (
  <p
    className={cn(
      DASHBOARD_EMPTY_STATE_CLASS,
      tone === 'error' && 'text-rose-600',
      className,
    )}
  >
    {children}
  </p>
);
