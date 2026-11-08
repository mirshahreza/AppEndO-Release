import { describe, expect, it } from 'vitest';
import { evaluateGoldenEvalThresholdCompliance } from '../../../../shared/lib/appendoo/goldenEvalThresholdsScaffold';
import { probeVerificationEngineScaffold } from '../../../../shared/lib/appendoo/verificationEngineHealth';
import { GOLDEN_EVAL_SCENARIOS } from '../../../../shared/api/contracts/appendoo/goldenEval.types';
import { goldenEvalService } from '../goldenEval.service';

describe('goldenEvalService', () => {
  it('evaluates routing for engineering change scenarios', () => {
    const scenario = goldenEvalService.runRoutingSuite().find((result) => result.scenarioId === 'GE-004');
    expect(scenario?.passed).toBe(true);
  });

  it('summarizes routing suite', () => {
    const results = goldenEvalService.runRoutingSuite();
    const summary = goldenEvalService.summarizeResults(results);
    expect(summary.total).toBeGreaterThan(10);
    expect(summary.requestClassAccuracy).toBeGreaterThan(0.5);
  });

  it('validates catalog through service', () => {
    expect(goldenEvalService.validateCatalog().ok).toBe(true);
  });

  it('evaluates approval-gated engineering pipeline gate', () => {
    const result = goldenEvalService.evaluateEngineeringPipelineGate();
    expect(result.passed).toBe(true);
    expect(result.scenarioId).toBe('GE-PIPELINE-GATE');
  });

  it('evaluates doc 13 engineering routing scenarios', () => {
    const results = goldenEvalService.evaluateDoc13EngineeringRouting();
    expect(results.length).toBe(5);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it('evaluates doc 13 pipeline E2E for engineering change scenarios', () => {
    const results = goldenEvalService.evaluateDoc13PipelineE2E();
    expect(results.length).toBe(6);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it('evaluates doc 13 labeled status gates', () => {
    const results = goldenEvalService.evaluateDoc13LabeledStatusGates();
    expect(results.length).toBe(22);
    expect(results.filter((result) => result.releaseBlocking).every((result) => result.passed)).toBe(true);
  });

  it('evaluates full doc 13 batch with routing and pipeline coverage', () => {
    const results = goldenEvalService.evaluateDoc13FullBatch();
    expect(results.length).toBeGreaterThan(20);

    const routingResults = results.filter(
      (result) => !result.scenarioId.endsWith('-PIPELINE') && result.scenarioId !== 'GE-PIPELINE-GATE',
    );
    const labeledResults = goldenEvalService.evaluateDoc13LabeledStatusGates();
    const summary = goldenEvalService.summarizeResults(routingResults, labeledResults);
    expect(summary.releaseBlockingFailures).toBe(0);
    expect(summary.requestClassAccuracy).toBeGreaterThanOrEqual(0.9);
    const verification = probeVerificationEngineScaffold();
    expect(evaluateGoldenEvalThresholdCompliance({
      summary,
      verificationGraderCount: verification.implementedGraderCount,
      scaffoldProbePassCount: 10,
      scaffoldProbeTotal: 10,
    }).ok).toBe(true);

    expect(results.find((result) => result.scenarioId === 'GE-PIPELINE-GATE')?.passed).toBe(true);
    expect(
      results.filter((result) => result.scenarioId.endsWith('-PIPELINE')).every((result) => result.passed),
    ).toBe(true);
  });

  it('evaluates live activation roundtrip gate (GE-021)', () => {
    const result = goldenEvalService.evaluateLiveActivationRoundtripGate();
    expect(result.scenarioId).toBe('GE-021');
    expect(result.passed).toBe(true);
  });

  it('evaluates ASP depth for V3_4_TARGET plan scenarios', () => {
    const scenario = GOLDEN_EVAL_SCENARIOS.find((item) => item.scenarioId === 'GE-017');
    expect(scenario).toBeTruthy();
    const result = goldenEvalService.evaluateAspScenarioDepth(scenario!);
    expect(result.passed).toBe(true);
  });

  it('evaluates V4 agent-loop golden scenarios', () => {
    const results = goldenEvalService.evaluateV4AgentLoopGoldenScenarios();
    expect(results.length).toBe(3);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it('evaluates GE-AGENT-WF4-001 orchestrator E2E gate', async () => {
    const result = await goldenEvalService.evaluateGeAgentWf4OrchestratorE2e();
    expect(result.scenarioId).toBe('GE-AGENT-WF4-001-E2E');
    expect(result.passed, result.failures.join('; ')).toBe(true);
  });

  it('evaluates automated §13.2 acceptance prompt gates', async () => {
    const results = await goldenEvalService.evaluateAutomatedAcceptancePromptGates();
    expect(results.length).toBe(9);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it('closes doc 13 golden eval gate', () => {
    const closure = goldenEvalService.evaluateDoc13GoldenClosure();
    expect(closure.catalogOk).toBe(true);
    expect(closure.scenarioDepthOk).toBe(true);
    expect(closure.labeledGatesOk).toBe(true);
    expect(closure.fullBatchOk).toBe(true);
    expect(closure.backingProbeOk).toBe(true);
    expect(closure.liveActivationProbeOk).toBe(true);
    expect(closure.contextPackEnrichmentOk).toBe(true);
    expect(closure.productionOpsOk).toBe(true);
    expect(closure.cutoverChecklistOk).toBe(true);
    expect(closure.v1RemovalChecklistOk).toBe(true);
    expect(closure.gatewayScaffoldOk).toBe(true);
    expect(closure.applicationIntelligenceScaffoldOk).toBe(true);
    expect(closure.codebaseRetrievalScaffoldOk).toBe(true);
    expect(closure.memoryKnowledgeCapabilitiesScaffoldOk).toBe(true);
    expect(closure.contextSemanticPlanningScaffoldOk).toBe(true);
    expect(closure.changeGraphWorkspaceScaffoldOk).toBe(true);
    expect(closure.builderOrchestrationScaffoldOk).toBe(true);
    expect(closure.verificationEngineScaffoldOk).toBe(true);
    expect(closure.architectUxScaffoldOk).toBe(true);
    expect(closure.appendooHardeningScaffoldOk).toBe(true);
    expect(closure.goldenEvalThresholdsOk).toBe(true);
    expect(closure.proposalOutcomeTelemetryOk).toBe(true);
    expect(closure.perceivedLatencyTelemetryOk).toBe(true);
    expect(closure.v4QualityMetricsOk).toBe(true);
    expect(closure.closed).toBe(true);
  });

  it('evaluates doc 13 scenario depth metadata and routing', () => {
    const depth = goldenEvalService.evaluateDoc13ScenarioDepth();
    expect(depth.metadataOk).toBe(true);
    expect(depth.routingOk).toBe(true);
    expect(depth.depth.scenarioCount).toBe(22);
  });
});
