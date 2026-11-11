import React from 'react';
import { Activity, Clock, User } from 'lucide-react';

import type { RecordEventPublicRow } from '../../api/contracts/record-events';
import { recordEventActorStackedLabel } from '../../lib/formatRecordEventValue';
import { MountGridDateText } from '../../../app/platform/MountGridDateText';
import { cn } from '../../../lib/utils';
import { mapRecordEventToTimelineCard } from './mapRecordEventToTimelineCard';
import {
  RECORD_SUBJECT_TIMELINE_CARD_ACCENT_CLASS,
  RECORD_SUBJECT_TIMELINE_CARD_CLASS,
  RECORD_SUBJECT_TIMELINE_EVENT_CARD_MAX_CLASS,
  resolveRecordSubjectTimelineEventTone,
} from './recordSubjectTimelinePresentation';
import {
  RecordSubjectTimelineCardDetailLines,
  RecordSubjectTimelineCardShell,
} from './RecordSubjectTimelineSpine';
import { RECORD_SUBJECT_TIMELINE_FALLBACK_COPY, RECORD_SUBJECT_TIMELINE_CULTURE } from './recordSubjectTimelineCulture';
import { useCultureT } from '../../../core/culture/CultureContext';

const ROW_ICON_CLASS = '!h-6 !w-6 shrink-0 rounded-md [&_svg]:!h-3 [&_svg]:!w-3';
const ACTOR_ICON_CLASS = '!h-5 !w-5 shrink-0 [&_svg]:!h-2.5 [&_svg]:!w-2.5';

export type RecordSubjectTimelineRecordEventCardProps = {
  item: RecordEventPublicRow;
  onSelect: () => void;
};

export const RecordSubjectTimelineRecordEventCard: React.FC<RecordSubjectTimelineRecordEventCardProps> = ({
  item,
  onSelect,
}) => {
  const t = useCultureT();
  const tone = resolveRecordSubjectTimelineEventTone(item);
  const { title, lead, facts } = mapRecordEventToTimelineCard(item);
  const actor = recordEventActorStackedLabel(item);
  const systemLabel = t(
    RECORD_SUBJECT_TIMELINE_CULTURE.systemActor,
    RECORD_SUBJECT_TIMELINE_FALLBACK_COPY[RECORD_SUBJECT_TIMELINE_CULTURE.systemActor],
  );
  const isSystemActor = actor.title === systemLabel || item.actorKind === 'system' || item.actorKind === 'workflow';
  const showLead = Boolean(lead.trim());
  const showFacts = facts.length > 0;
  const showBodyDivider = showLead || showFacts;

  return (
    <RecordSubjectTimelineCardShell
      toneClassName={RECORD_SUBJECT_TIMELINE_CARD_CLASS[tone]}
      accentClassName={RECORD_SUBJECT_TIMELINE_CARD_ACCENT_CLASS[tone]}
      maxWidthClassName={RECORD_SUBJECT_TIMELINE_EVENT_CARD_MAX_CLASS}
      onClick={onSelect}
    >
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0">
        <span
          className={cn(
            ROW_ICON_CLASS,
            'col-start-1 row-start-1 inline-flex items-center justify-center rounded-md bg-slate-100 text-slate-700',
          )}
          aria-hidden
        >
          <Activity className="h-3 w-3" />
        </span>
        <p className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 text-sm font-bold leading-snug">
          <span className="text-slate-900">{title}</span>
        </p>
      </div>
      {showBodyDivider ? (
        <div className="mt-2 border-t border-slate-200/50 px-1 pt-3 pb-1">
          {showLead ? (
            <p className="text-xs font-semibold leading-relaxed text-slate-800 line-clamp-6">{lead}</p>
          ) : null}
          <RecordSubjectTimelineCardDetailLines lines={facts} separatedFromAbove={showLead} />
        </div>
      ) : (
        <div className="mt-1 border-t border-slate-200/35 pt-0.5" aria-hidden />
      )}
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-slate-200/50 pt-1.5">
        <span
          className={cn(ACTOR_ICON_CLASS, 'inline-flex items-center justify-center rounded text-slate-500')}
          aria-hidden
        >
          <Clock />
        </span>
        <MountGridDateText
          value={item.occurredAt}
          align="start"
          className="!w-auto min-w-0 shrink-0 truncate dir-ltr text-start text-xs font-semibold leading-none tabular-nums text-slate-600"
        />
        {item.occurredAt.includes('T') ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums leading-none text-slate-500 dir-ltr">
            {item.occurredAt.slice(11, 16)}
          </span>
        ) : null}
        <span className="h-3 w-px shrink-0 bg-slate-200/90" aria-hidden />
        <span
          className={cn(
            ACTOR_ICON_CLASS,
            'inline-flex items-center justify-center rounded',
            isSystemActor ? 'text-cyan-700' : 'text-slate-600',
          )}
          aria-hidden
        >
          <User />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold leading-none text-slate-700">{actor.title}</p>
      </div>
    </RecordSubjectTimelineCardShell>
  );
};
