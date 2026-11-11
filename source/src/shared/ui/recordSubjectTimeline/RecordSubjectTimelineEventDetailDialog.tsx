import React from 'react';
import { RotateCcw } from 'lucide-react';

import type { RecordEventPublicRow } from '../../api/contracts/record-events';
import { canRestoreRecordEvent, formatRecordEventValue, recordEventActorStackedLabel, recordEventReasonStackedLabel } from '../../lib/formatRecordEventValue';
import { useCultureT } from '../../../core/culture/CultureContext';
import { AppButton } from '../AppButton';
import { CreateEditModalShell } from '../CreateEditModalShell';
import { MountGridDateText } from '../../../app/platform/MountGridDateText';
import { RECORD_SUBJECT_TIMELINE_CULTURE, RECORD_SUBJECT_TIMELINE_FALLBACK_COPY } from './recordSubjectTimelineCulture';
import { recordEventTimelineCardTitle } from './mapRecordEventToTimelineCard';

export type RecordSubjectTimelineEventDetailDialogProps = {
  open: boolean;
  item: RecordEventPublicRow | null;
  onClose: () => void;
  onRestore?: (item: RecordEventPublicRow) => void | Promise<void>;
};

export const RecordSubjectTimelineEventDetailDialog: React.FC<RecordSubjectTimelineEventDetailDialogProps> = ({
  open,
  item,
  onClose,
  onRestore,
}) => {
  const t = useCultureT();
  if (!open || !item) {
    return null;
  }

  const title = t(
    RECORD_SUBJECT_TIMELINE_CULTURE.eventDetailTitle,
    RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.eventDetailTitle],
  );
  const actor = recordEventActorStackedLabel(item);
  const reason = recordEventReasonStackedLabel(item);
  const restoreLabel = t(
    RECORD_SUBJECT_TIMELINE_CULTURE.restorePreviousValue,
    RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.restorePreviousValue],
  );
  const canRestore = Boolean(onRestore) && canRestoreRecordEvent(item);

  return (
    <CreateEditModalShell
      size="md"
      title={title}
      subtitle={recordEventTimelineCardTitle(item)}
      onClose={onClose}
      footer={canRestore ? (
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          leadingIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
          onClick={() => void onRestore?.(item)}
        >
          {restoreLabel}
        </AppButton>
      ) : undefined}
    >
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Time</dt>
          <dd className="mt-0.5">
            <MountGridDateText value={item.occurredAt} align="start" />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Kind</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{item.eventKind}</dd>
        </div>
        {item.field ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Field</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-700">{item.field}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">From</dt>
          <dd className="mt-0.5 break-words text-slate-800">{formatRecordEventValue(item.fromValue)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">To</dt>
          <dd className="mt-0.5 break-words text-slate-800">{formatRecordEventValue(item.toValue)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Actor</dt>
          <dd className="mt-0.5 text-slate-800">
            {[actor.title, actor.subtitle].filter(Boolean).join(' · ')}
          </dd>
        </div>
        {reason.title !== '—' ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Reason</dt>
            <dd className="mt-0.5 text-slate-800">
              {[reason.title, reason.subtitle].filter(Boolean).join(' · ')}
            </dd>
          </div>
        ) : null}
      </dl>
    </CreateEditModalShell>
  );
};
