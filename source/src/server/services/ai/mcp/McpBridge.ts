import type { ToolResult } from '../../../../shared/api/contracts/ai/agentTypes';
import type { AiMcpServerConfig } from '../../../../shared/api/contracts/ai/types';
import { mcpConnectionManager } from './McpConnectionManager';
import { summarizeMcpToolOutput } from './mcpOutputSanitizer';
import { buildMcpRegistryToolName } from './mcpToolNaming';

export type McpToolDescriptor = {
  registryName: string;
  serverId: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const resolveEnabledMcpServers = (
  servers: AiMcpServerConfig[],
  enabledMcpServerIds?: string[],
): AiMcpServerConfig[] => {
  const enabled = servers.filter((server) => server.enabled);
  if (!enabledMcpServerIds || enabledMcpServerIds.length === 0) {
    return enabled;
  }

  const allowed = new Set(enabledMcpServerIds);
  return enabled.filter((server) => allowed.has(server.id));
};

export const listMcpToolDescriptors = async (
  server: AiMcpServerConfig,
): Promise<McpToolDescriptor[]> => {
  const response = await mcpConnectionManager.listTools(server);
  const allowed = server.allowedTools && server.allowedTools.length > 0
    ? new Set(server.allowedTools)
    : null;

  return (response.tools ?? [])
    .filter((tool) => !allowed || allowed.has(tool.name))
    .map((tool) => ({
      registryName: buildMcpRegistryToolName(server.id, tool.name),
      serverId: server.id,
      toolName: tool.name,
      description: tool.description?.trim() || `MCP tool from ${server.label}`,
      inputSchema: (tool.inputSchema && typeof tool.inputSchema === 'object')
        ? tool.inputSchema as Record<string, unknown>
        : { type: 'object', properties: {} },
    }));
};

export const executeMcpTool = async (
  server: AiMcpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> => {
  try {
    const raw = await mcpConnectionManager.callTool(server, toolName, args);
    const summary = summarizeMcpToolOutput(raw);
    return {
      ok: true,
      summary,
      data: raw,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      summary: `MCP tool "${toolName}" failed on server "${server.label}".`,
      error: message,
    };
  }
};

export const testMcpServerConnection = async (
  server: AiMcpServerConfig,
): Promise<{ message: string; toolCount: number; toolNames: string[]; latencyMs: number }> => (
  mcpConnectionManager.testConnection(server)
);
