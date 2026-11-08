import React, { createContext, useContext } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DashboardWidgetId } from '../../../shared/lib/userDashboardLayout';
import type { DashboardWidgetDragSurface } from '../dashboardWidgetDragSurface';

export type DashboardSortableWidgetContextValue = {
  widgetId: DashboardWidgetId;
  dragSurface: DashboardWidgetDragSurface;
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
  isDragging: boolean;
  onClose: () => void;
};

const DashboardSortableWidgetContext = createContext<DashboardSortableWidgetContextValue | null>(null);

export const DashboardSortableWidgetProvider: React.FC<{
  value: DashboardSortableWidgetContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <DashboardSortableWidgetContext.Provider value={value}>
    {children}
  </DashboardSortableWidgetContext.Provider>
);

export const useOptionalDashboardSortableWidget = (): DashboardSortableWidgetContextValue | null =>
  useContext(DashboardSortableWidgetContext);
