import type { RecordEventPublicRow } from '../../api/contracts/record-events';
import {
  formatRecordEventValue,
  recordEventActorStackedLabel,
  recordEventReasonStackedLabel,
} from '../../lib/formatRecordEventValue';

export type RecordSubjectTimelineCardBody = {
  title: string;
  lead: string;
  facts: Array<{ label: string; value: string }>;
};

export function recordEventTimelineCardTitle(item: RecordEventPublicRow): string {
  if (item.projection === 'auth') {
    return 'Sign-in';
  }
  if (item.field) {
    return item.field;
  }
  return item.eventKind;
}

export function mapRecordEventToTimelineCard(item: RecordEventPublicRow): RecordSubjectTimelineCardBody {
  const title = recordEventTimelineCardTitle(item);
  const fromText = formatRecordEventValue(item.fromValue);
  const toText = formatRecordEventValue(item.toValue);
  const lead =
    item.eventKind === 'field.changed' && (item.fromValue != null || item.toValue != null)
      ? `${fromText} → ${toText}`
      : '';
  const actor = recordEventActorStackedLabel(item);
  const reason = recordEventReasonStackedLabel(item);
  const facts: Array<{ label: string; value: string }> = [
    { label: 'Kind', value: item.eventKind },
  ];
  if (item.field) {
    facts.push({ label: 'Field', value: item.field });
  }
  if (actor.title !== '—') {
    facts.push({
      label: 'Actor',
      value: [actor.title, actor.subtitle].filter(Boolean).join(' · '),
    });
  }
  if (reason.title !== '—') {
    facts.push({
      label: 'Reason',
      value: [reason.title, reason.subtitle].filter(Boolean).join(' · '),
    });
  }
  if (item.outcome && item.outcome !== 'success') {
    facts.push({ label: 'Outcome', value: item.outcome });
  }
  return { title, lead, facts };
}
