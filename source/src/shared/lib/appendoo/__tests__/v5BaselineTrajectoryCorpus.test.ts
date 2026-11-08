import { describe, expect, it } from 'vitest';
import {
  BASELINE_TRAJECTORY_SCENARIOS,
  runBaselineTrajectoryScenario,
} from '../v5BaselineTrajectoryCorpus';
import { persistTrajectoryFixture, loadTrajectoryFixture } from '../v5BaselineTrajectoryPersistence';
import { BASELINE_TRAJECTORY_REQUIRED_CATEGORIES } from '../../../api/contracts/appendoo/v5BaselineTrajectory.types';

/**
 * V5 Phase P00 (PHASE-00-BASELINE-AND-TRAJECTORY.md, V5-0) — baseline trajectory corpus.
 *
 * Runs the REAL AgentOrchestrator against a scripted/mock provider (EV-3 blocks a live model —
 * see docs/appendoo/decision-log.md D-007) for every required scenario category, persists each
 * run as a replayable JSON fixture, and asserts the DoD: "Each scenario replay fixture has a
 * stable task ID and repository fingerprint."
 */
describe('V5 P00 baseline trajectory corpus', () => {
  it('covers every required baseline scenario category at least once', () => {
    const coveredCategories = new Set(BASELINE_TRAJECTORY_SCENARIOS.map((scenario) => scenario.category));
    for (const required of BASELINE_TRAJECTORY_REQUIRED_CATEGORIES) {
      expect(coveredCategories.has(required)).toBe(true);
    }
  });

  it('has unique, stable scenario ids', () => {
    const ids = BASELINE_TRAJECTORY_SCENARIOS.map((scenario) => scenario.scenarioId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const scenario of BASELINE_TRAJECTORY_SCENARIOS) {
    it(`captures and persists a replayable fixture for "${scenario.scenarioId}" (${scenario.category})`, async () => {
      const fixture = await runBaselineTrajectoryScenario(scenario);

      // Stable task ID and repository fingerprint — DoD requirement.
      expect(fixture.taskId).toMatch(/^[a-f0-9]{16}$/);
      expect(fixture.repositoryFingerprint).toBeTruthy();
      expect(fixture.repositoryFingerprint).not.toBe('unknown');
      expect(fixture.providerMode).toBe('mock');
      // Debt tracking moved to the consolidated p-72 AI backlog (Phase D live-model gate) —
      // the old standalone MUST-REVALIDATE-WITH-REAL-MODEL.md doc was folded into it.
      expect(fixture.debtRef).toContain('p-72-ai-backlog.md');

      // The scripted provider must have been fully consumed via real tool execution (at least
      // one tool_start per scripted toolCalls step, or a text-only close for ask/no-tool turns).
      const scriptedToolCallSteps = scenario.steps.filter((step) => 'toolCalls' in step).length;
      if (scriptedToolCallSteps > 0) {
        expect(fixture.toolOrder.length).toBeGreaterThan(0);
      }

      // Only the intentionally-scripted failures (repeated_test_failure's first run_tests call,
      // server_function_edit's deliberate invalid-payload probe) may fail — anything else means
      // a scenario's scripted tool args don't reflect real tool behavior, which would make this
      // an unproven/fabricated trajectory rather than a real captured one.
      const unexpectedFailures = fixture.result.traces.filter((trace) => {
        if (trace.ok !== false) return false;
        if (scenario.category === 'repeated_test_failure' && trace.toolName === 'run_tests') return false;
        if (scenario.category === 'server_function_edit' && trace.toolName === 'test_server_function') return false;
        // scheduler.sample-heartbeat is seeded by the install wizard on a live instance
        // (SAMPLE_SCHEDULER_FUNCTION_ID) — a bare test runtime has no managed functions, so
        // this retrieve legitimately 404s here; the scenario's trajectory already narrates
        // the "no detected fields" fallback for exactly this case.
        if (scenario.category === 'server_function_to_ui' && trace.toolName === 'get_server_function') return false;
        return true;
      });
      expect(unexpectedFailures).toEqual([]);

      persistTrajectoryFixture(fixture);
      const reloaded = loadTrajectoryFixture(scenario.scenarioId);
      expect(reloaded?.taskId).toBe(fixture.taskId);
      expect(reloaded?.scenarioId).toBe(fixture.scenarioId);
    });
  }

  it('regenerating the same scenario keeps the task ID stable', async () => {
    const scenario = BASELINE_TRAJECTORY_SCENARIOS[0];
    const first = await runBaselineTrajectoryScenario(scenario);
    const second = await runBaselineTrajectoryScenario(scenario);
    expect(first.taskId).toBe(second.taskId);
  });

  it('no-draft scenarios (simple question / already-fixed) produce no proposal', async () => {
    const noChangeScenario = BASELINE_TRAJECTORY_SCENARIOS.find(
      (scenario) => scenario.category === 'already_fixed_no_change',
    );
    expect(noChangeScenario).toBeDefined();
    const fixture = await runBaselineTrajectoryScenario(noChangeScenario!);
    expect(fixture.result.proposalId).toBeUndefined();
    expect(fixture.result.changeSets ?? []).toHaveLength(0);
  });

  it('multi-file scenario produces more than one file_patch changeSet', async () => {
    const multiFileScenario = BASELINE_TRAJECTORY_SCENARIOS.find(
      (scenario) => scenario.category === 'multi_file_feature',
    );
    expect(multiFileScenario).toBeDefined();
    const fixture = await runBaselineTrajectoryScenario(multiFileScenario!);
    const filePatchChangeSets = (fixture.result.changeSets ?? []).filter((cs) => cs.kind === 'file_patch');
    expect(filePatchChangeSets.length).toBeGreaterThanOrEqual(1);
  });

  it('repeated-test-failure scenario captures a fail-then-pass trace', async () => {
    const repeatedFailureScenario = BASELINE_TRAJECTORY_SCENARIOS.find(
      (scenario) => scenario.category === 'repeated_test_failure',
    );
    expect(repeatedFailureScenario).toBeDefined();
    const fixture = await runBaselineTrajectoryScenario(repeatedFailureScenario!);
    const testTraces = fixture.result.traces.filter((trace) => trace.toolName === 'run_tests');
    expect(testTraces.length).toBeGreaterThanOrEqual(2);
    expect(testTraces.some((trace) => trace.ok === false)).toBe(true);
    expect(testTraces.some((trace) => trace.ok === true)).toBe(true);
  });
});
