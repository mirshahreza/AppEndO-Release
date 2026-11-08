import React from 'react';
import { ScrollText } from 'lucide-react';
import {
  AppButton,
  AppDialogShell,
  DialogBody,
  DialogPrimaryHeader,
} from '../../../shared/ui';
import {
  formatRecordEventValue,
  recordEventActorStackedLabel,
  recordEventReasonStackedLabel,
} from '../../../shared/lib/formatRecordEventValue';
import type { RecordEventsPageModel } from '../hooks/useRecordEventsPage';

type RecordEventDetailModalProps = {
  page: RecordEventsPageModel;
};

export const RecordEventDetailModal: React.FC<RecordEventDetailModalProps> = ({ page }) => {
  const item = page.selectedEvent;
  if (!item) {
    return null;
  }

  const chips = [
    item.eventKind,
    item.outcome,
    item.subjectKind,
    item.subjectId,
    item.field,
    item.actorKind,
    item.clientChannel,
    item.requestId,
  ].filter((value): value is string => Boolean(value));
  const actor = recordEventActorStackedLabel(item);
  const reason = recordEventReasonStackedLabel(item);
  const hasReason = Boolean(item.reasonCode || item.reasonText || item.reasonLabel);

  return (
    <AppDialogShell
      size="lg"
      onClose={page.closeDetail}
      onBackdropClick={page.closeDetail}
      ariaLabel="Record event detail"
    >
      <DialogPrimaryHeader
        title={item.eventKind}
        onClose={page.closeDetail}
        titleClassName="text-sm"
      />
      <DialogBody gradient>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {chips.map((chip, idx) => (
            <span
              key={`${idx}-${chip}`}
              className={`inline-flex max-w-[45%] items-center truncate rounded border px-2 py-0.5 text-[11px] ${
                idx % 5 === 0
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                  : idx % 5 === 1
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : idx % 5 === 2
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : idx % 5 === 3
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {chip}
            </span>
          ))}
        </div>
        <dl className="grid gap-2 text-xs text-slate-700">
          <div>
            <dt className="text-slate-500">Time</dt>
            <dd className="font-mono">{item.occurredAt}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Change</dt>
            <dd>
              {formatRecordEventValue(item.fromValue)}
              {' → '}
              {formatRecordEventValue(item.toValue)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Actor</dt>
            <dd>
              <p className="font-medium text-slate-700">{actor.title}</p>
              {actor.subtitle ? <p className="text-slate-500">{actor.subtitle}</p> : null}
            </dd>
          </div>
          {hasReason ? (
            <div>
              <dt className="text-slate-500">Reason</dt>
              <dd>
                <p className="font-medium text-slate-700">{reason.title}</p>
                {reason.subtitle ? <p className="text-slate-500">{reason.subtitle}</p> : null}
              </dd>
            </div>
          ) : null}
        </dl>
        {item.requestId ? (
          <div className="mt-4">
            <AppButton
              size="sm"
              intent="secondary"
              onClick={() => page.viewHttpLog(item.requestId as string)}
            >
              <ScrollText className="h-3.5 w-3.5" />
              View HTTP log
            </AppButton>
          </div>
        ) : null}
      </DialogBody>
    </AppDialogShell>
  );
};
