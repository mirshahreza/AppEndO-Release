import {
  AI_CAPABILITY_PACK_CATALOG,
  ASK_AGENT_CAPABILITY_SCOPE,
  type AiCapabilityPackId,
} from '../../api/contracts/ai/capabilityPacks';
import type {
  CapabilityDenialReasonCode,
  CapabilityRegistryHealth,
  EffectiveCapabilityResolution,
  EffectiveCapabilityResolutionInput,
  PlatformCapabilityRecord,
  ResolvedCapability,
} from '../../api/contracts/appendoo/capabilityRegistry.types';
import { CAPABILITY_REGISTRY_VERSION } from '../../api/contracts/appendoo/capabilityRegistry.types';

const mapCategory = (packId: AiCapabilityPackId): PlatformCapabilityRecord['category'] => {
  if (packId === 'appendo-data' || packId === 'appendo-cache') return 'DATA_QUERY';
  if (packId === 'appendo-jobs' || packId === 'appendo-openapi') return 'API_OPERATION';
  if (packId === 'appendo-server-functions' || packId === 'appendo-designer') return 'ENGINEERING';
  if (packId === 'appendo-packages') return 'ADMIN';
  return 'CONTEXT_READ';
};

/** AE-5.1 — bootstrap capability registry from built-in pack catalog. */
export const bootstrapPlatformCapabilities = (): PlatformCapabilityRecord[] => (
  AI_CAPABILITY_PACK_CATALOG.map((pack) => ({
    capabilityId: `capability:${pack.id}`,
    canonicalName: pack.label,
    category: mapCategory(pack.id),
    packId: pack.id,
    toolNames: pack.toolNames,
    availability: 'AVAILABLE',
    maturity: 'bootstrap',
    providerComponent: 'PlatformRuntimeContributor',
    version: CAPABILITY_REGISTRY_VERSION,
    observedAt: new Date().toISOString(),
  }))
);

const ENGINEERING_PACKS = new Set<AiCapabilityPackId>([
  'appendo-files',
  'appendo-codebase',
  'appendo-designer',
  'appendo-server-functions',
  'appendo-packages',
  'appendo-git',
]);

const resolveAllowedPackIds = (input: EffectiveCapabilityResolutionInput): Set<AiCapabilityPackId> => {
  if (input.mode === 'ask') {
    return new Set(ASK_AGENT_CAPABILITY_SCOPE.packIds);
  }
  return new Set(input.enabledPackIds);
};

const buildResolvedCapability = (
  record: PlatformCapabilityRecord,
  input: EffectiveCapabilityResolutionInput,
  allowedPackIds: Set<AiCapabilityPackId>,
): ResolvedCapability => {
  const denialReasonCodes: CapabilityDenialReasonCode[] = [];

  if (record.availability === 'DISABLED') {
    denialReasonCodes.push('CAPABILITY_DISABLED');
  }
  if (!allowedPackIds.has(record.packId)) {
    denialReasonCodes.push(input.mode === 'ask' ? 'MODE_POLICY_DENY' : 'PACK_NOT_ENABLED');
  }
  if (input.requestClass === 'CONVERSATION' && ENGINEERING_PACKS.has(record.packId)) {
    denialReasonCodes.push('REQUEST_CLASS_DENY');
  }
  if (input.requestClass === 'ENGINEERING_CHANGE' && record.packId === 'appendo-web') {
    denialReasonCodes.push('REQUEST_CLASS_DENY');
  }
  if (input.principalRole === 'READONLY' && record.category === 'ADMIN') {
    denialReasonCodes.push('ROLE_DENIED');
  }

  const authorization = denialReasonCodes.length === 0 ? 'ALLOWED' : 'DENIED';

  return {
    capabilityId: record.capabilityId,
    packId: record.packId,
    authorization,
    availability: record.availability,
    denialReasonCodes,
    toolNames: record.toolNames,
  };
};

export const resolveEffectiveCapabilities = (
  input: EffectiveCapabilityResolutionInput,
): EffectiveCapabilityResolution => {
  const capabilities = bootstrapPlatformCapabilities();
  const allowedPackIds = resolveAllowedPackIds(input);
  const resolved = capabilities.map((record) => buildResolvedCapability(record, input, allowedPackIds));

  const allowed = resolved.filter((entry) => entry.authorization === 'ALLOWED');
  const denied = resolved.filter((entry) => entry.authorization === 'DENIED');
  const allowedToolNames = [...new Set(allowed.flatMap((entry) => [...entry.toolNames]))];

  return {
    registryVersion: CAPABILITY_REGISTRY_VERSION,
    snapshotVersion: `${CAPABILITY_REGISTRY_VERSION}:${input.mode}:${[...allowedPackIds].sort().join(',')}`,
    allowed,
    denied,
    allowedToolNames,
  };
};

export const canPerform = (
  capabilityId: string,
  input: EffectiveCapabilityResolutionInput,
): { allowed: boolean; denialReasonCodes: CapabilityDenialReasonCode[] } => {
  const resolution = resolveEffectiveCapabilities(input);
  const match = [...resolution.allowed, ...resolution.denied].find((entry) => entry.capabilityId === capabilityId);
  if (!match) {
    return { allowed: false, denialReasonCodes: ['UNKNOWN_CAPABILITY'] };
  }
  return {
    allowed: match.authorization === 'ALLOWED',
    denialReasonCodes: match.denialReasonCodes,
  };
};

export const explainCapabilityDenial = (
  capabilityId: string,
  input: EffectiveCapabilityResolutionInput,
): { capabilityId: string; denialReasonCodes: CapabilityDenialReasonCode[] } => {
  const result = canPerform(capabilityId, input);
  return {
    capabilityId,
    denialReasonCodes: result.denialReasonCodes,
  };
};

export const getCapabilityRegistryHealth = (): CapabilityRegistryHealth => {
  const capabilities = bootstrapPlatformCapabilities();
  return {
    registryVersion: CAPABILITY_REGISTRY_VERSION,
    capabilityCount: capabilities.length,
    availableCount: capabilities.filter((capability) => capability.availability === 'AVAILABLE').length,
    bootstrapContributor: 'PlatformRuntimeContributor',
  };
};
