import type { Pool } from 'pg';
import { isPrismaControlPlaneReady } from '../../server/db/prismaControlPlane';
import { createAuthAuditDbBatcher, createPgPoolAuthAuditDbBatcher, type AuthAuditDbBatcher } from './AuthAuditDbBatcher';
import { createLogDbBatcher, createPgPoolLogDbBatcher, type LogDbBatcher } from './LogDbBatcher';
import type { LogDbPersistenceSettings } from './logPersistenceConfig';
import { insertAppLogBatchPrisma, insertAuthAuditBatchPrisma } from './logPrismaPersistence';

let logDbBatcher: LogDbBatcher | null = null;
let authAuditDbBatcher: AuthAuditDbBatcher | null = null;

export type LogPersistenceBackend =
  | { kind: 'pg'; pool: Pool }
  | { kind: 'prisma' };

export const initLogPersistence = (
  backend: LogPersistenceBackend,
  settings?: LogDbPersistenceSettings,
): void => {
  if (backend.kind === 'pg') {
    logDbBatcher = createPgPoolLogDbBatcher(backend.pool, settings);
    authAuditDbBatcher = createPgPoolAuthAuditDbBatcher(backend.pool, settings);
    return;
  }

  logDbBatcher = createLogDbBatcher({
    persistence: settings,
    insertBatch: insertAppLogBatchPrisma,
  });
  authAuditDbBatcher = createAuthAuditDbBatcher({
    batch: settings,
    insertBatch: insertAuthAuditBatchPrisma,
  });
};

export const tryInitLogPersistence = (
  pool: Pool | undefined,
  settings?: LogDbPersistenceSettings,
): boolean => {
  if (pool) {
    initLogPersistence({ kind: 'pg', pool }, settings);
    return true;
  }
  if (isPrismaControlPlaneReady()) {
    initLogPersistence({ kind: 'prisma' }, settings);
    return true;
  }
  return false;
};

export const getLogDbBatcher = (): LogDbBatcher | null => logDbBatcher;

export const getAuthAuditDbBatcher = (): AuthAuditDbBatcher | null => authAuditDbBatcher;

export const flushLogPersistence = async (): Promise<void> => {
  await Promise.all([
    logDbBatcher?.flush(),
    authAuditDbBatcher?.flush(),
  ]);
};

export const shutdownLogPersistence = async (): Promise<void> => {
  await Promise.all([
    logDbBatcher?.shutdown(),
    authAuditDbBatcher?.shutdown(),
  ]);
  logDbBatcher = null;
  authAuditDbBatcher = null;
};
