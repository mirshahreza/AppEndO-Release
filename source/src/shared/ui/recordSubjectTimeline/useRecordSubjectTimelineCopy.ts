import { useCultureT } from '../../../core/culture/CultureContext';
import { RECORD_SUBJECT_TIMELINE_CULTURE, RECORD_SUBJECT_TIMELINE_FALLBACK_COPY } from './recordSubjectTimelineCulture';

export function useRecordSubjectTimelineCopy() {
  const t = useCultureT();
  return {
    title: t(
      RECORD_SUBJECT_TIMELINE_CULTURE.title,
      RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.title],
    ),
    triggerLabel: t(
      RECORD_SUBJECT_TIMELINE_CULTURE.triggerLabel,
      RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.triggerLabel],
    ),
    showFieldTimeline: t(
      RECORD_SUBJECT_TIMELINE_CULTURE.showFieldTimeline,
      RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.showFieldTimeline],
    ),
    hideFieldTimeline: t(
      RECORD_SUBJECT_TIMELINE_CULTURE.hideFieldTimeline,
      RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.hideFieldTimeline],
    ),
    loading: t(
      RECORD_SUBJECT_TIMELINE_CULTURE.loading,
      RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.loading],
    ),
    empty: t(
      RECORD_SUBJECT_TIMELINE_CULTURE.empty,
      RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.empty],
    ),
    loadFailed: t(
      RECORD_SUBJECT_TIMELINE_CULTURE.loadFailed,
      RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.loadFailed],
    ),
    loadFailedDetail: t(
      RECORD_SUBJECT_TIMELINE_CULTURE.loadFailedDetail,
      RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.loadFailedDetail],
    ),
  };
}
