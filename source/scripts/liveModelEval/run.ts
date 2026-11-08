/**
 * p-98 section 8 — live-model regression-eval harness. Runs the persisted scenario suite
 * (scenarios.ts) through the REAL AgentService.runStream (same code path as the HTTP
 * /api/ai/agent/run route), using the app's own configured AI Models settings — never
 * Claude Code's own model access, since the point is measuring AgentOrchestrator's real
 * behavior end to end.
 *
 * Real API calls, real cost. Run on-demand when the system prompt, orchestration logic, or
 * tool definitions change — not in CI, not in test:critical.
 *
 * Usage:
 *   npm run eval:live-model
 *   npm run eval:live-model -- --model openai-gpt-5-4
 */
import fs from 'fs';
import path from 'path';
import { initializeFullServerRuntime } from '../../src/server/bootstrapFullRuntime';
import { closeControlPlanePool } from '../../src/server/db/controlPlane';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { findAuthUserByUsername } from '../../src/server/domain/users/userRepository';
import { AgentService } from '../../src/server/services/ai/agent.service';
import { aiManager } from '../../src/core/ai/AiManager';
import type { AgentStreamEvent } from '../../src/shared/api/contracts/ai/agentTypes';
import { LIVE_EVAL_SCENARIOS, type LiveEvalScenario } from './scenarios';

type ScenarioResult = {
  id: string;
  label: string;
  modelId: string;
  ok: boolean;
  error?: string;
  durationMs: number;
  iterationCount?: number;
  tokensEstimate?: number;
  firstToolName?: string;
  firstToolMatchedExpectation?: boolean;
  toolNamesCalled: string[];
  expectedToolNamesAllCalled?: boolean;
  sawProposal: boolean;
  sawValidationResult: boolean;
  validationOk?: boolean;
  validationViolations?: { severity: string; message: string; ruleId?: string }[];
  proposalExpectationMet: boolean;
  finalText: string;
  eventCounts: Record<string, number>;
  events: AgentStreamEvent[];
};

const parseArgs = (argv: string[]) => {
  const args: { model?: string; only?: string[] } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--only') args.only = argv[++i]?.split(',').map((id) => id.trim());
  }
  return args;
};

const resolveModelId = (preferred?: string): string => {
  const settings = aiManager.getSettings();
  if (!settings) throw new Error('AI settings not loaded after bootstrap.');

  if (preferred) {
    const match = settings.models.find((model) => model.id === preferred && model.enabled);
    if (!match) throw new Error(`Requested model "${preferred}" is not enabled.`);
    return match.id;
  }

  // Prefer an enabled OpenAI GPT-5.x model (this eval round's target per p-98 section 5) —
  // fall back to the platform default if none is enabled.
  const gpt5 = settings.models.find((model) => (
    model.enabled && model.provider === 'openai' && /gpt-5/i.test(model.modelId)
  ));
  if (gpt5) return gpt5.id;

  const defaultModel = settings.models.find((model) => model.id === settings.defaultModelId && model.enabled);
  if (defaultModel) return defaultModel.id;

  throw new Error('No enabled tools-capable model found — check Settings → Engine → AI Models.');
};

const scoreScenario = (
  scenario: LiveEvalScenario,
  modelId: string,
  events: AgentStreamEvent[],
  durationMs: number,
  error?: unknown,
): ScenarioResult => {
  const eventCounts: Record<string, number> = {};
  events.forEach((event) => {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  });

  const firstTool = events.find((event): event is Extract<AgentStreamEvent, { type: 'tool_start' }> => event.type === 'tool_start');
  const doneEvent = events.find((event): event is Extract<AgentStreamEvent, { type: 'done' }> => event.type === 'done');
  const proposalEvent = events.find((event) => event.type === 'proposal');
  const validationEvent = events.find((event): event is Extract<AgentStreamEvent, { type: 'validation_result' }> => event.type === 'validation_result');

  const firstToolMatchedExpectation = scenario.expectedFirstToolNames && firstTool
    ? scenario.expectedFirstToolNames.includes(firstTool.name)
    : undefined;

  const toolNamesCalled = events
    .filter((event): event is Extract<AgentStreamEvent, { type: 'tool_start' }> => event.type === 'tool_start')
    .map((event) => event.name);
  const expectedToolNamesAllCalled = scenario.expectedToolNamesAnywhere
    ? scenario.expectedToolNamesAnywhere.every((name) => toolNamesCalled.includes(name))
    : undefined;

  return {
    id: scenario.id,
    label: scenario.label,
    modelId,
    ok: !error,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    durationMs,
    iterationCount: doneEvent?.iterationCount,
    tokensEstimate: doneEvent?.tokensEstimate,
    firstToolName: firstTool?.name,
    firstToolMatchedExpectation,
    toolNamesCalled,
    expectedToolNamesAllCalled,
    sawProposal: Boolean(proposalEvent),
    sawValidationResult: Boolean(validationEvent),
    validationOk: validationEvent?.ok,
    validationViolations: validationEvent?.violations,
    proposalExpectationMet: scenario.expectsProposal === Boolean(proposalEvent),
    finalText: doneEvent?.text?.slice(0, 400) ?? '',
    eventCounts,
    events,
  };
};

const runScenario = async (
  agentService: AgentService,
  actorUserId: number,
  scenario: LiveEvalScenario,
  modelId: string,
): Promise<ScenarioResult> => {
  const events: AgentStreamEvent[] = [];
  const startedAt = Date.now();
  try {
    await agentService.runStream(
      {
        mode: scenario.mode,
        modelId,
        messages: [
          ...(scenario.priorTurns ?? []),
          { role: 'user', content: scenario.prompt },
        ],
        pageContext: scenario.pageContext,
        agentPlanActMode: scenario.agentPlanActMode,
      },
      actorUserId,
      (event) => events.push(event),
    );
    return scoreScenario(scenario, modelId, events, Date.now() - startedAt);
  } catch (error) {
    return scoreScenario(scenario, modelId, events, Date.now() - startedAt, error);
  }
};

const printReport = (results: ScenarioResult[]) => {
  console.log('\n=== p-98 live-model eval — results ===\n');
  results.forEach((result) => {
    const status = result.ok ? 'OK' : 'ERROR';
    console.log(`[${status}] ${result.id} — ${result.label}`);
    console.log(`  model: ${result.modelId} · duration: ${result.durationMs}ms · iterations: ${result.iterationCount ?? '—'} · tokensEstimate: ${result.tokensEstimate ?? '—'}`);
    if (result.error) console.log(`  error: ${result.error}`);
    console.log(`  firstTool: ${result.firstToolName ?? '(none)'}${result.firstToolMatchedExpectation === false ? ' [UNEXPECTED]' : ''}`);
    console.log(`  toolsCalled: ${result.toolNamesCalled.join(', ') || '(none)'}${result.expectedToolNamesAllCalled === false ? ' [MISSING EXPECTED TOOL]' : ''}`);
    console.log(`  proposal: ${result.sawProposal ? 'yes' : 'no'} (expected: matched=${result.proposalExpectationMet}) · validation: ${result.sawValidationResult ? `ran (ok=${result.validationOk})` : 'did not run'}`);
    if (result.validationOk === false && result.validationViolations?.length) {
      console.log('  unresolved violations:');
      result.validationViolations.forEach((violation) => {
        console.log(`    - [${violation.severity}] ${violation.message}${violation.ruleId ? ` (${violation.ruleId})` : ''}`);
      });
    }
    console.log(`  final text: ${result.finalText.replace(/\n/g, ' ').slice(0, 200)}${result.finalText.length > 200 ? '…' : ''}`);
    console.log('');
  });

  const passCount = results.filter((result) => (
    result.ok && result.proposalExpectationMet && result.expectedToolNamesAllCalled !== false
  )).length;
  console.log(`Summary: ${passCount}/${results.length} scenarios completed with expected proposal behavior.`);
};

const main = async () => {
  const { model, only } = parseArgs(process.argv.slice(2));
  const scenarios = only?.length
    ? LIVE_EVAL_SCENARIOS.filter((scenario) => only.includes(scenario.id))
    : LIVE_EVAL_SCENARIOS;

  console.log('[eval:live-model] Bootstrapping full server runtime (DB + AI settings)…');
  await initializeFullServerRuntime(SETTINGS_PATH);

  const modelId = resolveModelId(model);
  console.log(`[eval:live-model] Using model: ${modelId}`);

  const admin = await findAuthUserByUsername('admin');
  if (!admin) {
    throw new Error('No "admin" user found — cannot resolve an actorUserId for the eval run.');
  }

  const agentService = new AgentService();
  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    console.log(`[eval:live-model] Running scenario: ${scenario.id}…`);
    // eslint-disable-next-line no-await-in-loop
    const result = await runScenario(agentService, admin.id, scenario, modelId);
    results.push(result);
    console.log(`[eval:live-model]   → ${result.ok ? 'done' : 'errored'} in ${result.durationMs}ms`);
  }

  printReport(results);

  // process.cwd()-based, not __dirname — under tsx's loader __dirname resolved to an unrelated
  // transpiled-module location (observed writing into src/generated/prisma/results/); npm scripts
  // always run from the repo root, so this is the reliable anchor.
  const resultsDir = path.join(process.cwd(), 'scripts', 'liveModelEval', 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const resultsPath = path.join(resultsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify({ modelId, ranAt: new Date().toISOString(), results }, null, 2));
  console.log(`[eval:live-model] Full results saved to ${resultsPath}`);
};

main()
  .catch((error) => {
    console.error('[eval:live-model] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => {});
    await closeControlPlanePool().catch(() => {});
  });
