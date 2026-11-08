import type { InstallEnvVarGuide } from './api/contracts/install/types';

export type NodeCapability = 'service' | 'platform' | 'worker';

export const NODE_CAPABILITY_ORDER: NodeCapability[] = ['service', 'platform', 'worker'];

export const DEFAULT_NODE_CAPABILITIES: NodeCapability[] = ['service', 'platform', 'worker'];

/** Capabilities that must exist on at most one node per deployment. */
export const SINGLETON_NODE_CAPABILITIES: NodeCapability[] = ['platform', 'worker'];

export const NODE_CAPABILITY_LABELS: Record<NodeCapability, string> = {
  service: 'Service',
  platform: 'Platform',
  worker: 'Worker',
};

export const NODE_CAPABILITY_DESCRIPTIONS: Record<NodeCapability, string> = {
  service:
    'Serves end-user applications and their APIs. Multiple service nodes are allowed — use an external proxy or load balancer to spread traffic; nodes do not know about each other.',
  platform:
    'Runs the full built-in AppEndO stack (Studio, Designer, settings, system APIs). Exactly one node per deployment.',
  worker:
    'Runs all background jobs on this node only (scheduler, queue, execution). Exactly one worker node per deployment — do not add a second.',
};

export const hasNodeCapability = (
  capabilities: readonly NodeCapability[],
  capability: NodeCapability,
): boolean => capabilities.includes(capability);

export const nodeRunsBackgroundJobs = (capabilities: readonly NodeCapability[]): boolean => (
  hasNodeCapability(capabilities, 'worker')
);

export const parseNodeCapabilities = (value: unknown): NodeCapability[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: NodeCapability[] = [];
  for (const item of value) {
    const normalized = String(item ?? '').trim().toLowerCase();
    if (normalized !== 'service' && normalized !== 'platform' && normalized !== 'worker') {
      return null;
    }
    if (!parsed.includes(normalized)) {
      parsed.push(normalized);
    }
  }

  return parsed.length > 0 ? parsed : null;
};

const legacyRoleToCapabilities = (role: string): NodeCapability[] | null => {
  if (role === 'worker') {
    return ['worker'];
  }
  if (role === 'standalone' || role === 'master' || role === 'dev') {
    return [...DEFAULT_NODE_CAPABILITIES];
  }
  return null;
};

export const normalizeNodeCapabilities = (input: {
  capabilities?: unknown;
  nodeRole?: unknown;
}): NodeCapability[] => {
  const parsed = parseNodeCapabilities(input.capabilities);
  if (parsed) {
    return NODE_CAPABILITY_ORDER.filter((capability) => parsed.includes(capability));
  }

  const legacy = legacyRoleToCapabilities(String(input.nodeRole ?? '').trim().toLowerCase());
  if (legacy) {
    return legacy;
  }

  return [...DEFAULT_NODE_CAPABILITIES];
};

export const validateNodeCapabilities = (
  capabilities: NodeCapability[],
): { valid: true } | { valid: false; message: string } => {
  if (capabilities.length === 0) {
    return { valid: false, message: 'Select at least one node capability.' };
  }

  return { valid: true };
};

export const resolveActiveNodeCapabilities = (input: {
  capabilities?: unknown;
  nodeRole?: unknown;
}): NodeCapability[] => {
  const fromEnv = process.env.APPENDO_NODE_CAPABILITIES;
  if (fromEnv) {
    const parsed = normalizeNodeCapabilities({ capabilities: fromEnv.split(',') });
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return normalizeNodeCapabilities(input);
};

export const resolveActiveNodeName = (runtimeNodeName: string): string => (
  String(process.env.APPENDO_NODE_NAME ?? runtimeNodeName).trim() || runtimeNodeName
);

export const buildCapabilityEnvGuide = (
  capabilities: NodeCapability[],
  nodeName: string,
): InstallEnvVarGuide[] => [
  {
    key: 'APPENDO_NODE_NAME',
    value: nodeName,
    note: 'Human-readable node identifier. Nodes do not coordinate with each other.',
  },
  {
    key: 'APPENDO_NODE_CAPABILITIES',
    value: capabilities.join(','),
    note: 'Comma-separated: service, platform, worker. Shared infrastructure is PostgreSQL and optional Redis only.',
  },
];
