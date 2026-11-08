import { insertOrReturnExistingInbox } from '../workflowEventInboxRepository';
import { encodeCorrelationValue } from './eventCorrelation';
import { correlateInboxEntry, type CorrelationOutcome } from './eventCorrelationService';
import { startWorkflowsForEvent, type EventStartFanoutSummary } from './eventStartFanout';
import type { JsonValue } from '../awm/types';
import type { WorkflowEventInboxRecord } from '../types';

/**
 * Event ingress (doc 06 section 9) — "Ingress persists first. Event payload classification,
 * deduplication and canonical correlation encoding occur before candidate matching." This module
 * is the ingress + immediate first-pass-correlation entry point; the bounded recheck sweep for
 * events that arrive before their matching wait exists is `eventCorrelationService.ts`'s
 * `scanAndRecheckUnmatchedEvents`.
 *
 * `correlationValue` is the caller-supplied already-derived scalar (see `eventCorrelation.ts`'s
 * module doc comment for why ingress cannot derive it itself). Payload classification/schema
 * projection is the caller's responsibility (no generic event-schema registry exists in this
 * repository, matching every other Repository Reality Audit finding in this domain) — `payload` is
 * stored as the classified canonical projection ingress received.
 */
export type IngestWorkflowEventInput = {
  eventName: string;
  eventSourceIdentity: string;
  payload: JsonValue;
  providerEventId?: string;
  correlationValue?: JsonValue;
  deduplicationKey?: string;
  recheckUntilMs?: number;
  leaseOwnerId: string;
};

export type IngestWorkflowEventOutcome = {
  inbox: WorkflowEventInboxRecord;
  wasCreated: boolean;
  correlation?: CorrelationOutcome;
  startFanout?: EventStartFanoutSummary;
};

export async function ingestWorkflowEvent(input: IngestWorkflowEventInput): Promise<IngestWorkflowEventOutcome> {
  const encoded = input.correlationValue !== undefined ? encodeCorrelationValue(input.correlationValue) : undefined;

  const { record, wasCreated } = await insertOrReturnExistingInbox({
    eventName: input.eventName,
    eventSourceIdentity: input.eventSourceIdentity,
    providerEventId: input.providerEventId,
    payloadJson: JSON.stringify(input.payload),
    correlationValueHash: encoded?.correlationValueHash,
    correlationEncoderVersion: encoded?.correlationEncoderVersion,
    correlationHashAlgorithm: encoded?.correlationHashAlgorithm,
    deduplicationKey: input.deduplicationKey,
    recheckUntilMs: input.recheckUntilMs,
  });

  if (!wasCreated) {
    // Deduplicated delivery — the original ingress already drove correlation; never re-process (doc 03 section 27).
    return { inbox: record, wasCreated };
  }

  const correlation = await correlateInboxEntry(record.id, input.leaseOwnerId);
  const startFanout = await startWorkflowsForEvent({ eventName: input.eventName, payload: input.payload });
  return { inbox: correlation.inbox, wasCreated, correlation, startFanout };
}
