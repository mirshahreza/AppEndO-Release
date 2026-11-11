import type { RecordEventKind } from '../../../shared/api/contracts/record-events';
import type {
  HwyMemberDossierChangeLogDetailLine,
  HwyMemberDossierChangeLogKind,
} from '../../../domain/hwy/hwyMemberDossierChangeLog';
import {
  HWY_MEMBER_DOSSIER_RECORD_PAYLOAD_KEY,
  type HwyMemberDossierRecordEventPayload,
} from '../../../domain/hwy/hwyMemberDossierRecordEventPayload';
import { emitRecordEvent } from './emitRecordEvent';

export type EmitHwyMemberDossierRecordEventInput = {
  memberId: number;
  dossierKind: HwyMemberDossierChangeLogKind | 'recordEvent';
  recordEventKind: RecordEventKind;
  sourceTable: string;
  sourceId: string;
  actorUserId?: number | null;
  copyParams?: Record<string, string>;
  detailLines?: HwyMemberDossierRecordEventPayload['detailLines'];
  field?: string | null;
  fromValue?: { value: unknown };
  toValue?: { value: unknown };
  redact?: boolean;
  reasonCode?: string | null;
  reasonText?: string | null;
  correlationId?: string;
  idempotencyKey: string;
};

export async function emitHwyMemberDossierRecordEvent(
  input: EmitHwyMemberDossierRecordEventInput,
): Promise<void> {
  const payload: HwyMemberDossierRecordEventPayload = {
    [HWY_MEMBER_DOSSIER_RECORD_PAYLOAD_KEY]: input.dossierKind,
    sourceTable: input.sourceTable,
    sourceId: input.sourceId,
    ...(input.copyParams && Object.keys(input.copyParams).length
      ? { copyParams: input.copyParams }
      : {}),
    ...(input.detailLines?.length ? { detailLines: input.detailLines } : {}),
  };

  await emitRecordEvent({
    subjectKind: 'hwy_members',
    subjectId: String(input.memberId),
    eventKind: input.recordEventKind,
    source: 'patch',
    field: input.field ?? null,
    fromValue: input.fromValue ?? null,
    toValue: input.toValue ?? null,
    redact: input.redact,
    reasonCode: input.reasonCode ?? null,
    reasonText: input.reasonText ?? null,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    sourceRef: `${input.sourceTable}:${input.sourceId}`,
    payload,
    actorUserId: input.actorUserId ?? null,
    actorKind: input.actorUserId ? 'user' : 'system',
    inProcess: false,
    historyEnabled: true,
  });
}

export const hwyDossierRecordIdempotencyKey = (
  segment: string,
  sourceId: string,
  suffix = '',
): string => {
  const base = `hwy-dossier:${segment}:${sourceId}${suffix ? `:${suffix}` : ''}`;
  return base.slice(0, 128);
};

export const truncateDossierNotePreview = (body: string, max = 120): string => {
  const s = body.trim();
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max - 1)}…`;
};
