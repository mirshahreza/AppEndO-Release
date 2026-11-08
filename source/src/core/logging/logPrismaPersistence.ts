import type { Prisma } from '../../generated/prisma/client';
import { getPrismaControlPlane } from '../../server/db/prismaControlPlane';
import type { AuthAuditQueueEntry } from './authAuditRecordDbMapper';
import type { LogRecord } from './Logger';
import { mapLogRecordToRowValues } from './logRecordDbMapper';

const mapLogRecordToCreateManyInput = (entry: LogRecord): Prisma.BaseAppLogCreateManyInput => {
  const [
    actor,
    callSuccess,
    failureReason,
    durationMs,
    level,
    context,
    message,
    messageSize,
    hasMeta,
    metaJson,
    metaSize,
    createdAt,
  ] = mapLogRecordToRowValues(entry);

  return {
    actor,
    callSuccess,
    failureReason,
    durationMs,
    level,
    context,
    message,
    messageSize,
    hasMeta,
    metaJson,
    metaSize,
    createdAt: new Date(createdAt),
  };
};

export const insertAppLogBatchPrisma = async (batch: LogRecord[]): Promise<void> => {
  if (batch.length === 0) return;
  await getPrismaControlPlane().baseAppLog.createMany({
    data: batch.map(mapLogRecordToCreateManyInput),
  });
};

export const insertAuthAuditBatchPrisma = async (batch: AuthAuditQueueEntry[]): Promise<void> => {
  if (batch.length === 0) return;
  await getPrismaControlPlane().baseAuthAuditLog.createMany({
    data: batch.map((entry) => ({
      userId: entry.userId != null ? BigInt(entry.userId) : null,
      email: entry.email,
      eventType: entry.eventType,
      success: entry.success ? 1 : 0,
      reason: entry.reason,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadataJson: entry.metadataJson,
    })),
  });
};
