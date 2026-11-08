import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { aiManager } from '../../../../../core/ai/AiManager';
import { createPhase1ToolRegistry } from '../../../../../core/ai/tools/ToolRegistry';
import type { ToolParameterSchema } from '../../../../../core/ai/tools/ToolRegistry';
import type { ToolResult } from '../../../../../shared/api/contracts/ai/agentTypes';
import {
  resolveDefaultCapabilityPackIds,
  type AiCapabilityPackId,
} from '../../../../../shared/api/contracts/ai/capabilityPacks';
import type { AiNativeToolGroup } from '../../../../../shared/api/contracts/ai/types';
import { registerBuiltinCapabilityPacks } from '../builtin';
import { AGENT_PACK_TOOL_GROUPS } from '../builtin/agentPackRuntime';

/** Draft/git-write tools require agent confirm gate — not exposed on inbound MCP. */
export const INBOUND_MCP_EXCLUDED_TOOL_NAMES = new Set<string>([
  'draft_file_patch',
  'draft_component_layout',
  'draft_server_function',
  'git_commit',
  'git_checkout',
  'git_branch',
]);

const INBOUND_DOC_ACCESS_PRINCIPAL = {
  isAdmin: true,
  roles: ['admin'],
} as const;

const jsonTypeToZod = (type: string): z.ZodTypeAny => {
  switch (type) {
    case 'number':
    case 'integer':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(z.unknown());
    case 'object':
      return z.record(z.string(), z.unknown());
    default:
      return z.string();
  }
};

export const toolParametersToZodShape = (
  schema: ToolParameterSchema,
): Record<string, z.ZodTypeAny> => {
  const shape: Record<string, z.ZodTypeAny> = {};

  Object.entries(schema.properties).forEach(([key, property]) => {
    let field = jsonTypeToZod(property.type);
    if (property.description) {
      field = field.describe(property.description);
    }
    if (!schema.required?.includes(key)) {
      field = field.optional();
    }
    shape[key] = field;
  });

  return shape;
};

export const isInboundMcpToolExcluded = (toolName: string): boolean =>
  INBOUND_MCP_EXCLUDED_TOOL_NAMES.has(toolName);

export const resolveInboundCapabilityPackIds = (): AiCapabilityPackId[] => (
  resolveDefaultCapabilityPackIds(aiManager.getSettings()?.mcp.defaultCapabilityPackIds)
);

export const createInboundPackToolRegistry = (
  packIds: readonly AiCapabilityPackId[],
  allowedGroups: readonly AiNativeToolGroup[] = AGENT_PACK_TOOL_GROUPS,
) => {
  const registry = createPhase1ToolRegistry('agent', [...allowedGroups]);
  registerBuiltinCapabilityPacks(registry, packIds);
  return registry;
};

const toolResultToMcpResponse = (result: ToolResult) => {
  const payload = {
    ok: result.ok,
    summary: result.summary,
    data: result.data,
    error: result.error,
  };

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(payload, null, 2),
    }],
    isError: !result.ok,
  };
};

export const wireInboundBuiltinPackTools = (
  server: McpServer,
  packIds: readonly AiCapabilityPackId[],
): number => {
  const registry = createInboundPackToolRegistry(packIds);
  let registeredCount = 0;

  registry.listDefinitions().forEach((definition) => {
    if (isInboundMcpToolExcluded(definition.name)) {
      return;
    }

    const inputShape = toolParametersToZodShape(definition.parameters);
    server.tool(
      definition.name,
      definition.description,
      inputShape,
      async (args) => {
        const result = await registry.execute(definition.name, args, {
          docAccessPrincipal: INBOUND_DOC_ACCESS_PRINCIPAL,
        });
        return toolResultToMcpResponse(result);
      },
    );
    registeredCount += 1;
  });

  return registeredCount;
};
