import React from 'react';
import { History } from 'lucide-react';
import { useCultureT } from '../../core/culture/CultureContext';
import { cn } from '../../lib/utils';
import { ActionTooltip } from './ActionTooltip';
import { AppButton } from './AppButton';
import {
  RECORD_SUBJECT_TIMELINE_CULTURE,
  RECORD_SUBJECT_TIMELINE_FALLBACK_COPY,
} from './recordSubjectTimeline/recordSubjectTimelineCulture';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_VIEW_CLASS } from './surfaceClasses';

/** Canonical Lucide icon for record-subject timeline triggers — do not substitute variants. */
export const RECORD_SUBJECT_TIMELINE_ICON = History;

export type RecordEventHistoryIconProps = {
  onClick: () => void;
  label?: string;
  className?: string;
  pressed?: boolean;
};

export const RecordEventHistoryIcon: React.FC<RecordEventHistoryIconProps> = ({
  onClick,
  label,
  className,
  pressed,
}) => {
  const t = useCultureT();
  const resolvedLabel = label ?? t(
    RECORD_SUBJECT_TIMELINE_CULTURE.triggerLabel,
    RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.triggerLabel],
  );

  return (
    <ActionTooltip content={resolvedLabel}>
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
      aria-label={resolvedLabel}
      aria-pressed={pressed}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <RECORD_SUBJECT_TIMELINE_ICON className="h-3.5 w-3.5" aria-hidden />
    </AppButton>
    </ActionTooltip>
  );
};

export type RecordEventHistoryHeaderChrome = {
  available: boolean;
  fieldIconsVisible: boolean;
  toggleFieldIcons: () => void;
  openHistory: (field?: string) => void;
  soleTrackedField: string | null;
};

export const RecordEventHistoryFieldChromeToggle: React.FC<{
  history: RecordEventHistoryHeaderChrome;
}> = ({ history }) => {
  const t = useCultureT();
  const showFieldLabel = t(
    RECORD_SUBJECT_TIMELINE_CULTURE.showFieldTimeline,
    RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.showFieldTimeline],
  );
  const hideFieldLabel = t(
    RECORD_SUBJECT_TIMELINE_CULTURE.hideFieldTimeline,
    RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.hideFieldTimeline],
  );

  if (history.soleTrackedField) {
    return (
      <RecordEventHistoryIcon
        onClick={() => history.openHistory(history.soleTrackedField ?? undefined)}
      />
    );
  }

  return (
    <RecordEventHistoryIcon
      pressed={history.fieldIconsVisible}
      label={history.fieldIconsVisible ? hideFieldLabel : showFieldLabel}
      onClick={history.toggleFieldIcons}
    />
  );
};

export const recordEventHistoryFieldChromeToggle = (
  history: RecordEventHistoryHeaderChrome,
): React.ReactNode => {
  if (!history.available) {
    return undefined;
  }
  return <RecordEventHistoryFieldChromeToggle history={history} />;
};
