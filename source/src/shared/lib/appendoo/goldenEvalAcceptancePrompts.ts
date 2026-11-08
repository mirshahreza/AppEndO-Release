import { shouldBuildSegmentHistorySummary } from '../../../core/ai/agent/historySegmentSummary';
import { AgentImplementGate } from '../../../core/ai/agent/agentImplementGate';
import { ASK_CLARIFYING_QUESTION_TOOL_NAME } from '../../../core/ai/tools/native/askClarifyingQuestion';
import { ToolRegistry } from '../../../core/ai/tools/ToolRegistry';
import { validateProposal } from '../../../core/ai/validation/proposalValidator';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../shared/api/contracts/ai/constants';
import { normalizeAgentStreamEvent } from '../../../shared/api/contracts/ai/agentValidators';
import type { ChangeSet } from '../../../shared/api/contracts/ai/agentTypes';
import { routeAssistantRequest } from '../../../server/domain/ai/assistantRequestRouter';
import { registerBuiltinCapabilityPacks } from '../../../server/services/ai/mcp/builtin';
import { getChangeSetArtifactPreview, getChangeSetDisplayLabel } from '../changeSetPreview';
import { isV1DirectWriteBlocked, shouldBlockV1ProposalForEngineering } from './appendooCutover';
import { resolveAppendooEngineeringExecutionPath } from './appendooV1EngineeringGuard';
import { buildSemanticPlanFromChangeSets } from './semanticPlanFromChangeSets';
import { mergeGovernedStructuredIntent } from '../../../server/domain/ai/llmIntentClassifier';
import { isPromotionApprovalBinding } from './engineeringPipelineApprovalUi';
import { engineeringPipelineService } from '../../../server/services/appendoo/engineeringPipeline.service';
import { runGeAgentWf4_001OrchestratorScenario } from './goldenEvalAgentLoopE2e';
import {
  dequeueSubmitTurn,
  resolveChatSubmitDispatch,
} from './chatSubmitQueue';
import { isPerceivedLatencyWithinTarget } from './chatPerceivedLatencyTelemetry';

export type GoldenAcceptancePromptResult = {
  promptNumber: number;
  scenarioId: string;
  passed: boolean;
  failures: string[];
  automated: boolean;
};

const gateResult = (
  promptNumber: number,
  scenarioId: string,
  passed: boolean,
  failures: string[],
): GoldenAcceptancePromptResult => ({
  promptNumber,
  scenarioId,
  passed,
  failures,
  automated: true,
});

const multiFileChangeSets = (): ChangeSet[] => ([
  {
    id: 'cs-fn-a',
    kind: 'function_source_patch',
    title: 'Server function: Validate A',
    functionId: 'validate-a',
    patch: {
      name: 'Validate A',
      folder: 'api',
      source: 'export async function handler() { return { ok: true }; }\n',
    },
  },
  {
    id: 'cs-fn-b',
    kind: 'function_source_patch',
    title: 'Server function: Validate B',
    functionId: 'validate-b',
    patch: {
      name: 'Validate B',
      folder: 'api',
      source: 'export async function handler() { return { ok: false }; }\n',
    },
  },
  {
    id: 'cs-file-c',
    kind: 'file_patch',
    title: 'File patch: src/shared/validate-c.ts',
    path: 'src/shared/validate-c.ts',
    beforeContent: 'export const validate = () => true;\n',
    content: 'export const validate = () => false;\n',
  },
]);

/** Automated infrastructure gates for section 13.2 — qualitative UI smoke remains in p-72-ai-backlog section 5 (MQA-15). */
export const evaluateAutomatedAcceptancePromptGates = async (): Promise<GoldenAcceptancePromptResult[]> => {
  const results: GoldenAcceptancePromptResult[] = [];

  const wf4 = await runGeAgentWf4_001OrchestratorScenario();
  results.push(gateResult(
    1,
    'MQA15-PROMPT-001',
    wf4.passed,
    wf4.failures,
  ));

  const registry = new ToolRegistry({
    mode: 'agent',
    allowedGroups: ['read', 'search', 'context', 'draft', 'standards', 'files', 'server-functions', 'git', 'designer'],
  });
  registerBuiltinCapabilityPacks(registry, ['appendo-context']);
  const toolNames = registry.listDefinitions().map((tool) => tool.name);
  results.push(gateResult(
    2,
    'MQA15-PROMPT-002',
    toolNames.includes(ASK_CLARIFYING_QUESTION_TOOL_NAME),
    toolNames.includes(ASK_CLARIFYING_QUESTION_TOOL_NAME)
      ? []
      : ['ask_clarifying_question native tool is not registered.'],
  ));

  const perFileLabels = multiFileChangeSets().map((changeSet) => getChangeSetDisplayLabel(changeSet));
  const perFileStats = multiFileChangeSets().map((changeSet) => getChangeSetArtifactPreview(changeSet).stats);
  const perFileOk = new Set(perFileLabels).size === 3
    && perFileStats.every((stats) => stats.insertions + stats.deletions > 0);
  results.push(gateResult(
    3,
    'MQA15-PROMPT-003',
    perFileOk,
    perFileOk ? [] : ['Proposal preview must expose distinct per-file cards with line stats.'],
  ));

  const planGate = new AgentImplementGate(
    'agent_plan_review',
    undefined,
    'Just review what changes are needed',
  );
  const planReviewOk = !planGate.checkPreToolUse('draft_component_layout').allowed
    && planGate.checkPreToolUse('read_file').allowed;
  results.push(gateResult(
    4,
    'MQA15-PROMPT-004',
    planReviewOk,
    planReviewOk ? [] : ['agent_plan_review must block draft_* and allow retrieve tools.'],
  ));

  const governedPrompt = 'Export this function and add it to package X — with architect approval';
  const governedRouting = routeAssistantRequest({
    mode: 'agent',
    executionProfile: 'agent_implement',
    pageContext: {},
    userPrompt: governedPrompt,
  });
  // p-63 — v1 blocking follows the (reopened) write-block policy; the gate checks routing plus
  // policy consistency, not an unconditional block.
  const governedOk = governedRouting.useEngineeringPipeline === true
    && shouldBlockV1ProposalForEngineering(true) === isV1DirectWriteBlocked();
  results.push(gateResult(
    5,
    'MQA15-PROMPT-005',
    governedOk,
    governedOk ? [] : ['Governed prompt must route to engineering pipeline; v1 blocking must match write-block policy.'],
  ));

  const longConversation = Array.from({ length: 16 }, (_, index) => ([
    { role: 'user' as const, content: `turn ${index}` },
    { role: 'assistant' as const, content: `reply ${index}` },
  ])).flat();
  // p-61 Phase C — compaction is token-pressure-driven: message count alone must NOT trigger
  // a summary (flat history is the default); real pressure against the budget must.
  const summarizeOk = DEFAULT_AI_AGENT_SETTINGS.contextSummarizeWithLlm === true
    && !shouldBuildSegmentHistorySummary(longConversation, {
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    })
    && shouldBuildSegmentHistorySummary(longConversation, {
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    }, { tokensEstimate: 150_000, tokensBudget: 200_000 });
  results.push(gateResult(
    6,
    'MQA15-PROMPT-006',
    summarizeOk,
    summarizeOk ? [] : ['Compaction must trigger on token pressure (and only on token pressure) when contextSummarizeWithLlm is on.'],
  ));

  const checkboxValidation = validateProposal([
    {
      id: 'cs-checkbox',
      kind: 'file_patch',
      title: 'Checkbox patch',
      path: 'src/features/example/ExampleToggle.tsx',
      content: '<input type="checkbox" checked />',
    },
  ]);
  const checkboxOk = !checkboxValidation.ok
    && checkboxValidation.violations.some((violation) => violation.ruleId === 'ui.checkbox.use-uicheckbox'
      && violation.message.includes('UiCheckbox'));
  results.push(gateResult(
    7,
    'MQA15-PROMPT-007',
    checkboxOk,
    checkboxOk ? [] : ['Native checkbox drafts must fail standards validation with UiCheckbox guidance.'],
  ));

  const iterationLimit = normalizeAgentStreamEvent({
    type: 'iteration_limit',
    message: 'Reached the step limit for this turn. Say "continue" if you want me to keep going.',
    canContinue: true,
    iterationCount: 12,
  });
  const iterationOk = iterationLimit.type === 'iteration_limit'
    && iterationLimit.canContinue === true
    && iterationLimit.message.includes('continue');
  results.push(gateResult(
    8,
    'MQA15-PROMPT-008',
    iterationOk,
    iterationOk ? [] : ['Iteration limit stream event must offer a respectful continue prompt.'],
  ));

  const queueOk = resolveChatSubmitDispatch(true) === 'queue'
    && dequeueSubmitTurn([{ id: 'turn-1' }]).turn?.id === 'turn-1'
    && isPerceivedLatencyWithinTarget(16);
  results.push(gateResult(
    9,
    'MQA15-PROMPT-009',
    queueOk,
    queueOk ? [] : ['Busy submit must queue turns and immediate echo latency must stay under target.'],
  ));

  return results;
};

/** V4-PATCH-5 governance gates + DoD deadlock probe. */
export const evaluateV4Patch5GovernanceGates = (): GoldenAcceptancePromptResult[] => {
  const reversePlan = buildSemanticPlanFromChangeSets({
    changeSets: multiFileChangeSets(),
    userPrompt: 'reverse audit',
  });
  const p51Ok = reversePlan?.producer === 'reverse_audit'
    && (reversePlan?.proposedArtifacts.length ?? 0) >= 2;

  const governedMergeOk = mergeGovernedStructuredIntent(null, { governed: true }) === 'governed_engineering'
    && mergeGovernedStructuredIntent('engineering_change', { governed: false }) === 'engineering_change';

  const promotionApiOk = isPromotionApprovalBinding('promo-approval:test')
    && typeof engineeringPipelineService.executeApprovedPromotion === 'function';

  const agentLoopOpen = !shouldBlockV1ProposalForEngineering(false);
  // p-63 — the pipeline-routed v1 block must track the write-block policy (which the PO
  // reopened on 2026-07-18), not be asserted as unconditionally on.
  const governedConsistent = shouldBlockV1ProposalForEngineering(true) === isV1DirectWriteBlocked();
  const normalPath = resolveAppendooEngineeringExecutionPath({ useEngineeringPipeline: false });
  const deadlockOk = agentLoopOpen && governedConsistent && normalPath === 'v1_legacy_test_only';

  return [
    gateResult(0, 'V4-P5.1-REVERSE-ASP', p51Ok, p51Ok ? [] : ['Reverse ASP from ChangeSets failed.']),
    gateResult(0, 'V4-P5.2-PROMOTION-GATE', promotionApiOk, promotionApiOk ? [] : ['executeApprovedPromotion missing.']),
    gateResult(0, 'V4-P5.3-STRUCTURED-INTENT', governedMergeOk, governedMergeOk ? [] : ['Governed structured intent merge failed.']),
    gateResult(0, 'V4-DOD-NO-DEADLOCK', deadlockOk, deadlockOk ? [] : ['Agent-loop and governed v1 block deadlock regression.']),
  ];
};

export const probeV4Patch5GovernanceHealth = (): { ok: boolean; failures: string[] } => {
  const results = evaluateV4Patch5GovernanceGates();
  const failures = results
    .filter((result) => !result.passed)
    .flatMap((result) => result.failures.map((failure) => `${result.scenarioId}: ${failure}`));
  return { ok: failures.length === 0, failures };
};

export const probeAutomatedAcceptancePromptHealth = async (): Promise<{
  ok: boolean;
  failures: string[];
}> => {
  const results = await evaluateAutomatedAcceptancePromptGates();
  const failures = results
    .filter((result) => !result.passed)
    .flatMap((result) => result.failures.map((failure) => `#${result.promptNumber}: ${failure}`));
  return { ok: failures.length === 0, failures };
};
