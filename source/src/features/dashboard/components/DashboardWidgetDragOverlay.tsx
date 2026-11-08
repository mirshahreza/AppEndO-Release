import React, { useMemo } from 'react';
import { DragOverlay, type Modifier } from '@dnd-kit/core';
import { cn } from '../../../lib/utils';
import type { DashboardWidgetId } from '../../../shared/lib/userDashboardLayout';
import { resolveDashboardWidgetFit } from '../dashboardWidgetFit';
import { DashboardWidgetFitProvider } from './DashboardWidgetFitContext';

export type DashboardWidgetDragOverlayProps = {
  activeId: DashboardWidgetId | null;
  width: number;
  height: number;
  span: number;
  modifiers?: Modifier[];
  children: React.ReactNode;
};

export const DashboardWidgetDragOverlay: React.FC<DashboardWidgetDragOverlayProps> = ({
  activeId,
  width,
  height,
  span,
  modifiers,
  children,
}) => {
  const fit = useMemo(
    () => resolveDashboardWidgetFit({ width, height, span }),
    [height, span, width],
  );
  const lockedWidth = Math.max(0, width);
  const lockedHeight = Math.max(0, height);

  return (
    <DragOverlay adjustScale={false} dropAnimation={null} modifiers={modifiers} zIndex={40}>
      {activeId ? (
        <DashboardWidgetFitProvider value={fit}>
          <div
            className={cn(
              'pointer-events-none origin-top-left overflow-hidden rounded-3xl bg-white',
              'shadow-[0_16px_40px_-10px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80',
            )}
            style={{
              width: lockedWidth,
              height: lockedHeight,
              maxWidth: lockedWidth,
            }}
          >
            {children}
          </div>
        </DashboardWidgetFitProvider>
      ) : null}
    </DragOverlay>
  );
};
