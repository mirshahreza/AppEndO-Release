import type { AiCapabilityPackId } from '../ai/capabilityPacks';

export const CAPABILITY_REGISTRY_VERSION = '1.0.0';

export type CapabilityAvailability = 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'DISABLED';
export type CapabilityAuthorization = 'ALLOWED' | 'DENIED';

export type CapabilityDenialReasonCode =
  | 'PACK_NOT_ENABLED'
  | 'MODE_POLICY_DENY'
  | 'REQUEST_CLASS_DENY'
  | 'ROLE_DENIED'
  | 'RESOURCE_POLICY_DENY'
  | 'CAPABILITY_DISABLED'
  | 'UNKNOWN_CAPABILITY';

export type PlatformCapabilityRecord = {
  capabilityId: string;
  canonicalName: string;
  category: 'CONTEXT_READ' | 'DATA_QUERY' | 'API_OPERATION' | 'ENGINEERING' | 'ADMIN';
  packId: AiCapabilityPackId;
  toolNames: readonly string[];
  availability: CapabilityAvailability;
  maturity: 'bootstrap' | 'verified';
  providerComponent: string;
  version: string;
  observedAt: string;
};

export type EffectiveCapabilityResolutionInput = {
  requestClass: 'CONVERSATION' | 'CONTEXT_QUERY' | 'TOOL_QUERY' | 'OPERATIONAL_ACTION' | 'ENGINEERING_QUERY' | 'ENGINEERING_CHANGE';
  mode: 'ask' | 'agent' | 'plan';
  enabledPackIds: readonly AiCapabilityPackId[];
  principalRole?: string;
};

export type ResolvedCapability = {
  capabilityId: string;
  packId: AiCapabilityPackId;
  authorization: CapabilityAuthorization;
  availability: CapabilityAvailability;
  denialReasonCodes: CapabilityDenialReasonCode[];
  toolNames: readonly string[];
};

export type EffectiveCapabilityResolution = {
  registryVersion: string;
  snapshotVersion: string;
  allowed: ResolvedCapability[];
  denied: ResolvedCapability[];
  allowedToolNames: string[];
};

export type CapabilityRegistryHealth = {
  registryVersion: string;
  capabilityCount: number;
  availableCount: number;
  bootstrapContributor: 'PlatformRuntimeContributor';
};
