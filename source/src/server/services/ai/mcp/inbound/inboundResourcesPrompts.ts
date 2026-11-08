import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PROJECT_STANDARDS } from '../../../../../config/projectStandards';
import {
  AI_CAPABILITY_PACK_BY_ID,
  type AiCapabilityPackId,
} from '../../../../../shared/api/contracts/ai/capabilityPacks';
import { formatProjectStandardsContextBlock } from '../../../../../shared/api/contracts/ai/chatContextResources';

export const INBOUND_MCP_RESOURCE_URIS = {
  projectStandards: 'appendo://project-standards',
  capabilityPacks: 'appendo://capability-packs',
} as const;

export const INBOUND_MCP_PROMPT_NAMES = {
  projectStandards: 'project_standards',
  agentBrief: 'appendo_agent_brief',
} as const;

export type InboundCapabilityPackSnapshot = {
  id: AiCapabilityPackId;
  label: string;
  description: string;
  toolNames: readonly string[];
  hasWriteTools: boolean;
};

export const buildInboundCapabilityPackSnapshot = (
  packIds: readonly AiCapabilityPackId[],
): InboundCapabilityPackSnapshot[] => (
  packIds.map((packId) => {
    const pack = AI_CAPABILITY_PACK_BY_ID[packId];
    return {
      id: packId,
      label: pack.label,
      description: pack.description,
      toolNames: pack.toolNames,
      hasWriteTools: pack.hasWriteTools,
    };
  })
);

export const buildInboundAgentBriefPromptText = (
  packIds: readonly AiCapabilityPackId[],
): string => {
  const packs = buildInboundCapabilityPackSnapshot(packIds);
  const toolLines = packs.flatMap((pack) => (
    pack.toolNames.map((toolName) => `- ${toolName} (${pack.label})`)
  ));

  return [
    'You are connected to AppEndO via inbound MCP.',
    'Use the exposed tools for workspace files, standards, git, data, and other enabled capability packs.',
    'Write and git-write tools are excluded from inbound MCP — use the in-app Agent for confirm-gated changes.',
    '',
    'Enabled capability packs:',
    ...packs.map((pack) => `- ${pack.label} (${pack.id}): ${pack.description}`),
    '',
    'Available tools:',
    ...toolLines,
  ].join('\n');
};

export const wireInboundResourcesAndPrompts = (
  server: McpServer,
  packIds: readonly AiCapabilityPackId[],
): {
  resourceCount: number;
  promptCount: number;
} => {
  server.registerResource(
    'project-standards',
    INBOUND_MCP_RESOURCE_URIS.projectStandards,
    {
      description: 'AppEndO project coding standards (machine-readable JSON from /api/project-standards).',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [{
        uri: INBOUND_MCP_RESOURCE_URIS.projectStandards,
        mimeType: 'application/json',
        text: JSON.stringify(PROJECT_STANDARDS, null, 2),
      }],
    }),
  );

  server.registerResource(
    'capability-packs',
    INBOUND_MCP_RESOURCE_URIS.capabilityPacks,
    {
      description: 'Builtin capability packs exposed on this inbound MCP host (from ai.mcp.defaultCapabilityPackIds).',
      mimeType: 'application/json',
    },
    async () => {
      const payload = {
        packIds,
        packs: buildInboundCapabilityPackSnapshot(packIds),
      };

      return {
        contents: [{
          uri: INBOUND_MCP_RESOURCE_URIS.capabilityPacks,
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2),
        }],
      };
    },
  );

  server.registerPrompt(
    INBOUND_MCP_PROMPT_NAMES.projectStandards,
    {
      title: 'Project standards',
      description: 'Summarized AppEndO coding standards for external MCP clients.',
    },
    async () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: formatProjectStandardsContextBlock(),
        },
      }],
    }),
  );

  server.registerPrompt(
    INBOUND_MCP_PROMPT_NAMES.agentBrief,
    {
      title: 'AppEndO agent brief',
      description: 'Overview of enabled inbound MCP tools and capability packs.',
    },
    async () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: buildInboundAgentBriefPromptText(packIds),
        },
      }],
    }),
  );

  return { resourceCount: 2, promptCount: 2 };
};
