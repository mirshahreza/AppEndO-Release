/** Culture keys — single product name and copy for record-subject timeline surfaces. */
export const RECORD_SUBJECT_TIMELINE_CULTURE = {
  title: 'platform.recordSubjectTimeline.title',
  triggerLabel: 'platform.recordSubjectTimeline.triggerLabel',
  showFieldTimeline: 'platform.recordSubjectTimeline.showFieldTimeline',
  hideFieldTimeline: 'platform.recordSubjectTimeline.hideFieldTimeline',
  loading: 'platform.recordSubjectTimeline.loading',
  empty: 'platform.recordSubjectTimeline.empty',
  loadFailed: 'platform.recordSubjectTimeline.loadFailed',
  loadFailedDetail: 'platform.recordSubjectTimeline.loadFailedDetail',
  sortToggleToOldestFirst: 'platform.recordSubjectTimeline.sortToggleToOldestFirst',
  sortToggleToNewestFirst: 'platform.recordSubjectTimeline.sortToggleToNewestFirst',
  systemActor: 'platform.recordSubjectTimeline.systemActor',
  restorePreviousValue: 'platform.recordSubjectTimeline.restorePreviousValue',
  eventDetailTitle: 'platform.recordSubjectTimeline.eventDetailTitle',
} as const;

export const RECORD_SUBJECT_TIMELINE_FALLBACK_COPY: Record<
  (typeof RECORD_SUBJECT_TIMELINE_CULTURE)[keyof typeof RECORD_SUBJECT_TIMELINE_CULTURE],
  string
> = {
  'platform.recordSubjectTimeline.title': 'Record timeline',
  'platform.recordSubjectTimeline.triggerLabel': 'Record timeline',
  'platform.recordSubjectTimeline.showFieldTimeline': 'Show field timeline',
  'platform.recordSubjectTimeline.hideFieldTimeline': 'Hide field timeline',
  'platform.recordSubjectTimeline.loading': 'Loading timeline…',
  'platform.recordSubjectTimeline.empty': 'No timeline events yet.',
  'platform.recordSubjectTimeline.loadFailed': 'Failed to load timeline.',
  'platform.recordSubjectTimeline.loadFailedDetail': 'Unable to load timeline.',
  'platform.recordSubjectTimeline.sortToggleToOldestFirst': 'Show oldest first',
  'platform.recordSubjectTimeline.sortToggleToNewestFirst': 'Show newest first',
  'platform.recordSubjectTimeline.systemActor': 'System',
  'platform.recordSubjectTimeline.restorePreviousValue': 'Restore previous value',
  'platform.recordSubjectTimeline.eventDetailTitle': 'Timeline event',
};
