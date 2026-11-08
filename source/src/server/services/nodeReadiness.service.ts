import type { Pool } from 'pg';
import { cacheManager } from '../../core/cache/CacheManager';
import { getCacheSettingsFromFile } from '../db/cacheSettingsStore';
import type { NodeCapability } from '../../shared/nodeCapabilities';
import { hasNodeCapability } from '../../shared/nodeCapabilities';
import {
  buildNodeReadinessResponse,
  type NodeReadinessResponse,
  type ReadinessCheckStatus,
} from '../../shared/nodeReadiness';

export type EvaluateNodeReadinessInput = {
  pool?: Pool;
  settingsPath: string;
  capabilities: readonly NodeCapability[];
  nodeName: string;
};

const checkDatabase = async (pool?: Pool): Promise<boolean> => {
  if (pool) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  try {
    const { isPrismaControlPlaneReady, getPrismaControlPlane } = await import('../db/prismaControlPlane');
    if (!isPrismaControlPlaneReady()) {
      return false;
    }
    await getPrismaControlPlane().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

const checkWorkerQueue = async (pool?: Pool): Promise<boolean> => {
  try {
    if (pool) {
      await pool.query('SELECT 1 FROM base_jobs LIMIT 1');
      return true;
    }
    const { isPrismaControlPlaneReady, getPrismaControlPlane } = await import('../db/prismaControlPlane');
    if (!isPrismaControlPlaneReady()) {
      return false;
    }
    await getPrismaControlPlane().baseJob.findFirst({ select: { id: true } });
    return true;
  } catch {
    return false;
  }
};

const checkRedis = async (settingsPath: string): Promise<ReadinessCheckStatus> => {
  const cacheSettings = getCacheSettingsFromFile(settingsPath);

  if (cacheSettings.driver !== 'redis') {
    return 'skipped';
  }

  const result = await cacheManager.testRedisConnection(cacheSettings.storeSettings.redis);
  return result.success ? 'ready' : 'not_ready';
};

export const evaluateNodeReadiness = async (
  input: EvaluateNodeReadinessInput,
): Promise<NodeReadinessResponse> => {
  const databaseReady = await checkDatabase(input.pool);
  const redisStatus = await checkRedis(input.settingsPath);
  const workerQueueReady = databaseReady && hasNodeCapability(input.capabilities, 'worker')
    ? await checkWorkerQueue(input.pool)
    : false;

  return buildNodeReadinessResponse({
    nodeName: input.nodeName,
    capabilities: input.capabilities,
    databaseReady,
    redisStatus,
    workerQueueReady,
  });
};
