import React from 'react';
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';

import { useCultureT } from '../../../core/culture/CultureContext';
import { AppButton } from '../AppButton';
import { UiTooltip } from '../UiTooltip';
import type { RecordSubjectTimelineDirection } from './recordSubjectTimelineSpineLayout';
import { RECORD_SUBJECT_TIMELINE_CULTURE, RECORD_SUBJECT_TIMELINE_FALLBACK_COPY } from './recordSubjectTimelineCulture';

export type RecordSubjectTimelineSortToggleProps = {
  direction: RecordSubjectTimelineDirection;
  onToggle: () => void;
};

export const RecordSubjectTimelineSortToggle: React.FC<RecordSubjectTimelineSortToggleProps> = ({
  direction,
  onToggle,
}) => {
  const t = useCultureT();
  const labelKey =
    direction === 'newestFirst'
      ? RECORD_SUBJECT_TIMELINE_CULTURE.sortToggleToOldestFirst
      : RECORD_SUBJECT_TIMELINE_CULTURE.sortToggleToNewestFirst;

  const label = t(labelKey, RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[labelKey]);

  return (
    <UiTooltip content={label}>
      <AppButton
        type="button"
        intent="ghost"
        size="sm"
        aria-label={label}
        title={label}
        onClick={onToggle}
      >
        {direction === 'newestFirst' ? (
          <ArrowDownWideNarrow className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.25} aria-hidden />
        ) : (
          <ArrowUpWideNarrow className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.25} aria-hidden />
        )}
      </AppButton>
    </UiTooltip>
  );
};
