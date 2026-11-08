import type { AiMcpServerPublicConfig } from './types';
import type {
  AiAgentCapabilityScope,
  AiCapabilityPack,
  AiCapabilityPackId,
} from './capabilityPacks';

export type McpGrantResourceKind = 'builtin_pack' | 'external_mcp' | 'plugin_mcp';

export type RoleMcpGrant = {
  roleName: string;
  resourceKind: McpGrantResourceKind;
  resourceId: string;
};

export type EffectiveMcpAccess = {
  adminBypass: boolean;
  packIds: AiCapabilityPackId[];
  mcpServerIds: string[];
};

export type McpAccessMePack = Pick<
  AiCapabilityPack,
  'id' | 'label' | 'description' | 'icon' | 'hasWriteTools'
>;

export type McpAccessMeResponse = {
  success: true;
  adminBypass: boolean;
  packs: McpAccessMePack[];
  mcpServers: AiMcpServerPublicConfig[];
  defaultScope: AiAgentCapabilityScope;
};

/** Snapshot injected into agent system context so the model knows allowed MCP scope. */
export type McpAccessContextSnapshot = {
  packLabels: string[];
  mcpServerLabels: string[];
};

export const MCP_GRANT_RESOURCE_KINDS: readonly McpGrantResourceKind[] = [
  'builtin_pack',
  'external_mcp',
  'plugin_mcp',
] as const;

export const isMcpGrantResourceKind = (value: string): value is McpGrantResourceKind =>
  (MCP_GRANT_RESOURCE_KINDS as readonly string[]).includes(value);

export type McpAccessCatalogPack = McpAccessMePack;

export type McpAccessCatalogMcpServer = AiMcpServerPublicConfig & {
  resourceKind: 'external_mcp' | 'plugin_mcp';
};

export type McpAccessCatalogResponse = {
  success: true;
  packs: McpAccessCatalogPack[];
  mcpServers: McpAccessCatalogMcpServer[];
};

export type RoleMcpGrantInput = {
  resourceKind: McpGrantResourceKind;
  resourceId: string;
};

export type RoleMcpGrantsResponse = {
  success: true;
  roleName: string;
  adminBypass: boolean;
  grants: RoleMcpGrantInput[];
};

export type ReplaceRoleMcpGrantsPayload = {
  grants: RoleMcpGrantInput[];
};

export type ReplaceRoleMcpGrantsResponse = {
  success: true;
  roleName: string;
  grantCount: number;
};

export type ReplaceMcpResourceAccessControlPayload = {
  resourceKind: McpGrantResourceKind;
  accessControl: import('../server-functions/accessControl').FunctionAccessControl;
};

export type ReplaceMcpResourceAccessControlResponse = {
  success: true;
  resourceKind: McpGrantResourceKind;
  resourceId: string;
};
