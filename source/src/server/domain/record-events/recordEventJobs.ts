import { Op } from 'sequelize';
import { logger } from '../../../core/logging/Logger';
import { listEdgeModels } from '../../services/data-api/edgeModelStore';
import { getEdgeModelStudioMeta } from '../../services/data-api/edgeModelStudioMetaStore';
import { hashRecordEventRow } from './recordEventHash';
import {
  getRecordEventHoldModel,
  getRecordEventModel,
  type RecordEventRow,
} from './recordEventSequelizeModels';
import { emitRecordEvent } from './emitRecordEvent';

export const RECORD_EVENT_PURGE_JOB_TYPE = 'record_event_purge';
export const RECORD_EVENT_INTEGRITY_JOB_TYPE = 'record_event_integrity';

const subjectKey = (kind: string, id: string): string => `${kind}::${id}`;

export const hasRecordEventHold = async (subjectKind: string, subjectId: string): Promise<boolean> => {
  const hold = await getRecordEventHoldModel().findOne({
    where: { subjectKind, subjectId },
  });
  return Boolean(hold);
};

export const upsertRecordEventHold = async (input: {
  subjectKind: string;
  subjectId: string;
  heldBy?: number | null;
  reasonText?: string | null;
}) => {
  const Model = getRecordEventHoldModel();
  await Model.upsert({
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    heldAt: new Date(),
    heldBy: input.heldBy ?? null,
    reasonText: input.reasonText ?? null,
  });
};

export const deleteRecordEventHold = async (subjectKind: string, subjectId: string): Promise<boolean> => {
  const deleted = await getRecordEventHoldModel().destroy({
    where: { subjectKind, subjectId },
  });
  return deleted > 0;
};

const modelHasLegalHold = (objectName: string): boolean => {
  const models = listEdgeModels().filter((model) => model.objectName === objectName);
  return models.some((model) => Boolean(getEdgeModelStudioMeta(model.id).history?.legalHold));
};

const listLegalHoldSubjectKinds = (): string[] => {
  try {
    return [...new Set(
      listEdgeModels()
        .filter((model) => Boolean(getEdgeModelStudioMeta(model.id).history?.legalHold))
        .map((model) => model.objectName),
    )];
  } catch {
    return [];
  }
};

/** Wipe hot `base_record_events`. Skips held subjects and legalHold models. Does not touch auth audit. */
export const clearHotRecordEvents = async (): Promise<{ deleted: number; skipped: number }> => {
  const Model = getRecordEventModel();
  const Hold = getRecordEventHoldModel();
  const holds = await Hold.findAll();
  const holdPairs = holds.map((row) => ({
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
  }));
  const legalHoldKinds = listLegalHoldSubjectKinds();
  const keepClauses: Array<Record<string, unknown>> = [];
  if (holdPairs.length > 0) {
    keepClauses.push({ [Op.or]: holdPairs });
  }
  if (legalHoldKinds.length > 0) {
    keepClauses.push({ subjectKind: { [Op.in]: legalHoldKinds } });
  }
  const keepWhere = keepClauses.length === 0
    ? null
    : keepClauses.length === 1
      ? keepClauses[0]
      : { [Op.or]: keepClauses };
  const skipped = keepWhere ? await Model.count({ where: keepWhere }) : 0;
  const deleted = await Model.destroy({
    where: keepWhere ? { [Op.not]: keepWhere } : {},
  });
  return { deleted, skipped };
};

export const runRecordEventPurge = async (): Promise<{ deleted: number }> => {
  const { executeRetention } = await import('../retention/retentionExecutor');
  const result = await executeRetention({
    scope: 'recordEvents',
    dryRun: false,
    jobId: 0,
  });
  return { deleted: result.families.recordEvents?.deleted ?? 0 };
};

export const runRecordEventIntegrity = async (): Promise<{ subjects: number; broken: number }> => {
  const Model = getRecordEventModel();
  const rows = await Model.findAll({
    order: [['subjectKind', 'ASC'], ['subjectId', 'ASC'], ['subjectSeq', 'ASC']],
  });
  let broken = 0;
  const subjects = new Set<string>();
  let prevHash = '';
  let prevKey = '';
  let expectedSeq = 1;
  for (const instance of rows) {
    const row = instance.get({ plain: true }) as RecordEventRow;
    const key = subjectKey(row.subjectKind, row.subjectId);
    subjects.add(key);
    if (key !== prevKey) {
      prevHash = '0'.repeat(64);
      expectedSeq = 1;
      prevKey = key;
    }
    if (Number(row.subjectSeq) !== expectedSeq || row.prevHash !== prevHash) {
      broken += 1;
      logger.error('RecordEventIntegrity', 'Subject sequence or prev_hash mismatch.', {
        subjectKind: row.subjectKind,
        subjectId: row.subjectId,
        subjectSeq: row.subjectSeq,
      });
    } else {
      const computed = hashRecordEventRow({
        subjectKind: row.subjectKind,
        subjectId: row.subjectId,
        subjectSeq: Number(row.subjectSeq),
        occurredAt: row.occurredAt,
        actorUserId: row.actorUserId == null ? null : Number(row.actorUserId),
        actingAsUserId: row.actingAsUserId == null ? null : Number(row.actingAsUserId),
        actorKind: row.actorKind,
        outcome: row.outcome,
        eventKind: row.eventKind,
        field: row.field,
        fromValue: row.fromValue,
        toValue: row.toValue,
        correlationId: row.correlationId,
        prevHash: row.prevHash,
      });
      if (computed !== row.rowHash) {
        broken += 1;
        logger.error('RecordEventIntegrity', 'row_hash mismatch.', {
          subjectKind: row.subjectKind,
          subjectId: row.subjectId,
          subjectSeq: row.subjectSeq,
        });
      }
    }
    prevHash = row.rowHash;
    expectedSeq = Number(row.subjectSeq) + 1;
  }
  return { subjects: subjects.size, broken };
};

export const eraseRecordEvents = async (input: {
  subjectKind: string;
  subjectId: string;
  mode: 'anonymize' | 'delete';
  actorUserId?: number | null;
}): Promise<void> => {
  if (await hasRecordEventHold(input.subjectKind, input.subjectId)) {
    const { HttpError } = await import('../../errors/HttpError');
    throw new HttpError(409, 'Subject is under legal hold.');
  }
  if (modelHasLegalHold(input.subjectKind)) {
    const { HttpError } = await import('../../errors/HttpError');
    throw new HttpError(409, 'Model is under legal hold.');
  }
  const Model = getRecordEventModel();
  if (input.mode === 'anonymize') {
    const rows = await Model.findAll({
      where: { subjectKind: input.subjectKind, subjectId: input.subjectId },
    });
    for (const row of rows) {
      row.fromValue = null;
      row.toValue = null;
      row.reasonText = null;
      row.clientJson = null;
      row.actorUserId = null;
      await row.save();
    }
  } else {
    await Model.destroy({
      where: { subjectKind: input.subjectKind, subjectId: input.subjectId },
    });
  }
  await emitRecordEvent({
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    eventKind: 'history.erased',
    source: 'patch',
    outcome: 'success',
    actorUserId: input.actorUserId ?? null,
    actorKind: 'user',
    historyEnabled: true,
    payload: { mode: input.mode },
  });
};
