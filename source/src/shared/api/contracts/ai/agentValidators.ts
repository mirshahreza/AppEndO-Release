import { parseFunctionAccessControl } from '../server-functions/accessControl';
import { DEFAULT_AI_AGENT_SETTINGS, DEFAULT_AI_MCP_SERVERS, AI_NATIVE_TOOL_GROUPS } from './constants';
import {
  DEFAULT_AGENT_CAPABILITY_SCOPE,
  type AiAgentCapabilityScope,
  type AiCapabilityPackId,
  isAiCapabilityPackId,
} from './capabilityPacks';
import type {
  AgentApplyRequest,
  AgentChatMessage,
  AgentMode,
  AgentPlanPayload,
  AgentProposalFeedbackRequest,
  AgentChatLatencyRequest,
  PromptTaskDecompositionPayload,
  AgentRollbackRequest,
  AgentRunRequest,
  AgentStreamEvent,
  AgentStreamEngineeringPipelineEvent,
  AgentStreamRequestRoutingEvent,
  AgentStreamTurnProfileEvent,
  ChangeSet,
  ChangeSetKind,
  ProposalViolation,
  ToolResult,
} from './agentTypes';
import type { AiAgentSettings, AiMcpServerConfig, AiMcpServerTransport, AiNativeToolGroup, AiOrchestrationPolicy } from './types';
import { AiValidationError } from './errors';
import type { AiPageContext } from './pageContext';
import { normalizeChatContextResourceIds, resolveChatContextResources } from './chatContextResources';
import type { AgentMessageAttachment } from './agentMessageAttachments';

const AGENT_MODES = new Set<AgentMode>(['ask', 'agent', 'plan']);
const CHANGE_SET_KINDS = new Set<ChangeSetKind>([
  'component_layout_patch',
  'function_source_patch',
  'settings_block_patch',
  'file_patch',
  'git_operation',
]);
const MCP_TRANSPORTS = new Set<AiMcpServerTransport>(['stdio', 'sse', 'http']);
const NATIVE_TOOL_GROUPS = new Set<AiNativeToolGroup>(AI_NATIVE_TOOL_GROUPS);
const ORCHESTRATION_POLICIES = new Set<AiOrchestrationPolicy>(['react', 'utility-guided']);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const parseOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return String(value);
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const dedupeStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    if (seen.has(value)) return;
    seen.add(value);
    result.push(value);
  });
  return result;
};

export const normalizeCapabilityPackIds = (
  input: unknown,
  field = 'packIds',
): AiCapabilityPackId[] => {
  if (!Array.isArray(input)) {
    throw new AiValidationError(`${field} must be an array.`);
  }

  return dedupeStrings(input.map((value, index) => {
    const normalized = String(value ?? '').trim();
    if (!normalized || !isAiCapabilityPackId(normalized)) {
      throw new AiValidationError(`${field}[${index}] "${normalized || '(empty)'}" is invalid.`);
    }
    return normalized;
  }));
};

export const normalizeMcpServerIds = (input: unknown, field = 'mcpServerIds'): string[] => {
  if (!Array.isArray(input)) {
    throw new AiValidationError(`${field} must be an array.`);
  }

  return dedupeStrings(input.map((value, index) => {
    const normalized = String(value ?? '').trim();
    if (!normalized || !SLUG_PATTERN.test(normalized)) {
      throw new AiValidationError(`${field}[${index}] is invalid.`);
    }
    return normalized;
  }));
};

export const normalizeAgentCapabilityScope = (
  input: unknown,
  options?: { applyDefaultWhenMissing?: boolean },
): AiAgentCapabilityScope | undefined => {
  if (input === undefined || input === null) {
    return options?.applyDefaultWhenMissing
      ? {
        packIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.packIds],
        mcpServerIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.mcpServerIds],
      }
      : undefined;
  }

  if (!isRecord(input)) {
    throw new AiValidationError('agentCapabilityScope must be an object.');
  }

  return {
    packIds: normalizeCapabilityPackIds(input.packIds, 'agentCapabilityScope.packIds'),
    mcpServerIds: normalizeMcpServerIds(input.mcpServerIds, 'agentCapabilityScope.mcpServerIds'),
  };
};

export const serializeAgentCapabilityScope = (scope: AiAgentCapabilityScope): string => (
  JSON.stringify({
    packIds: scope.packIds,
    mcpServerIds: scope.mcpServerIds,
  })
);

export const parseAgentCapabilityScopeJson = (
  raw: string | null | undefined,
): AiAgentCapabilityScope => {
  if (!raw?.trim()) {
    return {
      packIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.packIds],
      mcpServerIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.mcpServerIds],
    };
  }

  try {
    const parsed = normalizeAgentCapabilityScope(JSON.parse(raw));
    if (!parsed) {
      return {
        packIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.packIds],
        mcpServerIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.mcpServerIds],
      };
    }
    return parsed;
  } catch {
    return {
      packIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.packIds],
      mcpServerIds: [...DEFAULT_AGENT_CAPABILITY_SCOPE.mcpServerIds],
    };
  }
};

export const normalizeAgentMode = (value: unknown, field = 'mode'): AgentMode => {
  const raw = String(value ?? '').trim();
  const mode = raw as AgentMode;
  if (!AGENT_MODES.has(mode)) {
    throw new AiValidationError(`${field} must be one of: ask, agent, plan.`);
  }
  return mode;
};

const normalizeAgentMessageAttachments = (
  input: unknown,
  index: number,
): AgentMessageAttachment[] | undefined => {
  if (input === undefined || input === null) return undefined;
  if (!Array.isArray(input)) {
    throw new AiValidationError(`Message at index ${index} attachments must be an array.`);
  }

  const attachments = input.map((item, attachmentIndex) => {
    if (!isRecord(item)) {
      throw new AiValidationError(`Message at index ${index} attachment[${attachmentIndex}] must be an object.`);
    }
    const id = String(item.id ?? '').trim();
    const name = String(item.name ?? '').trim();
    const mimeType = String(item.mimeType ?? 'application/octet-stream').trim();
    const kind = item.kind === 'image' ? 'image' : 'file';
    const size = Number(item.size ?? 0);
    if (!id || !name) {
      throw new AiValidationError(`Message at index ${index} attachment[${attachmentIndex}] is invalid.`);
    }
    return {
      id,
      name,
      mimeType,
      kind,
      previewUrl: parseOptionalString(item.previewUrl)?.trim() || undefined,
      size: Number.isFinite(size) && size >= 0 ? size : 0,
    } satisfies AgentMessageAttachment;
  });

  return attachments.length ? attachments : undefined;
};

export const normalizeAgentChatMessage = (input: unknown, index = 0): AgentChatMessage => {
  if (!isRecord(input)) {
    throw new AiValidationError(`Message at index ${index} must be an object.`);
  }

  const role = String(input.role ?? '').trim() as AgentChatMessage['role'];
  if (!['user', 'assistant', 'system', 'tool'].includes(role)) {
    throw new AiValidationError(`Message at index ${index} has invalid role "${role || '(empty)'}".`);
  }

  const content = String(input.content ?? '');
  const attachments = normalizeAgentMessageAttachments(input.attachments, index);
  if (!content.trim() && role !== 'tool' && !attachments?.length) {
    throw new AiValidationError(`Message at index ${index} content cannot be empty.`);
  }

  return {
    role,
    content,
    attachments,
    toolCallId: parseOptionalString(input.toolCallId)?.trim() || undefined,
    name: parseOptionalString(input.name)?.trim() || undefined,
  };
};

export const normalizeAiPageContext = (input: unknown): AiPageContext | undefined => {
  if (input === undefined || input === null) return undefined;
  if (!isRecord(input)) {
    throw new AiValidationError('pageContext must be an object.');
  }

  const path = String(input.path ?? '').trim();
  const pageLabel = String(input.pageLabel ?? '').trim();
  if (!path || !pageLabel) {
    throw new AiValidationError('pageContext requires path and pageLabel.');
  }

  return {
    path,
    pageLabel,
    pageKey: parseOptionalString(input.pageKey)?.trim() || undefined,
    pageDescription: parseOptionalString(input.pageDescription)?.trim() || undefined,
    search: parseOptionalString(input.search)?.trim() || undefined,
    layoutId: parseOptionalString(input.layoutId)?.trim() || undefined,
    selectedNodeId: parseOptionalString(input.selectedNodeId)?.trim() || undefined,
    draftDirty: input.draftDirty === undefined ? undefined : Boolean(input.draftDirty),
    functionName: parseOptionalString(input.functionName)?.trim() || undefined,
    functionId: parseOptionalString(input.functionId)?.trim() || undefined,
    openEditorContentHash: parseOptionalString(input.openEditorContentHash)?.trim() || undefined,
    entityType: parseOptionalString(input.entityType)?.trim() || undefined,
    activeSectionId: parseOptionalString(input.activeSectionId)?.trim() || undefined,
    viewport: isRecord(input.viewport)
      ? {
        preset: parseOptionalString(input.viewport.preset)?.trim() || undefined,
        width: parseOptionalNumber(input.viewport.width),
        height: parseOptionalNumber(input.viewport.height),
        fillMode: parseOptionalString(input.viewport.fillMode)?.trim() || undefined,
      }
      : undefined,
    activeFilters: isRecord(input.activeFilters) ? input.activeFilters : undefined,
    sort: isRecord(input.sort)
      ? {
        field: parseOptionalString(input.sort.field)?.trim() || undefined,
        direction: input.sort.direction === 'desc' ? 'desc' : input.sort.direction === 'asc' ? 'asc' : undefined,
      }
      : undefined,
  };
};

export const normalizeAgentRunRequest = (input: unknown): AgentRunRequest => {
  if (!isRecord(input)) {
    throw new AiValidationError('Agent run request must be an object.');
  }

  const rawMessages = Array.isArray(input.messages) ? input.messages : [];
  if (rawMessages.length === 0) {
    throw new AiValidationError('messages must contain at least one entry.');
  }

  const sessionId = parseOptionalNumber(input.sessionId);
  if (sessionId !== undefined && (!Number.isInteger(sessionId) || sessionId < 1)) {
    throw new AiValidationError('sessionId must be a positive integer.');
  }

  const enabledMcpServerIds = Array.isArray(input.enabledMcpServerIds)
    ? normalizeMcpServerIds(input.enabledMcpServerIds, 'enabledMcpServerIds')
    : undefined;

  const enabledCapabilityPackIds = Array.isArray(input.enabledCapabilityPackIds)
    ? normalizeCapabilityPackIds(input.enabledCapabilityPackIds, 'enabledCapabilityPackIds')
    : undefined;

  const planDocumentPath = parseOptionalString(input.planDocumentPath)?.trim() || undefined;
  if (
    planDocumentPath
    && !planDocumentPath.startsWith('plans/core/todo/')
    && !planDocumentPath.startsWith('plans/core/next/')
    && !planDocumentPath.startsWith('plans/packages/')
  ) {
    throw new AiValidationError('planDocumentPath must be under plans/core/ or plans/packages/.');
  }

  const agentPlanActMode = input.agentPlanActMode === 'review' || input.agentPlanActMode === 'implement'
    ? input.agentPlanActMode
    : undefined;

  return {
    sessionId: sessionId !== undefined ? Math.floor(sessionId) : undefined,
    mode: normalizeAgentMode(input.mode),
    messages: rawMessages.map((message, index) => normalizeAgentChatMessage(message, index)),
    modelId: parseOptionalString(input.modelId)?.trim() || undefined,
    pageContext: normalizeAiPageContext(input.pageContext),
    contextResources: resolveChatContextResources(
      normalizeAgentMode(input.mode),
      normalizeChatContextResourceIds(input.contextResources),
      normalizeAiPageContext(input.pageContext),
    ),
    enabledMcpServerIds,
    enabledCapabilityPackIds,
    planDocumentPath,
    agentPlanActMode,
  };
};

export const normalizeAiNativeToolGroups = (input: unknown): AiNativeToolGroup[] => {
  if (!Array.isArray(input)) {
    return [...DEFAULT_AI_AGENT_SETTINGS.allowedNativeToolGroups];
  }

  const groups = input.map((value, index) => {
    const group = String(value ?? '').trim() as AiNativeToolGroup;
    if (!NATIVE_TOOL_GROUPS.has(group)) {
      throw new AiValidationError(`allowedNativeToolGroups[${index}] "${group || '(empty)'}" is invalid.`);
    }
    return group;
  });

  return groups.length > 0 ? groups : [...DEFAULT_AI_AGENT_SETTINGS.allowedNativeToolGroups];
};

export const normalizeAiAgentSettings = (input: unknown): AiAgentSettings => {
  const defaults = DEFAULT_AI_AGENT_SETTINGS;
  const raw = isRecord(input) ? input : {};

  const maxIterations = Number(raw.maxIterations ?? defaults.maxIterations);
  if (!Number.isFinite(maxIterations) || maxIterations < 1 || maxIterations > 100) {
    throw new AiValidationError('agent.maxIterations must be between 1 and 100.');
  }

  const maxIterationsVibe = Number(raw.maxIterationsVibe ?? defaults.maxIterationsVibe);
  if (!Number.isFinite(maxIterationsVibe) || maxIterationsVibe < 1 || maxIterationsVibe > 200) {
    throw new AiValidationError('agent.maxIterationsVibe must be between 1 and 200.');
  }

  const maxIterationsAsk = Number(raw.maxIterationsAsk ?? defaults.maxIterationsAsk ?? 8);
  if (!Number.isFinite(maxIterationsAsk) || maxIterationsAsk < 1 || maxIterationsAsk > 50) {
    throw new AiValidationError('agent.maxIterationsAsk must be between 1 and 50.');
  }

  const maxToolCallsPerTurn = Number(raw.maxToolCallsPerTurn ?? defaults.maxToolCallsPerTurn);
  if (!Number.isFinite(maxToolCallsPerTurn) || maxToolCallsPerTurn < 1 || maxToolCallsPerTurn > 50) {
    throw new AiValidationError('agent.maxToolCallsPerTurn must be between 1 and 50.');
  }

  const maxTokensPerRun = Number(raw.maxTokensPerRun ?? defaults.maxTokensPerRun ?? 200_000);
  if (!Number.isFinite(maxTokensPerRun) || maxTokensPerRun < 1_000 || maxTokensPerRun > 1_000_000) {
    throw new AiValidationError('agent.maxTokensPerRun must be between 1000 and 1000000.');
  }

  const contextWorkingTurns = Number(raw.contextWorkingTurns ?? defaults.contextWorkingTurns ?? 8);
  if (!Number.isFinite(contextWorkingTurns) || contextWorkingTurns < 1 || contextWorkingTurns > 50) {
    throw new AiValidationError('agent.contextWorkingTurns must be between 1 and 50.');
  }

  const contextSummarizeAfterTurns = Number(raw.contextSummarizeAfterTurns ?? defaults.contextSummarizeAfterTurns ?? 12);
  if (!Number.isFinite(contextSummarizeAfterTurns) || contextSummarizeAfterTurns < 2 || contextSummarizeAfterTurns > 100) {
    throw new AiValidationError('agent.contextSummarizeAfterTurns must be between 2 and 100.');
  }

  const contextToolObservationMaxTurns = Number(
    raw.contextToolObservationMaxTurns ?? defaults.contextToolObservationMaxTurns ?? 12,
  );
  if (
    !Number.isFinite(contextToolObservationMaxTurns)
    || contextToolObservationMaxTurns < 1
    || contextToolObservationMaxTurns > 50
  ) {
    throw new AiValidationError('agent.contextToolObservationMaxTurns must be between 1 and 50.');
  }

  const traceRetentionDays = Number(raw.traceRetentionDays ?? defaults.traceRetentionDays ?? 30);
  if (!Number.isFinite(traceRetentionDays) || traceRetentionDays < 1 || traceRetentionDays > 365) {
    throw new AiValidationError('agent.traceRetentionDays must be between 1 and 365.');
  }

  const vibeMaxFilesPerProposal = Number(raw.vibeMaxFilesPerProposal ?? defaults.vibeMaxFilesPerProposal ?? 8);
  if (!Number.isFinite(vibeMaxFilesPerProposal) || vibeMaxFilesPerProposal < 1 || vibeMaxFilesPerProposal > 50) {
    throw new AiValidationError('agent.vibeMaxFilesPerProposal must be between 1 and 50.');
  }

  const vibeMaxLinesPerProposal = Number(raw.vibeMaxLinesPerProposal ?? defaults.vibeMaxLinesPerProposal ?? 400);
  if (!Number.isFinite(vibeMaxLinesPerProposal) || vibeMaxLinesPerProposal < 10 || vibeMaxLinesPerProposal > 10_000) {
    throw new AiValidationError('agent.vibeMaxLinesPerProposal must be between 10 and 10000.');
  }

  const orchestrationPolicy = String(raw.orchestrationPolicy ?? defaults.orchestrationPolicy ?? 'react').trim() as AiOrchestrationPolicy;
  if (!ORCHESTRATION_POLICIES.has(orchestrationPolicy)) {
    throw new AiValidationError('agent.orchestrationPolicy must be react or utility-guided.');
  }

  return {
    defaultMode: normalizeAgentMode(raw.defaultMode ?? defaults.defaultMode, 'agent.defaultMode'),
    maxIterations: Math.floor(maxIterations),
    maxIterationsVibe: Math.floor(maxIterationsVibe),
    maxIterationsAsk: Math.floor(maxIterationsAsk),
    maxToolCallsPerTurn: Math.floor(maxToolCallsPerTurn),
    maxTokensPerRun: Math.floor(maxTokensPerRun),
    orchestrationPolicy,
    tokenBudgetHardStop: raw.tokenBudgetHardStop !== undefined
      ? Boolean(raw.tokenBudgetHardStop)
      : defaults.tokenBudgetHardStop ?? true,
    allowedNativeToolGroups: normalizeAiNativeToolGroups(raw.allowedNativeToolGroups),
    writeRequiresConfirm: raw.writeRequiresConfirm !== undefined
      ? Boolean(raw.writeRequiresConfirm)
      : defaults.writeRequiresConfirm,
    contextWorkingTurns: Math.floor(contextWorkingTurns),
    contextSummarizeAfterTurns: Math.floor(contextSummarizeAfterTurns),
    contextSummarizeWithLlm: raw.contextSummarizeWithLlm !== undefined
      ? Boolean(raw.contextSummarizeWithLlm)
      : defaults.contextSummarizeWithLlm ?? false,
    contextToolObservationMaxTurns: Math.floor(contextToolObservationMaxTurns),
    traceRetentionDays: Math.floor(traceRetentionDays),
    vibeMaxFilesPerProposal: Math.floor(vibeMaxFilesPerProposal),
    vibeMaxLinesPerProposal: Math.floor(vibeMaxLinesPerProposal),
  };
};

const normalizeStringArray = (input: unknown, field: string): string[] | undefined => {
  if (input === undefined || input === null) return undefined;
  if (!Array.isArray(input)) {
    throw new AiValidationError(`${field} must be an array.`);
  }
  return input.map((value, index) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new AiValidationError(`${field}[${index}] cannot be empty.`);
    }
    return normalized;
  });
};

const normalizeEnvRecord = (input: unknown): Record<string, string> | undefined => {
  if (input === undefined || input === null) return undefined;
  if (!isRecord(input)) {
    throw new AiValidationError('env must be an object.');
  }
  const env: Record<string, string> = {};
  Object.entries(input).forEach(([key, value]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) return;
    env[normalizedKey] = String(value ?? '');
  });
  return Object.keys(env).length > 0 ? env : undefined;
};

export const normalizeAiMcpServerConfig = (input: unknown, index = 0): AiMcpServerConfig => {
  if (!isRecord(input)) {
    throw new AiValidationError(`MCP server at index ${index} must be an object.`);
  }

  const id = String(input.id ?? '').trim();
  const label = String(input.label ?? '').trim();
  if (!id || !SLUG_PATTERN.test(id)) {
    throw new AiValidationError(`MCP server id "${id || '(empty)'}" at index ${index} is invalid.`);
  }
  if (!label) {
    throw new AiValidationError(`MCP server label at index ${index} is required.`);
  }

  const transport = String(input.transport ?? '').trim() as AiMcpServerTransport;
  if (!MCP_TRANSPORTS.has(transport)) {
    throw new AiValidationError(`MCP server "${id}" transport must be stdio, sse, or http.`);
  }

  const command = parseOptionalString(input.command)?.trim() || undefined;
  const url = parseOptionalString(input.url)?.trim() || undefined;

  if (transport === 'stdio' && !command) {
    throw new AiValidationError(`MCP server "${id}" requires command for stdio transport.`);
  }
  if ((transport === 'sse' || transport === 'http') && !url) {
    throw new AiValidationError(`MCP server "${id}" requires url for ${transport} transport.`);
  }

  const env = normalizeEnvRecord(input.env);

  return {
    id,
    label,
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : false,
    transport,
    command,
    args: normalizeStringArray(input.args, `mcpServers[${index}].args`),
    url,
    env,
    hasEnv: Boolean(input.hasEnv) || Boolean(env),
    allowedTools: normalizeStringArray(input.allowedTools, `mcpServers[${index}].allowedTools`),
    note: parseOptionalString(input.note)?.trim() || undefined,
    accessControl: input.accessControl !== undefined
      ? parseFunctionAccessControl(input.accessControl)
      : undefined,
  };
};

export const normalizeAiMcpServers = (input: unknown): AiMcpServerConfig[] => {
  if (input === undefined || input === null) {
    return DEFAULT_AI_MCP_SERVERS.map((server) => ({ ...server }));
  }
  if (!Array.isArray(input)) {
    throw new AiValidationError('mcpServers must be an array.');
  }

  const servers = input.map((server, index) => normalizeAiMcpServerConfig(server, index));
  const seenIds = new Set<string>();
  servers.forEach((server) => {
    if (seenIds.has(server.id)) {
      throw new AiValidationError(`Duplicate MCP server id "${server.id}".`);
    }
    seenIds.add(server.id);
  });
  return servers;
};

export const normalizeToolResult = (input: unknown): ToolResult => {
  if (!isRecord(input)) {
    throw new AiValidationError('ToolResult must be an object.');
  }

  const summary = String(input.summary ?? '').trim();
  if (!summary) {
    throw new AiValidationError('ToolResult.summary is required.');
  }

  return {
    ok: Boolean(input.ok),
    summary,
    data: input.data,
    error: parseOptionalString(input.error)?.trim() || undefined,
    artifacts: Array.isArray(input.artifacts)
      ? input.artifacts.map((artifact, index) => {
        if (!isRecord(artifact)) {
          throw new AiValidationError(`ToolResult.artifacts[${index}] must be an object.`);
        }
        const kind = String(artifact.kind ?? '').trim();
        const id = String(artifact.id ?? '').trim();
        if (!['draft', 'file', 'snapshot'].includes(kind) || !id) {
          throw new AiValidationError(`ToolResult.artifacts[${index}] is invalid.`);
        }
        return {
          kind: kind as 'draft' | 'file' | 'snapshot',
          id,
          label: parseOptionalString(artifact.label)?.trim() || undefined,
        };
      })
      : undefined,
  };
};

export const normalizeChangeSet = (input: unknown, index = 0): ChangeSet => {
  if (!isRecord(input)) {
    throw new AiValidationError(`ChangeSet at index ${index} must be an object.`);
  }

  const id = String(input.id ?? '').trim();
  const kind = String(input.kind ?? '').trim() as ChangeSetKind;
  const title = String(input.title ?? '').trim();

  if (!id) {
    throw new AiValidationError(`ChangeSet at index ${index} requires id.`);
  }
  if (!CHANGE_SET_KINDS.has(kind)) {
    throw new AiValidationError(`ChangeSet at index ${index} has invalid kind.`);
  }
  if (!title) {
    throw new AiValidationError(`ChangeSet at index ${index} requires title.`);
  }

  const base = {
    id,
    kind,
    title,
    summary: parseOptionalString(input.summary)?.trim() || undefined,
  };

  switch (kind) {
    case 'component_layout_patch':
      return {
        ...base,
        kind,
        layoutId: String(input.layoutId ?? '').trim(),
        patch: input.patch,
      };
    case 'function_source_patch':
      return {
        ...base,
        kind,
        functionId: String(input.functionId ?? '').trim(),
        patch: input.patch,
      };
    case 'settings_block_patch':
      return {
        ...base,
        kind,
        blockKey: String(input.blockKey ?? '').trim(),
        patch: input.patch,
      };
    case 'file_patch':
      return {
        ...base,
        kind,
        path: String(input.path ?? '').trim(),
        beforeHash: parseOptionalString(input.beforeHash)?.trim() || undefined,
        content: String(input.content ?? ''),
      };
    case 'git_operation': {
      const operation = String(input.operation ?? '').trim();
      if (operation !== 'commit' && operation !== 'checkout' && operation !== 'branch') {
        throw new AiValidationError(`ChangeSet at index ${index} has invalid git operation.`);
      }
      return {
        ...base,
        kind,
        operation,
        message: parseOptionalString(input.message)?.trim() || undefined,
        stageAll: input.stageAll === true ? true : undefined,
        paths: Array.isArray(input.paths)
          ? input.paths.map((value) => String(value ?? '').trim()).filter(Boolean)
          : undefined,
        target: parseOptionalString(input.target)?.trim() || undefined,
        branchName: parseOptionalString(input.branchName)?.trim() || undefined,
        startPoint: parseOptionalString(input.startPoint)?.trim() || undefined,
        checkout: input.checkout === false ? false : input.checkout === true ? true : undefined,
      };
    }
    default:
      throw new AiValidationError(`ChangeSet at index ${index} has unsupported kind.`);
  }
};

export const normalizeProposalViolation = (input: unknown, index = 0): ProposalViolation => {
  if (!isRecord(input)) {
    throw new AiValidationError(`Violation at index ${index} must be an object.`);
  }

  const id = String(input.id ?? '').trim() || `violation-${index}`;
  const severity = input.severity === 'warning' ? 'warning' : 'error';
  const message = String(input.message ?? '').trim();
  if (!message) {
    throw new AiValidationError(`Violation at index ${index} requires message.`);
  }

  return {
    id,
    severity,
    message,
    ruleId: parseOptionalString(input.ruleId)?.trim() || undefined,
    changeSetId: parseOptionalString(input.changeSetId)?.trim() || undefined,
  };
};

export const normalizeAgentPlanPayload = (input: unknown): AgentPlanPayload => {
  if (!isRecord(input)) {
    throw new AiValidationError('Plan payload must be an object.');
  }

  const steps = Array.isArray(input.steps)
    ? input.steps.map((step, index) => {
      const normalized = String(step ?? '').trim();
      if (!normalized) {
        throw new AiValidationError(`plan.steps[${index}] cannot be empty.`);
      }
      return normalized;
    })
    : [];

  const targetFiles = Array.isArray(input.targetFiles)
    ? input.targetFiles.map((file) => String(file ?? '').trim()).filter(Boolean)
    : Array.isArray(input.estimatedFiles)
      ? input.estimatedFiles.map((file) => String(file ?? '').trim()).filter(Boolean)
      : [];

  const intent = String(input.intent ?? input.summary ?? '').trim();
  if (!intent) {
    throw new AiValidationError('plan.intent is required.');
  }

  return { steps, targetFiles, intent };
};

export const normalizePromptTaskDecompositionPayload = (input: unknown): PromptTaskDecompositionPayload => {
  if (!isRecord(input)) {
    throw new AiValidationError('Task decomposition payload must be an object.');
  }

  const summary = String(input.summary ?? '').trim();
  if (!summary) {
    throw new AiValidationError('decomposition.summary is required.');
  }

  const workUnits = Array.isArray(input.workUnits)
    ? input.workUnits.map((unit, index) => {
      const normalized = String(unit ?? '').trim();
      if (!normalized) {
        throw new AiValidationError(`decomposition.workUnits[${index}] cannot be empty.`);
      }
      return normalized;
    })
    : [];

  if (workUnits.length === 0) {
    throw new AiValidationError('decomposition.workUnits must be a non-empty array.');
  }

  const assumptions = Array.isArray(input.assumptions)
    ? input.assumptions.map((item) => String(item ?? '').trim()).filter(Boolean)
    : undefined;
  const openQuestions = Array.isArray(input.openQuestions)
    ? input.openQuestions.map((item) => String(item ?? '').trim()).filter(Boolean)
    : undefined;

  return {
    summary,
    workUnits,
    assumptions: assumptions?.length ? assumptions : undefined,
    openQuestions: openQuestions?.length ? openQuestions : undefined,
  };
};

export const normalizeChangeSets = (input: unknown): ChangeSet[] => {
  if (!Array.isArray(input)) {
    throw new AiValidationError('changeSets must be an array.');
  }
  return input.map((changeSet, index) => normalizeChangeSet(changeSet, index));
};

export const normalizeAgentApplyRequest = (input: unknown): AgentApplyRequest => {
  if (!isRecord(input)) {
    throw new AiValidationError('Agent apply request must be an object.');
  }

  const sessionId = parseOptionalNumber(input.sessionId);
  if (sessionId !== undefined && (!Number.isInteger(sessionId) || sessionId < 1)) {
    throw new AiValidationError('sessionId must be a positive integer.');
  }

  const proposalId = String(input.proposalId ?? '').trim();
  if (!proposalId) {
    throw new AiValidationError('proposalId is required.');
  }

  const changeSets = normalizeChangeSets(input.changeSets);
  if (changeSets.length === 0) {
    throw new AiValidationError('changeSets must contain at least one entry.');
  }

  return {
    sessionId: sessionId !== undefined ? Math.floor(sessionId) : undefined,
    proposalId,
    changeSets,
    confirmOverrideWarnings: input.confirmOverrideWarnings === true,
    mode: input.mode !== undefined ? normalizeAgentMode(input.mode, 'mode') : undefined,
  };
};

export const normalizeAgentRollbackRequest = (input: unknown): AgentRollbackRequest => {
  if (!isRecord(input)) {
    throw new AiValidationError('Agent rollback request must be an object.');
  }

  const sessionId = parseOptionalNumber(input.sessionId);
  if (sessionId !== undefined && (!Number.isInteger(sessionId) || sessionId < 1)) {
    throw new AiValidationError('sessionId must be a positive integer.');
  }

  const applyId = Number(input.applyId);
  if (!Number.isInteger(applyId) || applyId < 1) {
    throw new AiValidationError('applyId must be a positive integer.');
  }

  const changeSetIds = Array.isArray(input.changeSetIds)
    ? input.changeSetIds
      .map((value) => String(value ?? '').trim())
      .filter((value) => value.length > 0)
    : undefined;

  const diffZoneRollbacks = Array.isArray(input.diffZoneRollbacks)
    ? input.diffZoneRollbacks.map((entry, index) => {
      if (!isRecord(entry)) {
        throw new AiValidationError(`diffZoneRollbacks[${index}] must be an object.`);
      }
      const changeSetId = String(entry.changeSetId ?? '').trim();
      if (!changeSetId) {
        throw new AiValidationError(`diffZoneRollbacks[${index}].changeSetId is required.`);
      }
      if (!Array.isArray(entry.zones) || entry.zones.length === 0) {
        throw new AiValidationError(`diffZoneRollbacks[${index}].zones must be a non-empty array.`);
      }
      const zones = entry.zones.map((zone, zoneIndex) => {
        if (!isRecord(zone)) {
          throw new AiValidationError(`diffZoneRollbacks[${index}].zones[${zoneIndex}] must be an object.`);
        }
        const startLine = Number(zone.startLine);
        const endLine = Number(zone.endLine);
        if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine < 1 || endLine < startLine) {
          throw new AiValidationError(`diffZoneRollbacks[${index}].zones[${zoneIndex}] has invalid line range.`);
        }
        return { startLine: Math.floor(startLine), endLine: Math.floor(endLine) };
      });
      return { changeSetId, zones };
    })
    : undefined;

  return {
    sessionId: sessionId !== undefined ? Math.floor(sessionId) : undefined,
    applyId,
    changeSetIds: changeSetIds?.length ? changeSetIds : undefined,
    diffZoneRollbacks: diffZoneRollbacks?.length ? diffZoneRollbacks : undefined,
  };
};

export const normalizeAgentProposalFeedbackRequest = (input: unknown): AgentProposalFeedbackRequest => {
  if (!isRecord(input)) {
    throw new AiValidationError('Agent proposal feedback request must be an object.');
  }

  const sessionId = parseOptionalNumber(input.sessionId);
  if (sessionId !== undefined && (!Number.isInteger(sessionId) || sessionId < 1)) {
    throw new AiValidationError('sessionId must be a positive integer.');
  }

  const proposalId = String(input.proposalId ?? '').trim();
  if (!proposalId) {
    throw new AiValidationError('proposalId is required.');
  }

  const changeSetCount = Number(input.changeSetCount);
  if (!Number.isInteger(changeSetCount) || changeSetCount < 0) {
    throw new AiValidationError('changeSetCount must be a non-negative integer.');
  }

  return {
    sessionId: sessionId !== undefined ? Math.floor(sessionId) : undefined,
    proposalId,
    changeSetCount: Math.floor(changeSetCount),
  };
};

const CHAT_LATENCY_ACTIVITY_KINDS = new Set<AgentChatLatencyRequest['activityKind']>([
  'user_echo',
  'thinking',
  'tool_start',
  'turn_profile',
  'request_routing',
]);

export const normalizeAgentChatLatencyRequest = (input: unknown): AgentChatLatencyRequest => {
  if (!isRecord(input)) {
    throw new AiValidationError('Agent chat latency request must be an object.');
  }

  const sessionId = parseOptionalNumber(input.sessionId);
  if (sessionId !== undefined && (!Number.isInteger(sessionId) || sessionId < 1)) {
    throw new AiValidationError('sessionId must be a positive integer.');
  }

  const latencyMs = Number(input.latencyMs);
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    throw new AiValidationError('latencyMs must be a non-negative number.');
  }

  const activityKind = String(input.activityKind ?? '').trim() as AgentChatLatencyRequest['activityKind'];
  if (!CHAT_LATENCY_ACTIVITY_KINDS.has(activityKind)) {
    throw new AiValidationError('activityKind is invalid.');
  }

  return {
    sessionId: sessionId !== undefined ? Math.floor(sessionId) : undefined,
    latencyMs: Math.floor(latencyMs),
    activityKind,
  };
};

export const normalizeAgentStreamEvent = (input: unknown): AgentStreamEvent => {
  if (!isRecord(input)) {
    throw new AiValidationError('Agent stream event must be an object.');
  }

  const type = String(input.type ?? '').trim();
  switch (type) {
    case 'thinking':
      return {
        type,
        status: String(input.status ?? '').trim() || 'working',
      };
    case 'turn_profile': {
      const profile = String(input.profile ?? '').trim();
      const allowed = new Set(['ask_lookup', 'plan_authoring', 'agent_lookup', 'agent_plan_review', 'agent_implement', 'agent_implement_governed']);
      if (!allowed.has(profile)) {
        throw new AiValidationError('turn_profile.profile is invalid.');
      }
      return {
        type: 'turn_profile',
        profile: profile as AgentStreamTurnProfileEvent['profile'],
        label: String(input.label ?? '').trim() || 'Working',
      };
    }
    case 'request_routing': {
      const requestClass = String(input.requestClass ?? '').trim();
      const allowedClasses = new Set([
        'CONVERSATION',
        'CONTEXT_QUERY',
        'TOOL_QUERY',
        'OPERATIONAL_ACTION',
        'ENGINEERING_QUERY',
        'ENGINEERING_CHANGE',
      ]);
      if (!allowedClasses.has(requestClass)) {
        throw new AiValidationError('request_routing.requestClass is invalid.');
      }
      const taskProfile = String(input.taskProfile ?? '').trim();
      if (!taskProfile) {
        throw new AiValidationError('request_routing.taskProfile is required.');
      }
      return {
        type: 'request_routing',
        requestClass: requestClass as AgentStreamRequestRoutingEvent['requestClass'],
        taskProfile: taskProfile as AgentStreamRequestRoutingEvent['taskProfile'],
        routerVersion: String(input.routerVersion ?? '').trim() || '1.0.0',
        routingReason: String(input.routingReason ?? '').trim() || 'Routed',
        useEngineeringPipeline: input.useEngineeringPipeline === true,
        applicationScopeKey: typeof input.applicationScopeKey === 'string' && input.applicationScopeKey.trim()
          ? input.applicationScopeKey.trim()
          : undefined,
        applicationScopeKind: typeof input.applicationScopeKind === 'string'
          && ['platform', 'package', 'vertical_app'].includes(input.applicationScopeKind)
          ? input.applicationScopeKind as AgentStreamRequestRoutingEvent['applicationScopeKind']
          : undefined,
        contextPackId: typeof input.contextPackId === 'string' && input.contextPackId.trim()
          ? input.contextPackId.trim()
          : undefined,
        contextPackTargetCount: typeof input.contextPackTargetCount === 'number'
          && Number.isFinite(input.contextPackTargetCount)
          ? Math.max(0, Math.floor(input.contextPackTargetCount))
          : undefined,
        contextPackStandardsCount: typeof input.contextPackStandardsCount === 'number'
          && Number.isFinite(input.contextPackStandardsCount)
          ? Math.max(0, Math.floor(input.contextPackStandardsCount))
          : undefined,
      };
    }
    case 'engineering_pipeline': {
      const planId = String(input.planId ?? '').trim();
      if (!planId) {
        throw new AiValidationError('engineering_pipeline.planId is required.');
      }
      return {
        type: 'engineering_pipeline',
        planId,
        planRevision: typeof input.planRevision === 'number' && Number.isFinite(input.planRevision)
          ? Math.max(1, Math.floor(input.planRevision))
          : 1,
        planObjective: String(input.planObjective ?? '').trim() || 'Engineering change',
        artifactCount: typeof input.artifactCount === 'number' && Number.isFinite(input.artifactCount)
          ? Math.max(0, Math.floor(input.artifactCount))
          : 0,
        capabilityGapCount: typeof input.capabilityGapCount === 'number' && Number.isFinite(input.capabilityGapCount)
          ? Math.max(0, Math.floor(input.capabilityGapCount))
          : 0,
        changeGraphId: String(input.changeGraphId ?? '').trim() || 'cg:unknown',
        changeNodeCount: typeof input.changeNodeCount === 'number' && Number.isFinite(input.changeNodeCount)
          ? Math.max(0, Math.floor(input.changeNodeCount))
          : 0,
        changeSetId: typeof input.changeSetId === 'string' && input.changeSetId.trim()
          ? input.changeSetId.trim()
          : undefined,
        contextPackRevision: typeof input.contextPackRevision === 'number' && Number.isFinite(input.contextPackRevision)
          ? Math.max(1, Math.floor(input.contextPackRevision))
          : undefined,
        approvalBindingId: typeof input.approvalBindingId === 'string' && input.approvalBindingId.trim()
          ? input.approvalBindingId.trim()
          : undefined,
        approvalStatus: ['pending', 'approved', 'stale', 'revoked'].includes(String(input.approvalStatus))
          ? input.approvalStatus as 'pending' | 'approved' | 'stale' | 'revoked'
          : undefined,
        workspaceId: typeof input.workspaceId === 'string' && input.workspaceId.trim()
          ? input.workspaceId.trim()
          : undefined,
        revisionId: typeof input.revisionId === 'string' && input.revisionId.trim()
          ? input.revisionId.trim()
          : undefined,
        executedNodeCount: typeof input.executedNodeCount === 'number' && Number.isFinite(input.executedNodeCount)
          ? Math.max(0, Math.floor(input.executedNodeCount))
          : 0,
        failedNodeCount: typeof input.failedNodeCount === 'number' && Number.isFinite(input.failedNodeCount)
          ? Math.max(0, Math.floor(input.failedNodeCount))
          : 0,
        reconciledNodeCount: typeof input.reconciledNodeCount === 'number' && Number.isFinite(input.reconciledNodeCount)
          ? Math.max(0, Math.floor(input.reconciledNodeCount))
          : undefined,
        verificationRunId: typeof input.verificationRunId === 'string' && input.verificationRunId.trim()
          ? input.verificationRunId.trim()
          : undefined,
        deployable: typeof input.deployable === 'boolean' ? input.deployable : undefined,
        verificationPassCount: typeof input.verificationPassCount === 'number' && Number.isFinite(input.verificationPassCount)
          ? Math.max(0, Math.floor(input.verificationPassCount))
          : undefined,
        verificationFailCount: typeof input.verificationFailCount === 'number' && Number.isFinite(input.verificationFailCount)
          ? Math.max(0, Math.floor(input.verificationFailCount))
          : undefined,
        promotionRunId: typeof input.promotionRunId === 'string' && input.promotionRunId.trim()
          ? input.promotionRunId.trim()
          : undefined,
        promotionState: [
          'PENDING', 'PREFLIGHT', 'CHECKPOINT', 'STAGING', 'PROMOTING', 'DEPLOYED', 'FAILED', 'ROLLED_BACK',
        ].includes(String(input.promotionState))
          ? input.promotionState as AgentStreamEngineeringPipelineEvent['promotionState']
          : undefined,
        promotionPreflightOk: typeof input.promotionPreflightOk === 'boolean'
          ? input.promotionPreflightOk
          : undefined,
        packageSnapshotId: typeof input.packageSnapshotId === 'string' && input.packageSnapshotId.trim()
          ? input.packageSnapshotId.trim()
          : undefined,
        packageRoundtripValidated: typeof input.packageRoundtripValidated === 'boolean'
          ? input.packageRoundtripValidated
          : undefined,
        runtimeActivatedCount: typeof input.runtimeActivatedCount === 'number'
          && Number.isFinite(input.runtimeActivatedCount)
          ? Math.max(0, Math.floor(input.runtimeActivatedCount))
          : undefined,
        runtimeActivationFailedCount: typeof input.runtimeActivationFailedCount === 'number'
          && Number.isFinite(input.runtimeActivationFailedCount)
          ? Math.max(0, Math.floor(input.runtimeActivationFailedCount))
          : undefined,
        checkpointId: typeof input.checkpointId === 'string' && input.checkpointId.trim()
          ? input.checkpointId.trim()
          : undefined,
        revisionFingerprint: typeof input.revisionFingerprint === 'string' && input.revisionFingerprint.trim()
          ? input.revisionFingerprint.trim()
          : undefined,
        mutationPathCount: typeof input.mutationPathCount === 'number'
          && Number.isFinite(input.mutationPathCount)
          ? Math.max(0, Math.floor(input.mutationPathCount))
          : undefined,
        mutationPathPreview: Array.isArray(input.mutationPathPreview)
          ? input.mutationPathPreview
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map((item) => item.trim())
            .slice(0, 5)
          : undefined,
        workspaceStorageKind: ['git_worktree', 'git_branch', 'isolated_path'].includes(String(input.workspaceStorageKind))
          ? input.workspaceStorageKind as 'git_worktree' | 'git_branch' | 'isolated_path'
          : undefined,
        verifiedNodeCount: typeof input.verifiedNodeCount === 'number'
          && Number.isFinite(input.verifiedNodeCount)
          ? Math.max(0, Math.floor(input.verifiedNodeCount))
          : undefined,
        revisionNumber: typeof input.revisionNumber === 'number'
          && Number.isFinite(input.revisionNumber)
          ? Math.max(1, Math.floor(input.revisionNumber))
          : undefined,
        parentRevisionId: typeof input.parentRevisionId === 'string' && input.parentRevisionId.trim()
          ? input.parentRevisionId.trim()
          : undefined,
        workspaceState: ['OPEN', 'FROZEN_FOR_VERIFICATION', 'VERIFIED', 'FAILED', 'DISCARDED'].includes(String(input.workspaceState))
          ? input.workspaceState as AgentStreamEngineeringPipelineEvent['workspaceState']
          : undefined,
        revisionState: ['OPEN', 'FROZEN_FOR_VERIFICATION', 'VERIFIED', 'FAILED'].includes(String(input.revisionState))
          ? input.revisionState as AgentStreamEngineeringPipelineEvent['revisionState']
          : undefined,
        workspaceLineageLabel: typeof input.workspaceLineageLabel === 'string' && input.workspaceLineageLabel.trim()
          ? input.workspaceLineageLabel.trim()
          : undefined,
        failedRevisionId: typeof input.failedRevisionId === 'string' && input.failedRevisionId.trim()
          ? input.failedRevisionId.trim()
          : undefined,
        repairRevisionId: typeof input.repairRevisionId === 'string' && input.repairRevisionId.trim()
          ? input.repairRevisionId.trim()
          : undefined,
        repairRevisionNumber: typeof input.repairRevisionNumber === 'number'
          && Number.isFinite(input.repairRevisionNumber)
          ? Math.max(1, Math.floor(input.repairRevisionNumber))
          : undefined,
        repairReExecuted: input.repairReExecuted === true ? true : undefined,
        designerHandoff: Array.isArray(input.designerHandoff)
          ? input.designerHandoff
            .map((item) => {
              if (!item || typeof item !== 'object') return null;
              const layoutId = typeof (item as { layoutId?: unknown }).layoutId === 'string'
                ? (item as { layoutId: string }).layoutId.trim()
                : '';
              const name = typeof (item as { name?: unknown }).name === 'string'
                ? (item as { name: string }).name.trim()
                : '';
              if (!layoutId || !name) return null;
              const componentPath = typeof (item as { componentPath?: unknown }).componentPath === 'string'
                ? (item as { componentPath: string }).componentPath.trim()
                : undefined;
              return { layoutId, name, componentPath };
            })
            .filter((item): item is { layoutId: string; name: string; componentPath?: string } => Boolean(item))
          : undefined,
        requiresApproval: input.requiresApproval !== false,
      };
    }
    case 'tool_start': {
      const toolCallId = String(input.toolCallId ?? '').trim();
      const name = String(input.name ?? '').trim();
      const activityTitle = typeof input.activityTitle === 'string' && input.activityTitle.trim()
        ? input.activityTitle.trim()
        : undefined;
      const intention = typeof input.intention === 'string' && input.intention.trim()
        ? input.intention.trim()
        : undefined;
      const reasonCodeRaw = typeof input.reasonCode === 'string' ? input.reasonCode.trim() : '';
      const reasonCode = reasonCodeRaw === 'AUTO_ALLOWED' || reasonCodeRaw === 'HARNESS_BLOCKED'
        ? reasonCodeRaw
        : undefined;
      return {
        type,
        toolCallId,
        name,
        args: isRecord(input.args) ? input.args : {},
        activityTitle,
        intention,
        reasonCode,
      };
    }
    case 'tool_result':
      return {
        type,
        toolCallId: String(input.toolCallId ?? '').trim(),
        result: normalizeToolResult(input.result),
      };
    case 'text_delta':
      return {
        type,
        text: String(input.text ?? ''),
      };
    case 'change_plan':
    case 'plan':
      return {
        type: 'change_plan',
        plan: normalizeAgentPlanPayload(input.plan),
      };
    case 'task_decomposition':
      return {
        type: 'task_decomposition',
        decomposition: normalizePromptTaskDecompositionPayload(input.decomposition),
      };
    case 'plan_doc_updated': {
      const path = String(input.path ?? '').trim();
      if (!path) {
        throw new AiValidationError('plan_doc_updated event requires path.');
      }
      const revision = typeof input.revision === 'string' && input.revision.trim()
        ? input.revision.trim()
        : undefined;
      return { type: 'plan_doc_updated', path, revision };
    }
    case 'proposal': {
      const changeSets = Array.isArray(input.changeSets)
        ? input.changeSets.map((changeSet, index) => normalizeChangeSet(changeSet, index))
        : [];
      const proposalId = String(input.proposalId ?? '').trim();
      if (!proposalId) {
        throw new AiValidationError('proposal event requires proposalId.');
      }
      return { type, proposalId, changeSets };
    }
    case 'validation_result': {
      const proposalId = String(input.proposalId ?? '').trim();
      if (!proposalId) {
        throw new AiValidationError('validation_result event requires proposalId.');
      }
      const violations = Array.isArray(input.violations)
        ? input.violations.map((violation, index) => normalizeProposalViolation(violation, index))
        : [];
      return {
        type,
        proposalId,
        ok: input.ok === true,
        violations,
      };
    }
    case 'mcp_warning': {
      const serverId = String(input.serverId ?? '').trim();
      const serverLabel = String(input.serverLabel ?? '').trim();
      const message = String(input.message ?? '').trim();
      if (!serverId || !message) {
        throw new AiValidationError('mcp_warning event requires serverId and message.');
      }
      return {
        type,
        serverId,
        serverLabel: serverLabel || serverId,
        message,
      };
    }
    case 'iteration_limit':
      return {
        type,
        message: String(input.message ?? '').trim() || 'Iteration limit reached.',
        canContinue: input.canContinue !== false,
        iterationCount: Math.max(0, Math.floor(Number(input.iterationCount ?? 0))),
      };
    case 'clarifying_question': {
      const question = String(input.question ?? '').trim();
      if (!question) {
        throw new AiValidationError('clarifying_question.question is required.');
      }
      const options = Array.isArray(input.options)
        ? input.options.map((item) => String(item ?? '').trim()).filter(Boolean)
        : undefined;
      const reason = typeof input.reason === 'string' && input.reason.trim()
        ? input.reason.trim()
        : undefined;
      return {
        type: 'clarifying_question',
        question,
        options: options?.length ? options : undefined,
        reason,
      };
    }
    case 'activity_note': {
      const noteKind = String(input.noteKind ?? '').trim();
      if (noteKind !== 'scaffold_seed' && noteKind !== 'context_compression' && noteKind !== 'reverse_audit') {
        throw new AiValidationError('activity_note.noteKind is invalid.');
      }
      const title = String(input.title ?? '').trim();
      if (!title) {
        throw new AiValidationError('activity_note.title is required.');
      }
      const detail = typeof input.detail === 'string' && input.detail.trim()
        ? input.detail.trim()
        : undefined;
      return {
        type: 'activity_note',
        noteKind,
        title,
        detail,
      };
    }
    case 'agent_repair': {
      const activityTitle = String(input.activityTitle ?? '').trim();
      if (!activityTitle) {
        throw new AiValidationError('agent_repair.activityTitle is required.');
      }
      const violations = Array.isArray(input.violations)
        ? input.violations.map((item) => normalizeProposalViolation(item))
        : [];
      const intention = typeof input.intention === 'string' && input.intention.trim()
        ? input.intention.trim()
        : undefined;
      const detail = typeof input.detail === 'string' && input.detail.trim()
        ? input.detail.trim()
        : undefined;
      return {
        type: 'agent_repair',
        activityTitle,
        intention,
        detail,
        violations,
      };
    }
    case 'todo_update': {
      const todos = Array.isArray(input.todos)
        ? input.todos.map((item, index) => {
          if (!isRecord(item)) {
            throw new AiValidationError(`todo_update.todos[${index}] must be an object.`);
          }
          const id = String(item.id ?? '').trim();
          const title = String(item.title ?? '').trim();
          const status = String(item.status ?? 'pending').trim();
          if (!id || !title) {
            throw new AiValidationError(`todo_update.todos[${index}] requires id and title.`);
          }
          if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
            throw new AiValidationError(`todo_update.todos[${index}].status is invalid.`);
          }
          return {
            id,
            title,
            status: status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
          };
        })
        : [];
      if (!todos.length) {
        throw new AiValidationError('todo_update.todos must be a non-empty array.');
      }
      return { type: 'todo_update', todos };
    }
    case 'done':
      return {
        type,
        text: String(input.text ?? ''),
        modelId: String(input.modelId ?? '').trim(),
        iterationCount: Math.max(0, Math.floor(Number(input.iterationCount ?? 0))),
        sessionId: parseOptionalNumber(input.sessionId) !== undefined
          ? Math.floor(Number(input.sessionId))
          : undefined,
        tokensEstimate: parseOptionalNumber(input.tokensEstimate) !== undefined
          ? Math.floor(Number(input.tokensEstimate))
          : undefined,
        tokensBudget: parseOptionalNumber(input.tokensBudget) !== undefined
          ? Math.floor(Number(input.tokensBudget))
          : undefined,
        retrievalOperationCount: parseOptionalNumber(input.retrievalOperationCount) !== undefined
          ? Math.floor(Number(input.retrievalOperationCount))
          : undefined,
        draftToolCount: parseOptionalNumber(input.draftToolCount) !== undefined
          ? Math.floor(Number(input.draftToolCount))
          : undefined,
      };
    case 'error':
      return {
        type,
        error: String(input.error ?? '').trim() || 'Unknown agent error.',
      };
    default:
      throw new AiValidationError(`Unknown agent stream event type "${type || '(empty)'}".`);
  }
};
