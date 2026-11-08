import React from 'react';
import { cn } from '../../lib/utils';
import { AppGridRowActions, type GridRowActionItem } from './AppGridRowActions';
import { APP_TABLE_GRID_CARD_ACTIONS_CLASS } from './surfaceClasses';

type AppTableGridCardFooterActionsProps = {
  actions: readonly GridRowActionItem[];
  maxVisible: number;
  className?: string;
};

export const AppTableGridCardFooterActions: React.FC<AppTableGridCardFooterActionsProps> = ({
  actions,
  maxVisible,
  className,
}) => {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={cn(APP_TABLE_GRID_CARD_ACTIONS_CLASS, 'mt-auto flex items-center justify-start gap-2', className)}>
      <AppGridRowActions
        actions={actions}
        maxVisible={maxVisible}
        align="start"
        density="card"
      />
    </div>
  );
};