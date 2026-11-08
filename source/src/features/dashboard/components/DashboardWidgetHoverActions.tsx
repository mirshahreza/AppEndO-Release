import React, { useState } from 'react';
import { cn } from '../../../lib/utils';
import { DashboardWidgetCloseButton } from './DashboardWidgetCloseButton';
import { DashboardWidgetSettingsButton } from './DashboardWidgetSettingsButton';

type DashboardWidgetHoverActionsProps = {
  className?: string;
};

export const DashboardWidgetHoverActions: React.FC<DashboardWidgetHoverActionsProps> = ({
  className,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const stopDrag: React.PointerEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity',
        'group-hover/sortable:opacity-100',
        settingsOpen && 'opacity-100',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none flex items-center gap-0.5 rounded-lg border border-slate-200/80 bg-white/95 p-0.5 shadow-sm',
          'group-hover/sortable:pointer-events-auto',
          settingsOpen && 'pointer-events-auto',
        )}
      >
      <DashboardWidgetSettingsButton
        onOpenChange={setSettingsOpen}
        onPointerDown={stopDrag}
      />
      <DashboardWidgetCloseButton onPointerDown={stopDrag} />
      </div>
    </div>
  );
};
