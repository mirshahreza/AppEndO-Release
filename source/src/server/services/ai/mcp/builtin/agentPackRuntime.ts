import { createPhase1ToolRegistry } from '../../../../../core/ai/tools/ToolRegistry';
import type { AiCapabilityPackId } from '../../../../../shared/api/contracts/ai/capabilityPacks';
import type { AiNativeToolGroup } from '../../../../../shared/api/contracts/ai/types';
import { registerBuiltinCapabilityPacks } from './index';

/** Tool groups enabled for Agent-mode builtin pack registration (matches agent runtime). */
export const AGENT_PACK_TOOL_GROUPS: AiNativeToolGroup[] = [
  'read',
  'search',
  'standards',
  'context',
  'draft',
  'data',
  'git',
  'openapi',
  'jobs',
  'edge',
  'plugins',
  'memory',
  'cache',
  'workflow',
  'delegate',
];

export const createAgentPackRegistry = () =>
  createPhase1ToolRegistry('agent', AGENT_PACK_TOOL_GROUPS);

export type AgentPackRegistry = ReturnType<typeof createAgentPackRegistry>;

export const listRegistryToolNames = (registry: AgentPackRegistry) =>
  registry.listDefinitions().map((tool) => tool.name);

export const registerPacks = (
  registry: AgentPackRegistry,
  packIds: readonly AiCapabilityPackId[],
) => {
  registerBuiltinCapabilityPacks(registry, packIds);
};
