import type { DestinationStream } from 'pino';
import type { AuthAuditDbBatcher } from './AuthAuditDbBatcher';
import type { LogDbBatcher } from './LogDbBatcher';
import { mapPinoObjectToAuthAuditEntry, mapPinoObjectToLogRecord } from './pinoRecordMapper';
import { createNdjsonLineWritable } from './pinoNdjsonStream';

export const createPinoLogDbStream = (batcher: LogDbBatcher): DestinationStream =>
  createNdjsonLineWritable((obj) => {
    batcher.enqueue(mapPinoObjectToLogRecord(obj));
  });

export const createPinoAuthAuditDbStream = (batcher: AuthAuditDbBatcher): DestinationStream =>
  createNdjsonLineWritable((obj) => {
    batcher.enqueue(mapPinoObjectToAuthAuditEntry(obj));
  });
