import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import type { IAiProvider } from '../../../core/ai/IAiProvider';
import { AgentOrchestrator } from '../../../core/ai/agent/AgentOrchestrator';
import { ToolRegistry } from '../../../core/ai/tools/ToolRegistry';
import type { NativeToolDefinition } from '../../../core/ai/tools/ToolRegistry';
import { clearAgentDrafts } from '../../../core/ai/tools/native/agentDraftStore';
import { getProjectStandardsTool } from '../../../core/ai/tools/native/getProjectStandards';
import { getPageContextTool } from '../../../core/ai/tools/native/getPageContext';
import { searchCodebaseTool } from '../../../core/ai/tools/native/searchCodebase';
import { readFileTool } from '../../../core/ai/tools/native/readFile';
import { draftFilePatchTool } from '../../../core/ai/tools/native/draftFilePatch';
import { draftServerFunctionTool } from '../../../core/ai/tools/native/draftServerFunction';
import { draftComponentLayoutTool } from '../../../core/ai/tools/native/draftComponentLayout';
import { askClarifyingQuestionTool } from '../../../core/ai/tools/native/askClarifyingQuestion';
import { createServerFunctionTools } from '../../../server/services/ai/mcp/builtin/serverFunctionTools';
import { createPackagesTools } from '../../../server/services/ai/mcp/builtin/packagesTools';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../api/contracts/ai/constants';
import type { AgentStreamEvent } from '../../api/contracts/ai/agentTypes';
import type { AiPageContext } from '../../api/contracts/ai/pageContext';
import type {
  TrajectoryFixture,
  TrajectoryProviderStep,
  TrajectoryScenarioCategory,
} from '../../api/contracts/appendoo/v5BaselineTrajectory.types';

/**
 * V5 Phase P00 baseline trajectory corpus.
 *
 * EV-3 (`docs/appendoo/decision-log.md` D-007) means no live model can be called in this
 * environment right now, so every scenario here runs the REAL `AgentOrchestrator.run()` and
 * REAL tools (real file reads, real managed-function sandbox execution, real search) against a
 * SCRIPTED/mock model provider (`createSequentialProvider`, same primitive already used by
 * `goldenEvalAgentLoopE2e.ts`). Only two tool calls in the whole corpus are stubbed
 * (`run_tests` in `repeated_test_failure`) because the real tool shells out to a full vitest
 * subprocess, which is unsafe to nest inside the test runner itself — see inline comment there.
 *
 * This is NOT a substitute for live-model baseline capture. See
 * `MUST-REVALIDATE-WITH-REAL-MODEL.md`.
 */

const DEBT_REF = 'plans/core/next/p-72-ai-backlog.md';

type ProviderStep = TrajectoryProviderStep;

export const createSequentialProvider = (steps: ProviderStep[]): IAiProvider => {
  let callIndex = 0;
  return {
    getProviderName: () => 'mock',
    chat: async () => 'mock-decomposition',
    chatWithTools: async () => {
      const step = steps[callIndex] ?? steps[steps.length - 1] ?? { text: 'Done.' };
      callIndex += 1;
      return step;
    },
  };
};

/** Deterministic stub — the only non-real tool in the corpus. See module doc comment. */
const createStubRunTestsTool = (failCount: number): NativeToolDefinition => {
  let calls = 0;
  return {
    name: 'run_tests',
    description: 'Stubbed for V5 baseline determinism — real run_tests shells out to a vitest subprocess.',
    group: 'read',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      calls += 1;
      if (calls <= failCount) {
        return {
          ok: false as const,
          summary: `Test run ${calls} failed: expected clampPercentage(-5) to be 0, got -5.`,
          error: 'assertion_failed',
        };
      }
      return { ok: true as const, summary: 'All tests passed.' };
    },
  };
};

const FIXED_BUG_FIX_SOURCE = [
  '/**',
  ' * Stable, owned fixture target for V5 Phase P00 baseline trajectories (`bug_fix` scenario).',
  ' * Clamps both bounds so scripted agent trajectories have a real, deterministic fix to propose.',
  ' */',
  'export function clampPercentage(value: number): number {',
  '  if (value > 100) return 100;',
  '  if (value < 0) return 0;',
  '  return value;',
  '}',
  '',
].join('\n');

const PERMISSION_PATCH_SOURCE = [
  '/**',
  ' * Stable, owned fixture target for V5 Phase P00 baseline trajectories (`permission_change`',
  ' * scenario). Not wired into any real authorization path — a minimal, isolated target so a',
  ' * scripted agent trajectory can propose a real `draft_file_patch` for a permission-shaped edit.',
  ' */',
  'export const REPORTS_ROLE_PERMISSIONS: Record<string, string[]> = {',
  '  admin: [\'view\', \'edit\'],',
  '  viewer: [\'view\'],',
  '  export: [\'view\'],',
  '};',
  '',
].join('\n');

const MULTI_FILE_B_SOURCE = [
  '/**',
  ' * Stable, owned fixture target for V5 Phase P00 baseline trajectories (`multi_file_feature`',
  ' * scenario, file B of 2). See `multiFileFeatureSampleA.ts` for the paired file.',
  ' */',
  'export const FEATURE_FLAG_ENABLED = true;',
  '',
].join('\n');

/**
 * `AgentOrchestrator`'s real retrieve gate (`retrieveBundle.ts`) blocks every `draft_*` tool
 * call until `get_project_standards` has been called with the workflow/playbook shard. Every
 * scenario below that drafts something includes this step before its first draft call.
 */
const STANDARDS_GATE_STEP: ProviderStep = {
  toolCalls: [{ id: 'gate', name: 'get_project_standards', args: { shard: 'vibe-coding-workflows' } }],
};

// pageKey must be a real feature-graph node (search_codebase scopes to it) — 'settings' is a
// known key (see the known-keys list surfaced by page_key_not_found in earlier runs).
const ADMIN_PAGE_CONTEXT: AiPageContext = {
  path: '/us/studio/settings',
  pageLabel: 'Settings',
  pageKey: 'settings',
};

export type BaselineTrajectoryScenario = {
  scenarioId: string;
  category: TrajectoryScenarioCategory;
  prompt: string;
  pageContext?: AiPageContext;
  steps: ProviderStep[];
  /** Registers any tool that is NOT one of the always-on base tools. */
  extraTools?: () => NativeToolDefinition[];
};

const BASE_TOOLS = (): NativeToolDefinition[] => [
  getProjectStandardsTool,
  getPageContextTool,
  searchCodebaseTool,
  readFileTool,
  draftFilePatchTool,
  draftServerFunctionTool,
  draftComponentLayoutTool,
  askClarifyingQuestionTool,
  ...createServerFunctionTools(),
  ...createPackagesTools(),
];

export const BASELINE_TRAJECTORY_SCENARIOS: BaselineTrajectoryScenario[] = [
  {
    scenarioId: 'v5-p00-simple-repository-question',
    category: 'simple_repository_question',
    prompt: 'How many Server Functions are in this project?',
    steps: [
      { toolCalls: [{ id: 'c1', name: 'list_server_functions', args: {} }] },
      { text: 'Based on the list, this is how many Server Functions are registered in the project.' },
    ],
  },
  {
    scenarioId: 'v5-p00-bug-fix',
    category: 'bug_fix',
    prompt: 'The clampPercentage function in src/shared/lib/appendoo/v5Baseline/bugFixSample.ts does not handle negative values correctly — please fix it.',
    steps: [
      STANDARDS_GATE_STEP,
      {
        toolCalls: [{
          id: 'c1',
          name: 'read_file',
          args: { path: 'src/shared/lib/appendoo/v5Baseline/bugFixSample.ts' },
        }],
      },
      {
        toolCalls: [{
          id: 'c2',
          name: 'draft_file_patch',
          args: { path: 'src/shared/lib/appendoo/v5Baseline/bugFixSample.ts', content: FIXED_BUG_FIX_SOURCE },
        }],
      },
      { text: 'Bug fixed: negative values are now clamped to 0.' },
    ],
  },
  {
    scenarioId: 'v5-p00-server-function-edit',
    category: 'server_function_edit',
    prompt: 'Review the math.sum-two-numbers function code and make sure non-numeric inputs are rejected.',
    steps: [
      { toolCalls: [{ id: 'c1', name: 'get_server_function', args: { functionId: 'math.sum-two-numbers' } }] },
      { toolCalls: [{ id: 'c2', name: 'test_server_function', args: { functionId: 'math.sum-two-numbers', payload: { a: 'x', b: 2 } } }] },
      { text: 'The code already rejects non-numeric inputs with a 400 error; the test confirmed the behavior is correct.' },
    ],
  },
  {
    scenarioId: 'v5-p00-server-function-to-ui',
    category: 'server_function_to_ui',
    // MQA-16 #1 verbatim (p-72-ai-backlog section 5) — non-fixture reality check per PHASE-00 doc.
    prompt: 'Build a UI for the scheduler.sample-heartbeat function',
    steps: [
      STANDARDS_GATE_STEP,
      { toolCalls: [{ id: 'c2', name: 'get_server_function', args: { functionId: 'scheduler.sample-heartbeat' } }] },
      {
        toolCalls: [{
          id: 'c3',
          name: 'draft_component_layout',
          args: {
            name: 'Sample Heartbeat',
            folder: 'scheduler',
            description: 'Generic run-button UI with raw JSON response — no input/output fields were statically detected for this function.',
          },
        }],
      },
      { text: 'Because no input/output fields were detected for this function, I built a generic UI with a run button and raw JSON response display.' },
    ],
  },
  {
    scenarioId: 'v5-p00-designer-only-change',
    category: 'designer_only_change',
    prompt: 'Build a simple settings box for the admin page in the designer tool, without changing server functions.',
    pageContext: ADMIN_PAGE_CONTEXT,
    steps: [
      STANDARDS_GATE_STEP,
      { toolCalls: [{ id: 'c1', name: 'get_page_context', args: {} }] },
      { toolCalls: [{ id: 'c1b', name: 'search_codebase', args: { query: 'admin settings panel', mode: 'hybrid' } }] },
      {
        toolCalls: [{
          id: 'c2',
          name: 'draft_component_layout',
          args: { name: 'Admin Settings Box', folder: 'admin', description: 'Simple settings panel, designer-only.' },
        }],
      },
      { text: 'Settings panel designed; no changes were made to server functions.' },
    ],
  },
  {
    scenarioId: 'v5-p00-multi-file-feature',
    category: 'multi_file_feature',
    prompt: 'Add a simple feature flag: set FEATURE_FLAG_ENABLED to true in multiFileFeatureSampleB.ts and first review multiFileFeatureSampleA.ts for consistency.',
    steps: [
      STANDARDS_GATE_STEP,
      { toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/shared/lib/appendoo/v5Baseline/multiFileFeatureSampleA.ts' } }] },
      { toolCalls: [{ id: 'c2', name: 'read_file', args: { path: 'src/shared/lib/appendoo/v5Baseline/multiFileFeatureSampleB.ts' } }] },
      {
        toolCalls: [{
          id: 'c3',
          name: 'draft_file_patch',
          args: { path: 'src/shared/lib/appendoo/v5Baseline/multiFileFeatureSampleB.ts', content: MULTI_FILE_B_SOURCE },
        }],
      },
      { text: 'FEATURE_FLAG_ENABLED is now true in file B; file A did not need changes because it only holds the label.' },
    ],
  },
  {
    scenarioId: 'v5-p00-permission-change',
    category: 'permission_change',
    prompt: 'Add an export role with view access to REPORTS_ROLE_PERMISSIONS.',
    steps: [
      STANDARDS_GATE_STEP,
      { toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/shared/lib/appendoo/v5Baseline/permissionSample.ts' } }] },
      {
        toolCalls: [{
          id: 'c2',
          name: 'draft_file_patch',
          args: { path: 'src/shared/lib/appendoo/v5Baseline/permissionSample.ts', content: PERMISSION_PATCH_SOURCE },
        }],
      },
      { text: 'Added export role with view access.' },
    ],
  },
  {
    scenarioId: 'v5-p00-package-capability-request',
    category: 'package_capability_request',
    prompt: 'Is a reporting package installed? If so, tell me the details.',
    steps: [
      { toolCalls: [{ id: 'c1', name: 'list_packages', args: {} }] },
      { text: 'Based on installed packages in the current environment, here is the result.' },
    ],
  },
  {
    scenarioId: 'v5-p00-already-fixed-no-change',
    category: 'already_fixed_no_change',
    prompt: 'Make sure clampPercentage always returns 100 for values greater than 100.',
    steps: [
      { toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/shared/lib/appendoo/v5Baseline/bugFixSample.ts' } }] },
      { text: 'Code review shows this behavior is already implemented correctly; no change is needed.' },
    ],
  },
  {
    scenarioId: 'v5-p00-ambiguous-request',
    category: 'ambiguous_request',
    // MQA-16 #3 verbatim (p-72-ai-backlog section 5) — deliberately doesn't name the function.
    prompt: 'Build a form for heartbeat',
    steps: [
      { toolCalls: [{ id: 'c1', name: 'search_codebase', args: { query: 'heartbeat', mode: 'hybrid' } }] },
      {
        toolCalls: [{
          id: 'c2',
          name: 'ask_clarifying_question',
          args: {
            question: 'Which heartbeat function do you mean?',
            options: JSON.stringify(['scheduler.sample-heartbeat']),
            reason: 'Several heartbeat-related functions/files were found and the exact function name was not in the prompt.',
          },
        }],
      },
      { text: 'Waiting for the user to clarify.' },
    ],
  },
  {
    scenarioId: 'v5-p00-repeated-test-failure',
    category: 'repeated_test_failure',
    prompt: 'Write and run a test for bugFixSample.ts; if it fails, fix it until it passes.',
    steps: [
      { toolCalls: [{ id: 'c1', name: 'run_tests', args: {} }] },
      STANDARDS_GATE_STEP,
      { toolCalls: [{ id: 'c1b', name: 'read_file', args: { path: 'src/shared/lib/appendoo/v5Baseline/bugFixSample.ts' } }] },
      {
        toolCalls: [{
          id: 'c2',
          name: 'draft_file_patch',
          args: { path: 'src/shared/lib/appendoo/v5Baseline/bugFixSample.ts', content: FIXED_BUG_FIX_SOURCE },
        }],
      },
      { toolCalls: [{ id: 'c3', name: 'run_tests', args: {} }] },
      { text: 'After one failure and one fix, all tests passed.' },
    ],
    // Stub replaces the real run_tests tool below (see createStubRunTestsTool doc comment).
    extraTools: () => [createStubRunTestsTool(1)],
  },
  {
    scenarioId: 'v5-p00-context-pressure',
    category: 'context_pressure',
    prompt: 'Summarize these core agent runtime files for me: AgentOrchestrator, ToolRegistry, semanticPlanBuilder, changeSetBuilder.',
    steps: [
      { toolCalls: [{ id: 'c1', name: 'read_file', args: { path: 'src/core/ai/agent/AgentOrchestrator.ts' } }] },
      { toolCalls: [{ id: 'c2', name: 'read_file', args: { path: 'src/core/ai/tools/ToolRegistry.ts' } }] },
      { toolCalls: [{ id: 'c3', name: 'read_file', args: { path: 'src/shared/lib/appendoo/semanticPlanBuilder.ts' } }] },
      { toolCalls: [{ id: 'c4', name: 'read_file', args: { path: 'src/core/ai/validation/changeSetBuilder.ts' } }] },
      { text: 'Summary of all four files is ready.' },
    ],
  },
  {
    scenarioId: 'v5-p00-large-tool-output',
    category: 'large_tool_output',
    prompt: 'Find all TODOs in the project.',
    steps: [
      { toolCalls: [{ id: 'c1', name: 'search_codebase', args: { query: 'TODO', mode: 'exact', maxResults: 100, includeText: true } }] },
      { text: 'TODO matches are listed in the tool observation.' },
    ],
  },
];

const buildToolRegistry = (scenario: BaselineTrajectoryScenario): ToolRegistry => {
  const registry = new ToolRegistry({
    mode: 'agent',
    allowedGroups: ['standards', 'search', 'read', 'draft', 'plugins', 'data', 'context', 'git', 'openapi', 'jobs', 'edge', 'memory', 'cache'],
    executionProfile: 'agent_implement',
  });
  const tools = scenario.extraTools
    ? [...BASE_TOOLS().filter((tool) => !scenario.extraTools!().some((extra) => extra.name === tool.name)), ...scenario.extraTools()]
    : BASE_TOOLS();
  tools.forEach((tool) => registry.register(tool));
  return registry;
};

const resolveRepositoryFingerprint = (): string => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const computeTaskId = (scenarioId: string): string => (
  createHash('sha256').update(`v5-baseline:${scenarioId}`).digest('hex').slice(0, 16)
);

export const runBaselineTrajectoryScenario = async (
  scenario: BaselineTrajectoryScenario,
): Promise<TrajectoryFixture> => {
  clearAgentDrafts();
  const registry = buildToolRegistry(scenario);
  const provider = createSequentialProvider(scenario.steps);
  const orchestrator = new AgentOrchestrator({
    provider,
    modelId: 'mock-baseline-provider',
    toolRegistry: registry,
  });

  const toolOrder: string[] = [];
  const result = await orchestrator.run(
    [{ role: 'user', content: scenario.prompt }],
    {
      mode: 'agent',
      executionProfile: 'agent_implement',
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
      pageContext: scenario.pageContext,
    },
    {
      onEvent: (event: AgentStreamEvent) => {
        if (event.type === 'tool_start') {
          toolOrder.push(event.name);
        }
      },
    },
  );

  return {
    taskId: computeTaskId(scenario.scenarioId),
    scenarioId: scenario.scenarioId,
    category: scenario.category,
    repositoryFingerprint: resolveRepositoryFingerprint(),
    capturedAt: new Date().toISOString(),
    providerMode: 'mock',
    debtRef: DEBT_REF,
    prompt: scenario.prompt,
    scriptedSteps: scenario.steps,
    toolOrder,
    result: {
      text: result.text,
      modelId: result.modelId,
      iterationCount: result.iterationCount,
      traces: result.traces,
      proposalId: result.proposalId,
      changeSets: result.changeSets,
      validationOk: result.validationOk,
      validationViolations: result.validationViolations,
      retrievalOperationCount: result.retrievalOperationCount,
      draftToolCount: result.draftToolCount,
    },
  };
};

export const runAllBaselineTrajectoryScenarios = async (): Promise<TrajectoryFixture[]> => {
  const fixtures: TrajectoryFixture[] = [];
  for (const scenario of BASELINE_TRAJECTORY_SCENARIOS) {
    // eslint-disable-next-line no-await-in-loop
    fixtures.push(await runBaselineTrajectoryScenario(scenario));
  }
  return fixtures;
};
