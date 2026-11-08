import type { NativeToolDefinition } from '../ToolRegistry';
import { createPhase1ToolRegistry } from '../ToolRegistry';
import { searchCodebaseTool } from './searchCodebase';
import { getFeatureGraphTool } from './getFeatureGraph';
import { readFileTool } from './readFile';
import { listDirTool } from './listDir';
import { globFilesTool } from './globFiles';
import { getProjectStandardsTool } from './getProjectStandards';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import type { AgentMessage } from '../../agent/types';

export const DELEGATE_RESEARCH_TOOL_NAME = 'delegate_research';

/**
 * p-98 §2.7 — subagent delegation. Runs an isolated, read-only nested AgentOrchestrator instead
 * of making the caller do its own multi-step search/read chain inline. Recursion is prevented
 * structurally, not by a counter: the nested run is hard-locked to mode 'ask', and ToolRegistry's
 * ASK_ALLOWED_GROUPS (not the caller-supplied allowedGroups) deliberately excludes the 'delegate'
 * group — so delegate_research is never registered/visible/callable inside its own nested run.
 *
 * `aiManager`/`AgentOrchestrator` are dynamic imports: `AgentOrchestrator.ts` imports `aiManager`,
 * which imports `registerNativeTools.ts`, which registers this tool — a static import here would
 * be a real module cycle, not just a stylistic one (same reason draftServerFunction.ts dynamic-
 * imports its own server-layer dependency).
 */
export const executeDelegateResearch = async (
  args: Record<string, unknown>,
  context?: { modelId?: string },
) => {
  const task = typeof args.task === 'string' ? args.task.trim() : '';
  if (!task) {
    return { ok: false as const, summary: 'A research task/question is required.', error: 'missing_task' };
  }

  const { aiManager } = await import('../../AiManager');
  const { AgentOrchestrator } = await import('../../agent/AgentOrchestrator');

  const modelId = context?.modelId ?? aiManager.getSettings()?.defaultModelId;
  let provider;
  try {
    ({ provider } = aiManager.resolveModel(modelId));
  } catch (error) {
    return {
      ok: false as const,
      summary: 'No usable AI model is configured for delegated research.',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const registry = createPhase1ToolRegistry('ask', []);
  registry.register(searchCodebaseTool);
  registry.register(getFeatureGraphTool);
  registry.register(readFileTool);
  registry.register(listDirTool);
  registry.register(globFilesTool);
  registry.register(getProjectStandardsTool);

  const baseAgentSettings = aiManager.getSettings()?.agent ?? DEFAULT_AI_AGENT_SETTINGS;
  const agentSettings = {
    ...baseAgentSettings,
    // Cost cap independent of the parent's own budget — a delegated research task should stay
    // cheap regardless of what the parent's own settings allow.
    maxIterationsAsk: Math.min(baseAgentSettings.maxIterationsAsk ?? 8, 6),
  };

  const orchestrator = new AgentOrchestrator({ provider, modelId, toolRegistry: registry });
  const messages: AgentMessage[] = [{ role: 'user', content: task }];

  const result = await orchestrator.run(messages, {
    mode: 'ask',
    executionProfile: 'ask_lookup',
    agentSettings,
  });

  const findings = result.text?.trim() ?? '';
  const toolCallCount = result.traces.filter((trace) => Boolean(trace.toolName)).length;

  return {
    ok: true as const,
    summary: findings.length > 300 ? `${findings.slice(0, 300)}…` : (findings || 'No findings returned.'),
    data: {
      findings,
      iterationCount: result.iterationCount,
      toolCallCount,
    },
  };
};

export const delegateResearchTool: NativeToolDefinition = {
  name: DELEGATE_RESEARCH_TOOL_NAME,
  description: 'Delegates a broad, multi-step investigation to an isolated read-only subagent that searches and reads the codebase on your behalf and returns only a compressed summary — use for open-ended "find everywhere X is used" or "how does Y work end-to-end" questions where doing the search yourself would burn many iterations and fill your own context. Not for a single targeted lookup — use search_codebase/read_file directly for those. The subagent cannot write/draft anything and cannot itself delegate further.',
  group: 'delegate',
  parameters: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'The exact research question, phrased so the subagent can answer it without asking you anything further' },
    },
    required: ['task'],
  },
  execute: (args, context) => executeDelegateResearch(args, context),
};
