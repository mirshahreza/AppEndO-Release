import type { AiCapabilityPack, AiCapabilityPackId } from '../../../../shared/api/contracts/ai/capabilityPacks';
import type { AiMcpServerPublicConfig, AiWebSearchProvider } from '../../../../shared/api/contracts/ai/types';

export const INBOUND_MCP_HOST_ROW_ID = '__inbound-mcp-host__';

export type McpGridRowKind = 'builtin-pack' | 'inbound-host' | 'external-server';

export type McpGridSourceLabel = 'Built-in' | 'External' | 'Package' | 'Inbound';

export type McpGridRow = {
  id: string;
  kind: McpGridRowKind;
  label: string;
  subtitle: string;
  sourceLabel: McpGridSourceLabel;
  packId?: AiCapabilityPackId;
  pack?: AiCapabilityPack;
  server?: AiMcpServerPublicConfig;
  enabled: boolean;
  toolSummary: string;
  hasWriteTools?: boolean;
  transport?: string;
};

export type McpGridBuildInput = {
  defaultPackIds: readonly AiCapabilityPackId[];
  webSearchProvider: AiWebSearchProvider;
  inboundHostEnabled: boolean;
  servers: readonly AiMcpServerPublicConfig[];
};
