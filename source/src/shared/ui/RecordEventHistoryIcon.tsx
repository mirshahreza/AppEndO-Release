import React from 'react';
import { History } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ActionTooltip } from './ActionTooltip';
import { AppButton } from './AppButton';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_VIEW_CLASS } from './surfaceClasses';

export type RecordEventHistoryIconProps = {
  onClick: () => void;
  label?: string;
  className?: string;
  pressed?: boolean;
};

export const RecordEventHistoryIcon: React.FC<RecordEventHistoryIconProps> = ({
  onClick,
  label = 'History',
  className,
  pressed,
}) => (
  <ActionTooltip content={label}>
    <AppButton
      type="button"
      size="icon-sm"
      tabStop="skip"
      className={cn(
        ICON_ACTION_BUTTON_SM_CLASS,
        ICON_ACTION_VIEW_CLASS,
        pressed && 'bg-cyan-50 text-cyan-700',
        className,
      )}
      aria-label={label}
      aria-pressed={pressed}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <History className="h-3.5 w-3.5" aria-hidden />
    </AppButton>
  </ActionTooltip>
);

export type RecordEventHistoryHeaderChrome = {
  available: boolean;
  fieldIconsVisible: boolean;
  toggleFieldIcons: () => void;
  openHistory: (field?: string) => void;
  soleTrackedField: string | null;
};

export const recordEventHistoryFieldChromeToggle = (
  history: RecordEventHistoryHeaderChrome,
): React.ReactNode => {
  if (!history.available) {
    return undefined;
  }

  if (history.soleTrackedField) {
    return (
      <RecordEventHistoryIcon
        label="History"
        onClick={() => history.openHistory(history.soleTrackedField ?? undefined)}
      />
    );
  }

  return (
    <RecordEventHistoryIcon
      pressed={history.fieldIconsVisible}
      label={history.fieldIconsVisible ? 'Hide field history' : 'Show field history'}
      onClick={history.toggleFieldIcons}
    />
  );
};
