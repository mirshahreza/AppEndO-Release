import * as React from 'react';
import type { RecordEventPublicRow } from '../../../shared/api/contracts/record-events';
import {
  RecordSubjectTimelineRecordEventCard,
  RecordSubjectTimelineSortToggle,
  RecordSubjectTimelineSpine,
  RECORD_SUBJECT_TIMELINE_SPINE_DOT_CLASS,
  resolveRecordSubjectTimelineEventTone,
  type RecordSubjectTimelineDirection,
} from '../../../shared/ui/recordSubjectTimeline';
import { RECORD_SUBJECT_TIMELINE_ICON } from '../../../shared/ui/RecordEventHistoryIcon';
import { BaseComponentsPreviewFrame, BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import { BASE_COMPONENTS_PREVIEW_BODY_CLASS } from '../baseComponentsConfiguratorLayout';

const SAMPLE_EVENTS: RecordEventPublicRow[] = [
  {
    id: 'evt-2',
    subjectKind: 'base_sample_mock_records',
    subjectId: '1',
    occurredAt: new Date(2026, 5, 12, 14, 30).toISOString(),
    actorUserId: 1,
    actingAsUserId: null,
    actorKind: 'user',
    outcome: 'success',
    source: 'patch',
    sourceRef: null,
    requestId: null,
    eventKind: 'field.changed',
    field: 'displayName',
    fromValue: { value: 'Alpha' },
    toValue: { value: 'Beta' },
    reasonCode: null,
    reasonText: null,
    reasonLabel: null,
    actorUsername: 'admin',
    actorDisplayName: 'Studio Admin',
    correlationId: 'c1',
    subjectSeq: 2,
    clientChannel: null,
    clientInstallId: null,
    clientJson: null,
    payload: null,
  },
  {
    id: 'evt-1',
    subjectKind: 'base_sample_mock_records',
    subjectId: '1',
    occurredAt: new Date(2025, 10, 3, 9, 15).toISOString(),
    actorUserId: null,
    actingAsUserId: null,
    actorKind: 'system',
    outcome: 'success',
    source: 'workflow',
    sourceRef: null,
    requestId: null,
    eventKind: 'created',
    field: null,
    fromValue: null,
    toValue: null,
    reasonCode: null,
    reasonText: null,
    reasonLabel: null,
    actorUsername: null,
    actorDisplayName: null,
    correlationId: 'c0',
    subjectSeq: 1,
    clientChannel: null,
    clientInstallId: null,
    clientJson: null,
    payload: null,
  },
];

export const RecordSubjectTimelineBaseComponentsWorkspace: React.FC = () => {
  const [direction, setDirection] = React.useState<RecordSubjectTimelineDirection>('newestFirst');

  return (
    <BaseComponentsPreviewFrame className={BASE_COMPONENTS_WORKSPACE_INSET_CLASS}>
      <div className={`${BASE_COMPONENTS_PREVIEW_BODY_CLASS} flex min-h-0 flex-col gap-3`}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <RECORD_SUBJECT_TIMELINE_ICON className="h-4 w-4 text-cyan-700" aria-hidden />
            Record timeline (spine)
          </div>
          <RecordSubjectTimelineSortToggle
            direction={direction}
            onToggle={() => setDirection((current) => (
              current === 'newestFirst' ? 'oldestFirst' : 'newestFirst'
            ))}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RecordSubjectTimelineSpine
            events={SAMPLE_EVENTS}
            direction={direction}
            resolveSpineDotClassName={(item) => {
              const tone = resolveRecordSubjectTimelineEventTone(item);
              return RECORD_SUBJECT_TIMELINE_SPINE_DOT_CLASS[tone];
            }}
            renderEventCard={(item, onSelect) => (
              <RecordSubjectTimelineRecordEventCard item={item} onSelect={onSelect} />
            )}
          />
        </div>
      </div>
    </BaseComponentsPreviewFrame>
  );
};
