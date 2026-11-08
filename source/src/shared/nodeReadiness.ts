import type { NodeCapability } from './nodeCapabilities';
import { hasNodeCapability, NODE_CAPABILITY_ORDER } from './nodeCapabilities';

export type ReadinessCheckStatus = 'ready' | 'not_ready' | 'skipped';

export type NodeReadinessChecks = {
  database: 'ready' | 'not_ready';
  redis: ReadinessCheckStatus;
  workerQueue: ReadinessCheckStatus;
};

export type NodeReadinessResponse = {
  status: 'ready' | 'not_ready';
  nodeName: string;
  capabilities: NodeCapability[];
  checks: NodeReadinessChecks;
  capabilityReadiness: Record<NodeCapability, 'ready' | 'not_ready'>;
};

export type NodeReadinessInputs = {
  nodeName: string;
  capabilities: readonly NodeCapability[];
  databaseReady: boolean;
  redisStatus: ReadinessCheckStatus;
  workerQueueReady: boolean;
};

const capabilityIsReady = (
  capability: NodeCapability,
  inputs: Pick<NodeReadinessInputs, 'databaseReady' | 'workerQueueReady'>,
): boolean => {
  if (!inputs.databaseReady) {
    return false;
  }

  if (capability === 'worker') {
    return inputs.workerQueueReady;
  }

  return true;
};

export const buildNodeReadinessResponse = (inputs: NodeReadinessInputs): NodeReadinessResponse => {
  const capabilityReadiness = Object.fromEntries(
    NODE_CAPABILITY_ORDER
      .filter((capability) => hasNodeCapability(inputs.capabilities, capability))
      .map((capability) => [
        capability,
        capabilityIsReady(capability, inputs) ? 'ready' : 'not_ready',
      ]),
  ) as Record<NodeCapability, 'ready' | 'not_ready'>;

  const activeCapabilitiesReady = NODE_CAPABILITY_ORDER
    .filter((capability) => hasNodeCapability(inputs.capabilities, capability))
    .every((capability) => capabilityReadiness[capability] === 'ready');

  return {
    status: activeCapabilitiesReady ? 'ready' : 'not_ready',
    nodeName: inputs.nodeName,
    capabilities: [...inputs.capabilities],
    checks: {
      database: inputs.databaseReady ? 'ready' : 'not_ready',
      redis: inputs.redisStatus,
      workerQueue: hasNodeCapability(inputs.capabilities, 'worker')
        ? (inputs.workerQueueReady ? 'ready' : 'not_ready')
        : 'skipped',
    },
    capabilityReadiness,
  };
};
