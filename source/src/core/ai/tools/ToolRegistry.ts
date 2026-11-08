import type { AgentMode, ToolResult } from '../../../shared/api/contracts/ai/agentTypes';
import type { AiCapabilityPackId } from '../../../shared/api/contracts/ai/capabilityPacks';
import { resolveToolNamesForCapabilityPackIds } from '../../../shared/api/contracts/ai/capabilityPacks';
import type { AiNativeToolGroup } from '../../../shared/api/contracts/ai/types';
import type { ToolExecutionContext } from '../agent/types';
import type { TurnExecutionProfile } from '../agent/turnExecutionProfile';
import { isLookupProfile } from '../agent/turnExecutionProfile';

export type ToolParameterSchema = {
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
};

export type NativeToolDefinition = {
  name: string;
  description: string;
  group: AiNativeToolGroup;
  parameters: ToolParameterSchema;
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  serverId: string;
  originalName: string;
  allowedTools?: string[];
  parameters: ToolParameterSchema;
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
};

export type RegisteredNativeTool = NativeToolDefinition & {
  source: 'native';
};

export type RegisteredMcpTool = McpToolDefinition & {
  source: 'mcp';
};

export type RegisteredTool = RegisteredNativeTool | RegisteredMcpTool;

export type ListToolDefinitionsOptions = {
  /** When set, native tools are limited to this session's enabled built-in packs (TOK-14). */
  activePackIds?: readonly AiCapabilityPackId[];
};

const ASK_ALLOWED_GROUPS = new Set<AiNativeToolGroup>([
  'standards',
  'search',
  'read',
  'context',
  'openapi',
  // p-98 — deliberately NOT including 'delegate' here. A delegated subagent's own registry is
  // also built with mode: 'ask' (see delegateResearch.ts), and THIS constant — not the
  // caller-supplied allowedGroups — is what governs tool visibility in ask mode. Keeping
  // 'delegate' out of it is what structurally prevents a subagent from delegating again; it also
  // means top-level Ask mode doesn't get delegate_research (Agent mode only) — a deliberate
  // trade-off, not an oversight.
]);

const ASK_ALLOWED_EDGE_TOOLS = new Set(['list_server_functions', 'get_server_function', 'test_server_function']);

const ASK_ALLOWED_GIT_TOOLS = new Set(['git_status', 'git_diff', 'git_log', 'git_show', 'git_blame']);

const ASK_BLOCKED_TOOL_NAMES = new Set([
  'run_tests',
  'git_commit',
  'git_checkout',
  'git_branch',
  'draft_file_patch',
  'draft_server_function',
  'draft_component_layout',
  'draft_dashboard_widget',
  'prune_tool_observations',
]);

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  constructor(
    private readonly config: {
      mode: AgentMode;
      allowedGroups: AiNativeToolGroup[];
      executionProfile?: TurnExecutionProfile;
    },
  ) {}

  register(tool: NativeToolDefinition): void {
    this.tools.set(tool.name, { ...tool, source: 'native' });
  }

  registerMcp(tool: McpToolDefinition): void {
    this.tools.set(tool.name, { ...tool, source: 'mcp' });
  }

  /** V5 Phase P11 § V5-23 — lets a caller (e.g. `AgentOrchestrator`) classify trust/capability by provenance, not just tool name. */
  getToolSource(name: string): 'native' | 'mcp' | undefined {
    return this.tools.get(name)?.source;
  }

  listDefinitions(
    options?: ListToolDefinitionsOptions,
  ): Array<Pick<RegisteredTool, 'name' | 'description' | 'parameters'>> {
    const packToolNames = options?.activePackIds?.length
      ? resolveToolNamesForCapabilityPackIds(options.activePackIds)
      : null;

    return [...this.tools.values()]
      .filter((tool) => this.isToolAllowed(tool))
      .filter((tool) => {
        if (!packToolNames) return true;
        if (tool.source === 'mcp') return true;
        return packToolNames.has(tool.name);
      })
      .map(({ name, description, parameters }) => ({ name, description, parameters }));
  }

  isToolAllowed(tool: RegisteredTool): boolean {
    if (this.config.mode === 'ask') {
      if (tool.source === 'mcp') return false;
      if (ASK_BLOCKED_TOOL_NAMES.has(tool.name) || tool.name.startsWith('draft_')) return false;
      if (tool.group === 'edge') return ASK_ALLOWED_EDGE_TOOLS.has(tool.name);
      if (tool.group === 'git') return ASK_ALLOWED_GIT_TOOLS.has(tool.name);
      return ASK_ALLOWED_GROUPS.has(tool.group);
    }

    if (this.config.mode === 'plan' && tool.source === 'mcp') {
      return false;
    }

    if (tool.source === 'mcp') {
      if (tool.allowedTools && tool.allowedTools.length > 0) {
        return tool.allowedTools.includes(tool.originalName);
      }
      return true;
    }

    if (this.config.mode === 'agent' && tool.group === 'draft') {
      const profile = this.config.executionProfile ?? 'agent_implement';
      if (isLookupProfile(profile)) {
        return false;
      }
      return true;
    }

    if (this.config.mode === 'plan') {
      if (tool.group === 'standards' || tool.group === 'context') {
        return true;
      }
      if (tool.name === 'draft_file_patch') {
        return true;
      }
      return false;
    }

    if (tool.group === 'context' && (this.config.mode === 'agent' || this.config.mode === 'plan')) {
      return true;
    }

    return this.config.allowedGroups.includes(tool.group);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: Omit<ToolExecutionContext, 'mode' | 'allowedGroups'>,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, summary: `Unknown tool "${name}".`, error: 'tool_not_found' };
    }

    if (!this.isToolAllowed(tool)) {
      return {
        ok: false,
        summary: `Tool "${name}" is not allowed in ${this.config.mode} mode.`,
        error: 'tool_not_permitted',
      };
    }

    try {
      return await tool.execute(args, {
        ...context,
        mode: this.config.mode,
        allowedGroups: this.config.allowedGroups,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, summary: `Tool "${name}" failed.`, error: message };
    }
  }
}

export const createPhase1ToolRegistry = (
  mode: AgentMode,
  allowedGroups: AiNativeToolGroup[],
  executionProfile?: TurnExecutionProfile,
): ToolRegistry => {
  const registry = new ToolRegistry({ mode, allowedGroups, executionProfile });
  return registry;
};
