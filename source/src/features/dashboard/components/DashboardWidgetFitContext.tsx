import React, { createContext, useContext } from 'react';
import {
  DASHBOARD_WIDGET_FIT_FALLBACK,
  type DashboardWidgetFit,
} from '../dashboardWidgetFit';

const DashboardWidgetFitContext = createContext<DashboardWidgetFit>(DASHBOARD_WIDGET_FIT_FALLBACK);

export const DashboardWidgetFitProvider: React.FC<{
  value: DashboardWidgetFit;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <DashboardWidgetFitContext.Provider value={value}>
    {children}
  </DashboardWidgetFitContext.Provider>
);

export const useDashboardWidgetFit = (): DashboardWidgetFit =>
  useContext(DashboardWidgetFitContext);
