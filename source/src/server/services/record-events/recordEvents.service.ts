import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import {
  recordEventEraseInputSchema,
  recordEventHoldInputSchema,
  recordEventListQuerySchema,
} from '../../../shared/api/contracts/record-events';
import { listRecordEvents, listUserDevices, getRecordEventById, hasHttpLogForRequestId } from '../../domain/record-events/queryRecordEvents';
import { signRecordEventExport, verifyRecordEventExport } from '../../domain/record-events/recordEventExport';
import { clearHotUserMessageDispatches } from '../notifications/userMessageDispatch.service';
import {
  clearHotRecordEvents,
  deleteRecordEventHold,
  eraseRecordEvents,
  hasRecordEventHold,
  upsertRecordEventHold,
} from '../../domain/record-events/recordEventJobs';
import { emitRecordEvent } from '../../domain/record-events/emitRecordEvent';

const isAdmin = (actor: ActorContext | null | undefined): boolean => (
  Boolean(actor?.isAdmin || actor?.role === 'ADMIN')
);

export const assertRecordEventAuditeeAccess = (actor: ActorContext | null | undefined): void => {
  if (!isAdmin(actor)) {
    throw new HttpError(403, 'Record event auditee access requires ADMIN.');
  }
};

export const assertCanReadSubjectEvents = (
  actor: ActorContext | null | undefined,
  subjectKind?: string,
  subjectId?: string,
): void => {
  if (isAdmin(actor)) return;
  if (subjectKind === 'base_users' && subjectId && Number(subjectId) === Number(actor?.userId)) {
    return;
  }
  if (!subjectKind || !subjectId) {
    throw new HttpError(403, 'Record event auditee access requires ADMIN.');
  }
  throw new HttpError(404, 'Record not found.');
};

export async function listEvents(actor: ActorContext | null | undefined, rawQuery: Record<string, unknown>) {
  const query = recordEventListQuerySchema.parse(rawQuery);
  if (!query.subjectKind || !query.subjectId) {
    assertRecordEventAuditeeAccess(actor);
  } else {
    assertCanReadSubjectEvents(actor, query.subjectKind, query.subjectId);
  }
  const includeAuth = query.includeAuth === '1' || query.includeAuth === 'true';
  return listRecordEvents(query, { unmask: false, includeAuth });
}

export async function getEvent(actor: ActorContext | null | undefined, id: string) {
  const item = await getRecordEventById(id, false);
  if (!item) {
    throw new HttpError(404, 'Record event was not found.');
  }
  assertCanReadSubjectEvents(actor, item.subjectKind, item.subjectId);
  return item;
}

export async function exportEvents(actor: ActorContext | null | undefined, rawQuery: Record<string, unknown>) {
  const { items } = await listEvents(actor, rawQuery);
  return signRecordEventExport(items);
}

export function verifyExport(payload: string, signature: string) {
  return { valid: verifyRecordEventExport(payload, signature) };
}

export async function getDevices(actor: ActorContext | null | undefined, userId: number) {
  assertCanReadSubjectEvents(actor, 'base_users', String(userId));
  return listUserDevices(userId);
}

export async function putHold(actor: ActorContext, body: unknown) {
  assertRecordEventAuditeeAccess(actor);
  const input = recordEventHoldInputSchema.parse(body);
  await upsertRecordEventHold({
    ...input,
    heldBy: actor.userId,
  });
  return { success: true as const };
}

export async function removeHold(actor: ActorContext, subjectKind: string, subjectId: string) {
  assertRecordEventAuditeeAccess(actor);
  const removed = await deleteRecordEventHold(subjectKind, subjectId);
  if (!removed) {
    throw new HttpError(404, 'Hold was not found.');
  }
  return { success: true as const };
}

export async function eraseHistory(actor: ActorContext, body: unknown) {
  assertRecordEventAuditeeAccess(actor);
  const input = recordEventEraseInputSchema.parse(body);
  await eraseRecordEvents({
    ...input,
    actorUserId: actor.userId,
  });
  return { success: true as const };
}

export async function clearHotEvents(actor: ActorContext) {
  assertRecordEventAuditeeAccess(actor);
  const events = await clearHotRecordEvents();
  const dispatches = await clearHotUserMessageDispatches();
  return {
    deleted: events.deleted + dispatches.deleted,
    skipped: events.skipped,
  };
}

export async function logExpiredForRequest(requestId: string) {
  const exists = await hasHttpLogForRequestId(requestId);
  return { exists, message: exists ? null : 'Log expired' };
}

export { emitRecordEvent, hasRecordEventHold };
