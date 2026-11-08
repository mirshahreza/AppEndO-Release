import type { IAiProvider } from '../../../core/ai/IAiProvider';
import { AgentOrchestrator } from '../../../core/ai/agent/AgentOrchestrator';
import { ToolRegistry } from '../../../core/ai/tools/ToolRegistry';
import { clearAgentDrafts } from '../../../core/ai/tools/native/agentDraftStore';
import { draftComponentLayoutTool } from '../../../core/ai/tools/native/draftComponentLayout';
import { getProjectStandardsTool } from '../../../core/ai/tools/native/getProjectStandards';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../api/contracts/ai/constants';
import type { AgentStreamEvent } from '../../api/contracts/ai/agentTypes';
import { resolveDraftWorkflowTarget } from '../../../core/ai/agent/vibeWorkflowContext';
import {
  GE_AGENT_WF4_001_PROMPT,
  GE_AGENT_WF4_001_SCENARIO_ID,
  type GoldenAgentLoopEvalResult,
} from './goldenEvalAgentLoop';

const WF4_E2E_PAGE_CONTEXT = {
  path: '/us/studio/server-functions/math/sum-two-numbers',
  pageLabel: 'Sum Two Numbers',
  pageKey: 'server-functions',
  functionId: 'math.sum-two-numbers',
} as const;

const RETRIEVE_TOOL_NAMES = new Set([
  'search_codebase',
  'read_file',
  'glob_files',
  'list_dir',
  'get_feature_graph',
  'get_project_standards',
  'get_server_function',
  'get_page_context',
]);

const DEFAULT_MOCK_DECOMPOSITION = JSON.stringify({
  summary: 'Build a simple two-input form for math.sum-two-numbers',
  workUnits: ['Retrieve function contract', 'Draft component layout'],
  assumptions: [],
  openQuestions: [],
});

const stubReadFileTool = {
  name: 'read_file',
  description: 'Mock read for WF-4 agent E2E.',
  group: 'files' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: async () => ({ ok: true as const, summary: 'Read template file.' }),
};

const stubGetServerFunctionTool = {
  name: 'get_server_function',
  description: 'Mock retrieve for WF-4 agent E2E.',
  group: 'server-functions' as const,
  parameters: { type: 'object' as const, properties: {} },
  execute: async () => ({
    ok: true as const,
    summary: 'Loaded math.sum-two-numbers contract.',
    data: { functionId: 'math.sum-two-numbers' },
  }),
};

type ProviderStep = { toolCalls: { id: string; name: string; args: Record<string, unknown> }[] } | { text: string };

const createSequentialProvider = (steps: ProviderStep[]): IAiProvider => {
  let callIndex = 0;
  return {
    getProviderName: () => 'mock',
    chat: async () => DEFAULT_MOCK_DECOMPOSITION,
    chatWithTools: async () => {
      const step = steps[callIndex] ?? steps[steps.length - 1] ?? { text: 'Done.' };
      callIndex += 1;
      return step;
    },
  };
};

export const createDefaultWf4MockProvider = createSequentialProvider;

export type GeAgentWf4E2eRunResult = GoldenAgentLoopEvalResult & {
  retrievalOperationCount?: number;
  toolOrder?: string[];
};

export const runGeAgentWf4_001OrchestratorScenario = async (
  provider?: IAiProvider,
): Promise<GeAgentWf4E2eRunResult> => {
  const failures: string[] = [];
  clearAgentDrafts();

  const registry = new ToolRegistry({
    mode: 'agent',
    allowedGroups: ['standards', 'draft', 'files', 'server-functions'],
  });
  registry.register(getProjectStandardsTool);
  registry.register(draftComponentLayoutTool);
  registry.register(stubReadFileTool);
  registry.register(stubGetServerFunctionTool);

  const mockProvider = provider ?? createSequentialProvider([
    {
      toolCalls: [{
        id: 'call-standards',
        name: 'get_project_standards',
        args: {
          shard: resolveDraftWorkflowTarget(WF4_E2E_PAGE_CONTEXT, GE_AGENT_WF4_001_PROMPT).standardsShard,
          _intention: 'To review WF-2 contract',
        },
      }],
    },
    {
      toolCalls: [{
        id: 'call-read',
        name: 'read_file',
        args: { path: 'src/features/math/SumTwoNumbersForm.tsx', _intention: 'To review form pattern' },
      }],
    },
    {
      toolCalls: [{
        id: 'call-fn',
        name: 'get_server_function',
        args: { functionId: 'math.sum-two-numbers', _intention: 'To review function contract' },
      }],
    },
    {
      toolCalls: [{
        id: 'call-layout',
        name: 'draft_component_layout',
        args: {
          name: 'Sum Two Numbers',
          folder: 'math',
          _intention: 'To draft the two-input form',
        },
      }],
    },
    { text: 'Form draft is ready.' },
  ]);

  const toolOrder: string[] = [];
  const orchestrator = new AgentOrchestrator({
    provider: mockProvider,
    modelId: 'gemini-2-5-flash',
    toolRegistry: registry,
  });

  const result = await orchestrator.run(
    [{ role: 'user', content: GE_AGENT_WF4_001_PROMPT }],
    {
      mode: 'agent',
      executionProfile: 'agent_implement',
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      pageContext: WF4_E2E_PAGE_CONTEXT,
    },
    {
      onEvent: (event: AgentStreamEvent) => {
        if (event.type === 'tool_start') {
          toolOrder.push(event.name);
        }
      },
    },
  );

  const firstDraftIndex = toolOrder.findIndex((name) => name.startsWith('draft_'));
  if (firstDraftIndex < 0) {
    failures.push('Expected at least one draft_* tool in agent loop.');
  } else {
    const retrieveBeforeDraft = toolOrder
      .slice(0, firstDraftIndex)
      .some((name) => RETRIEVE_TOOL_NAMES.has(name));
    if (!retrieveBeforeDraft) {
      failures.push('Expected retrieve tool(s) before first draft_* (GAP-9 / P4.1).');
    }
  }

  if ((result.retrievalOperationCount ?? 0) < 1) {
    failures.push(`Expected retrievalOperationCount >= 1, got ${result.retrievalOperationCount ?? 0}.`);
  }

  if (!result.proposalId) {
    failures.push('Expected proposalId from agent finalize.');
  }

  if (!result.changeSets?.some((changeSet) => changeSet.kind === 'component_layout_patch')) {
    failures.push('Expected component_layout_patch in proposal for WF-4 UI prompt.');
  }

  if (result.validationOk === false) {
    const violationSummary = result.validationViolations
      ?.map((violation) => violation.message)
      .join(' | ') ?? 'unknown';
    failures.push(`Proposal validation must pass for E2E gate: ${violationSummary}`);
  }

  return {
    scenarioId: `${GE_AGENT_WF4_001_SCENARIO_ID}-E2E`,
    passed: failures.length === 0,
    failures,
    retrievalOperationCount: result.retrievalOperationCount,
    toolOrder,
  };
};

/** Sync health probe — true when last E2E run passed (set by vitest hook). */
let lastE2ePassed = false;

export const markGeAgentWf4E2ePassed = (passed: boolean): void => {
  lastE2ePassed = passed;
};

export const probeGeAgentWf4E2eHealth = (): { ok: boolean; reason?: string } => (
  lastE2ePassed
    ? { ok: true }
    : { ok: false, reason: 'GE-AGENT-WF4-001 orchestrator E2E has not passed in this process.' }
);
