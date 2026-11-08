import { cacheManager } from '../../../core/cache/CacheManager';
import { isPrismaControlPlaneReady } from '../../db/prismaControlPlane';
import { getCacheSettingsFromFile } from '../../db/cacheSettingsStore';
import { getSchedulerSettingsFromFile } from '../../db/schedulerSettingsStore';
import type { InstallHealthCheck } from '../../../shared/api/contracts/install/types';
import {
  DEFAULT_NODE_CAPABILITIES,
  nodeRunsBackgroundJobs,
  type NodeCapability,
} from '../../../shared/nodeCapabilities';
import { findFirstAdminUser } from '../../domain/users/userRoleRepository';

export type InstallHealthDeps = {
  settingsPath: string;
  capabilities?: NodeCapability[];
  skipDatabase?: boolean;
};

export async function runInstallHealthChecks(deps: InstallHealthDeps): Promise<InstallHealthCheck[]> {
  const checks: InstallHealthCheck[] = [];

  if (deps.skipDatabase) {
    checks.push({
      id: 'db',
      label: 'Database',
      status: 'fail',
      message: 'Database has not been initialized yet.',
    });
  } else {
    checks.push(await checkDatabaseHealth());
  }
  checks.push(await checkRedisHealth(deps));
  checks.push(checkSchedulerHealth(deps));
  checks.push({
    id: 'api',
    label: 'API',
    status: 'pass',
    message: 'Install API is responding.',
  });

  return checks;
}

async function checkDatabaseHealth(): Promise<InstallHealthCheck> {
  try {
    if (!isPrismaControlPlaneReady()) {
      throw new Error('Control plane database is not connected.');
    }

    const admin = await findFirstAdminUser();
    if (!admin?.id) {
      return {
        id: 'db',
        label: 'Database',
        status: 'fail',
        message: 'Connected, but no admin user was found. Complete the admin step.',
      };
    }
    return {
      id: 'db',
      label: 'Database',
      status: 'pass',
      message: 'Control plane connection and schema are ready.',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database connection failed.';
    return {
      id: 'db',
      label: 'Database',
      status: 'fail',
      message,
    };
  }
}

async function checkRedisHealth(deps: InstallHealthDeps): Promise<InstallHealthCheck> {
  const cacheSettings = getCacheSettingsFromFile(deps.settingsPath);

  if (cacheSettings.driver !== 'redis') {
    return {
      id: 'redis',
      label: 'Redis',
      status: 'skip',
      message: 'Optional — enable cache.driver=redis in settings if needed.',
    };
  }

  const result = await cacheManager.testRedisConnection(cacheSettings.storeSettings.redis);
  return {
    id: 'redis',
    label: 'Redis',
    status: result.success ? 'pass' : 'fail',
    message: result.message,
  };
}

function checkSchedulerHealth(deps: InstallHealthDeps): InstallHealthCheck {
  const scheduler = getSchedulerSettingsFromFile(deps.settingsPath);
  const capabilities = deps.capabilities ?? DEFAULT_NODE_CAPABILITIES;

  if (!nodeRunsBackgroundJobs(capabilities)) {
    return {
      id: 'scheduler',
      label: 'Scheduler',
      status: 'skip',
      message: 'Worker capability is off — scheduler and jobs run on the worker node only.',
    };
  }

  if (!scheduler.enabled) {
    return {
      id: 'scheduler',
      label: 'Scheduler',
      status: 'pass',
      message: 'Scheduler is disabled in settings.',
    };
  }

  return {
    id: 'scheduler',
    label: 'Scheduler',
    status: 'pass',
    message: 'Worker capability enabled — this node runs scheduler and background jobs.',
  };
}
