import type { ToolResult } from '../../../../shared/api/contracts/ai/agentTypes';
import type { AiMcpServerConfig } from '../../../../shared/api/contracts/ai/types';
import type { ToolExecutionContext } from '../../../../core/ai/agent/types';
import type { ToolParameterSchema, ToolRegistry } from '../../../../core/ai/tools/ToolRegistry';
import {
  executeMcpTool,
  listMcpToolDescriptors,
  resolveEnabledMcpServers,
} from './McpBridge';
import { mcpConnectionManager } from './McpConnectionManager';

export type McpRegistrationWarning = {
  serverId: string;
  serverLabel: string;
  message: string;
};

export type McpToolRegistrationResult = {
  warnings: McpRegistrationWarning[];
  registeredToolCount: number;
};

const mcpSchemaToParameters = (schema: Record<string, unknown>): ToolParameterSchema => {
  const properties = schema.properties && typeof schema.properties === 'object'
    ? Object.fromEntries(
      Object.entries(schema.properties as Record<string, { type?: string; description?: string }>).map(
        ([key, value]) => [key, {
          type: value.type || 'string',
          description: value.description,
        }],
      ),
    )
    : {};

  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : undefined;

  return {
    type: 'object',
    properties,
    required,
  };
};

export const registerMcpTools = async (
  registry: ToolRegistry,
  servers: AiMcpServerConfig[],
  enabledMcpServerIds?: string[],
): Promise<McpToolRegistrationResult> => {
  const warnings: McpRegistrationWarning[] = [];
  const enabledServers = resolveEnabledMcpServers(servers, enabledMcpServerIds);
  if (enabledServers.length === 0) {
    return { warnings, registeredToolCount: 0 };
  }

  const descriptorGroups = await Promise.all(
    enabledServers.map(async (server) => {
      try {
        return await listMcpToolDescriptors(server);
      } catch (error) {
        warnings.push({
          serverId: server.id,
          serverLabel: server.label,
          message: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    }),
  );

  const descriptors = descriptorGroups.flat();
  descriptors.forEach((descriptor) => {
    const server = enabledServers.find((item) => item.id === descriptor.serverId);
    if (!server) return;

    registry.registerMcp({
      name: descriptor.registryName,
      description: `[MCP:${server.label}] ${descriptor.description}`,
      serverId: descriptor.serverId,
      originalName: descriptor.toolName,
      allowedTools: server.allowedTools,
      parameters: mcpSchemaToParameters(descriptor.inputSchema),
      execute: async (args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> => (
        executeMcpTool(server, descriptor.toolName, args)
      ),
    });
  });

  return {
    warnings,
    registeredToolCount: descriptors.length,
  };
};

export const disconnectMcpServers = async (serverIds: string[]): Promise<void> => {
  await Promise.all(serverIds.map((serverId) => mcpConnectionManager.disconnect(serverId)));
};
