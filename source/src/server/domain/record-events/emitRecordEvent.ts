import crypto from 'node:crypto';
import type { Transaction } from 'sequelize';
import type { Request } from 'express';
import type {
  RecordEventActorKind,
  RecordEventKind,
  RecordEventOutcome,
  RecordEventSource,
  RecordEventValue,
} from '../../../shared/api/contracts/record-events';
import type { ClientContextFieldSelection } from '../../../shared/api/contracts/client-context';
import { collectClientContext } from '../client-context/collectClientContext';
import { getRecordEventRequestScope } from '../client-context/requestAls';
import {
  getRecordEventModel,
  type RecordEventModel,
  type RecordEventRow,
} from './recordEventSequelizeModels';
import { hashRecordEventRow, RECORD_EVENT_GENESIS_HASH } from './recordEventHash';
import { encryptRecordEventValue } from './recordEventRedact';

export type EmitRecordEventInput = {
  subjectKind: string;
  subjectId: string;
  eventKind: RecordEventKind;
  source: RecordEventSource;
  field?: string | null;
  fromValue?: RecordEventValue | null;
  toValue?: RecordEventValue | null;
  redact?: boolean;
  reasonCode?: string | null;
  reasonText?: string | null;
  correlationId?: string;
  idempotencyKey?: string | null;
  sourceRef?: string | null;
  payload?: Record<string, unknown> | null;
  outcome?: RecordEventOutcome;
  actorKind?: RecordEventActorKind;
  actorUserId?: number | null;
  actingAsUserId?: number | null;
  clientContextFields?: ClientContextFieldSelection[];
  req?: Pick<Request, 'headers' | 'body' | 'ip' | 'httpVersion'> & {
    requestId?: string;
    auth?: { userId?: number | string };
    impersonatorId?: number;
  };
  inProcess?: boolean;
  transaction?: Transaction;
  historyEnabled?: boolean;
};

const asNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const stringifyValue = (value: RecordEventValue | null | undefined, redact: boolean): string | null => {
  if (value == null) return null;
  const json = JSON.stringify(value);
  return redact ? encryptRecordEventValue(json) : json;
};

const resolveActors = (input: EmitRecordEventInput): {
  actorKind: RecordEventActorKind;
  actorUserId: number | null;
  actingAsUserId: number | null;
} => {
  if (input.actorKind) {
    return {
      actorKind: input.actorKind,
      actorUserId: input.actorUserId ?? null,
      actingAsUserId: input.actingAsUserId ?? null,
    };
  }
  const req = input.req ?? getRecordEventRequestScope()?.req;
  const sessionUserId = asNumber(req?.auth?.userId);
  const impersonatorId = asNumber(req?.impersonatorId);
  if (impersonatorId && sessionUserId && impersonatorId !== sessionUserId) {
    return {
      actorKind: 'impersonation',
      actorUserId: impersonatorId,
      actingAsUserId: sessionUserId,
    };
  }
  const scope = getRecordEventRequestScope();
  if (scope?.agentRunId) {
    return { actorKind: 'agent', actorUserId: sessionUserId, actingAsUserId: null };
  }
  if (input.source === 'workflow' || scope?.source === 'workflow') {
    return { actorKind: 'workflow', actorUserId: sessionUserId, actingAsUserId: null };
  }
  if (sessionUserId) {
    return { actorKind: 'user', actorUserId: sessionUserId, actingAsUserId: null };
  }
  return { actorKind: 'system', actorUserId: null, actingAsUserId: null };
};

const defaultIdempotencyKey = (input: {
  requestId: string | null;
  correlationId: string;
  eventKind: string;
  field: string | null;
}): string => (
  [input.requestId ?? 'noreq', input.correlationId, input.eventKind, input.field ?? '-'].join(':').slice(0, 128)
);

export const emitRecordEvent = async (input: EmitRecordEventInput): Promise<RecordEventRow | null> => {
  if (input.historyEnabled === false && input.outcome !== 'denied') {
    return null;
  }

  const occurredAt = new Date();
  const inProcess = Boolean(input.inProcess || input.source === 'workflow');
  const isWrite = input.outcome !== 'denied';
  const collected = collectClientContext({
    req: input.req,
    occurredAt,
    fields: input.clientContextFields,
    isWrite,
    inProcess,
  });
  const actors = resolveActors(input);
  const correlationId = input.correlationId?.trim() || crypto.randomUUID();
  const scope = getRecordEventRequestScope();
  const sourceRef = input.sourceRef
    ?? (scope?.workflowInstanceId ? `wf:${scope.workflowInstanceId}` : null)
    ?? (scope?.workflowWorkItemId ? `wi:${scope.workflowWorkItemId}` : null)
    ?? (scope?.agentRunId ? `agent:${scope.agentRunId}` : null);
  const requestId = collected.requestId;
  const idempotencyKey = (input.idempotencyKey?.trim()
    || defaultIdempotencyKey({
      requestId,
      correlationId,
      eventKind: input.eventKind,
      field: input.field ?? null,
    })).slice(0, 128);

  const Model = getRecordEventModel();
  const run = async (transaction?: Transaction) => {
    const existing = await Model.findOne({
      where: { idempotencyKey },
      transaction,
    });
    if (existing) {
      return existing.get({ plain: true }) as RecordEventRow;
    }

    const last = await Model.findOne({
      where: { subjectKind: input.subjectKind, subjectId: String(input.subjectId) },
      order: [['subjectSeq', 'DESC']],
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
      transaction,
    });
    const subjectSeq = last ? Number(last.subjectSeq) + 1 : 1;
    const prevHash = last?.rowHash ?? RECORD_EVENT_GENESIS_HASH;
    const fromValue = stringifyValue(input.fromValue ?? null, Boolean(input.redact));
    const toValue = stringifyValue(input.toValue ?? null, Boolean(input.redact));
    const hashInput = {
      subjectKind: input.subjectKind,
      subjectId: String(input.subjectId),
      subjectSeq,
      occurredAt,
      actorUserId: actors.actorUserId,
      actingAsUserId: actors.actingAsUserId,
      actorKind: actors.actorKind,
      outcome: input.outcome ?? 'success',
      eventKind: input.eventKind,
      field: input.field ?? null,
      fromValue,
      toValue,
      correlationId,
      prevHash,
    };
    try {
      const created = await Model.create({
        subjectKind: input.subjectKind,
        subjectId: String(input.subjectId),
        occurredAt,
        actorUserId: actors.actorUserId,
        actingAsUserId: actors.actingAsUserId,
        actorKind: actors.actorKind,
        outcome: input.outcome ?? 'success',
        source: input.source,
        sourceRef,
        requestId,
        eventKind: input.eventKind,
        field: input.field ?? null,
        fromValue,
        toValue,
        reasonCode: input.reasonCode ?? null,
        reasonText: input.reasonText ?? null,
        correlationId,
        subjectSeq,
        prevHash,
        rowHash: hashRecordEventRow(hashInput),
        idempotencyKey,
        clientChannel: collected.clientChannel,
        clientIp: collected.clientIp,
        clientTimeZone: collected.clientTimeZone,
        clientInstallId: collected.clientInstallId,
        clientJson: JSON.stringify({
          observed: collected.observed,
          claimed: collected.claimed,
        }),
        payload: input.payload ? JSON.stringify(input.payload) : null,
      } as Partial<RecordEventRow>, { transaction });
      return created.get({ plain: true }) as RecordEventRow;
    } catch (error) {
      const raced = await Model.findOne({
        where: { idempotencyKey },
        transaction,
      });
      if (raced) {
        return raced.get({ plain: true }) as RecordEventRow;
      }
      throw error;
    }
  };

  if (input.transaction) {
    return run(input.transaction);
  }
  return Model.sequelize!.transaction((transaction) => run(transaction));
};

export const emitRecordEventBestEffort = async (
  input: EmitRecordEventInput,
  loggerError?: (message: string, error: unknown) => void,
): Promise<void> => {
  try {
    await emitRecordEvent(input);
  } catch (error) {
    loggerError?.('Failed to emit record event.', error);
  }
};

export type { RecordEventModel };
