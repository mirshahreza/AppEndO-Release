import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AiCapabilityPackId } from '../../../../../shared/api/contracts/ai/capabilityPacks';
import { wireInboundBuiltinPackTools } from './inboundBuiltinPackBridge';
import { wireInboundResourcesAndPrompts } from './inboundResourcesPrompts';

export const APPENDO_INBOUND_MCP_SERVER_INFO = {
  name: 'appendo',
  version: '1.0.0',
} as const;

/** Inbound MCP server — exposes builtin capability pack tools for the resolved pack scope. */
export const createInboundMcpServer = (packIds: readonly AiCapabilityPackId[]): McpServer => {
  const server = new McpServer(APPENDO_INBOUND_MCP_SERVER_INFO, {
    capabilities: {
      resources: {},
      prompts: {},
    },
  });
  wireInboundBuiltinPackTools(server, packIds);
  wireInboundResourcesAndPrompts(server, packIds);
  return server;
};
