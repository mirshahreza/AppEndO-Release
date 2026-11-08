import type { AgentMode } from '../../../shared/api/contracts/ai/agentTypes';
import type { AssistantRequestRoutingInput } from '../../../shared/api/contracts/ai/appendooGateway.types';
import type {
  GoldenEvalRunResult,
  GoldenEvalScenario,
  GoldenEvalThresholds,
} from '../../../shared/api/contracts/appendoo/goldenEval.types';
import {
  DEFAULT_GOLDEN_EVAL_THRESHOLDS,
  GOLDEN_EVAL_SCENARIOS,
} from '../../../shared/api/contracts/appendoo/goldenEval.types';
import { routeAssistantRequest } from '../../domain/ai/assistantRequestRouter';
import { resolveTurnExecutionProfile } from '../../../core/ai/agent/turnExecutionProfile';
import { isV1DirectWriteBlocked, shouldBlockPanelAutoApply } from '../../../shared/lib/appendoo/appendooCutover';
import { getGoldenEvalCatalogHealth, validateGoldenEvalCatalog } from '../../../shared/lib/appendoo/goldenEvalCatalog';
import {
  summarizeDoc13ScenarioDepth,
  validateDoc13ScenarioDepth,
} from '../../../shared/lib/appendoo/goldenEvalScenarioDepth';
import { probeChangeGraphCheckpointBacking } from '../../../shared/lib/appendoo/changeGraphCheckpointBackingHealth';
import { probeLiveRuntimeActivationDepth } from '../../../shared/lib/appendoo/appendooIntegrationFlags';
import { probeAppendooProductionOps } from '../../../shared/lib/appendoo/appendooProductionOpsHealth';
import { probeContextPackEnrichmentProductionDepth } from '../../../shared/lib/appendoo/contextPackBuilderHealth';
import { loadFeatureGraph } from '../../../shared/lib/featureGraphStore';
import { evaluateAppendooCutoverChecklist } from '../../../shared/lib/appendoo/appendooCutoverChecklist';
import { evaluateAppendooV1RemovalChecklist } from '../../../shared/lib/appendoo/appendooV1RemovalChecklist';
import { probeAppendooGatewayScaffold } from '../../../shared/lib/appendoo/appendooGatewayHealth';
import { probeApplicationIntelligenceScaffold } from '../../../shared/lib/appendoo/applicationIntelligenceHealth';
import { probeCodebaseRetrievalScaffold } from '../../../shared/lib/appendoo/codebaseRetrievalHealth';
import { probeMemoryKnowledgeCapabilitiesScaffold } from '../../../shared/lib/appendoo/memoryKnowledgeCapabilitiesHealth';
import { probeContextSemanticPlanningScaffold } from '../../../shared/lib/appendoo/contextSemanticPlanningHealth';
import { probeChangeGraphWorkspaceScaffold } from '../../../shared/lib/appendoo/changeGraphWorkspaceHealth';
import { probeBuilderOrchestrationScaffold } from '../../../shared/lib/appendoo/builderOrchestrationHealth';
import { probeVerificationEngineScaffold } from '../../../shared/lib/appendoo/verificationEngineHealth';
import { probeArchitectUxScaffold } from '../../../shared/lib/appendoo/architectUxHealth';
import { probeAppendooHardeningScaffold } from '../../../shared/lib/appendoo/appendooHardeningHealth';
import {
  evaluateGoldenEvalThresholdCompliance,
  summarizeLabeledGateResults,
} from '../../../shared/lib/appendoo/goldenEvalThresholdsScaffold';
import { validateGoldenEvalThresholdConfig } from '../../../shared/lib/appendoo/goldenEvalThresholdsHealth';
import {
  validateApprovalBindingAttribution,
} from '../../../shared/lib/appendoo/semanticPlanCompositionScaffold';
import { engineeringPipelineService } from './engineeringPipeline.service';
import { semanticPlanApprovalService } from './semanticPlanApproval.service';
import { contextIntelligenceService } from './contextIntelligence.service';
import { semanticPlanningService } from './semanticPlanning.service';
import {
  evaluateGeSfUi001Scenario,
  GE_SF_UI_001_SCENARIO_ID,
  GE_SF_UI_001_PROMPT,
} from '../../../shared/lib/appendoo/goldenEvalServerFunctionUi';
import { evaluateAllV4AgentLoopGoldenScenarios } from '../../../shared/lib/appendoo/goldenEvalAgentLoop';
import {
  runGeAgentWf4_001OrchestratorScenario,
} from '../../../shared/lib/appendoo/goldenEvalAgentLoopE2e';
import { probeProposalOutcomeTelemetryHealth } from '../../../shared/lib/appendoo/proposalOutcomeTelemetry';
import { probeChatPerceivedLatencyHealth } from '../../../shared/lib/appendoo/chatPerceivedLatencyTelemetry';
import { probeV4QualityMetricsHealth } from '../../../shared/lib/appendoo/v4QualityMetricsSnapshot';
import { evaluateAutomatedAcceptancePromptGates as runAutomatedAcceptancePromptGates, evaluateV4Patch5GovernanceGates } from '../../../shared/lib/appendoo/goldenEvalAcceptancePrompts';
import {
  sumTwoNumbersPageContext,
  serverFunctionsScope,
} from '../ai/__tests__/e2eEngineeringPipeline.helpers';

const buildRoutingInput = (scenario: GoldenEvalScenario): AssistantRequestRoutingInput => ({
  mode: scenario.mode as AgentMode,
  userPrompt: scenario.prompt,
  executionProfile: resolveTurnExecutionProfile(scenario.mode as AgentMode, scenario.prompt),
  pageContext: scenario.kind === 'page_context_query'
    ? { path: '/us/studio/users', pageLabel: 'Users', pageKey: 'users' }
    : undefined,
});

export class GoldenEvalService {
  evaluateScenarioRouting(scenario: GoldenEvalScenario): GoldenEvalRunResult {
    const routing = routeAssistantRequest(buildRoutingInput(scenario));
    const failures: string[] = [];

    if (scenario.expectedRequestClass && routing.requestClass !== scenario.expectedRequestClass) {
      failures.push(
        `Expected requestClass ${scenario.expectedRequestClass}, got ${routing.requestClass}.`,
      );
    }

    if (scenario.expectEngineeringPipeline && !routing.useEngineeringPipeline) {
      failures.push('Expected useEngineeringPipeline=true.');
    }

    if (scenario.expectV1WriteBlocked) {
      if (scenario.mode === 'ask') {
        if (routing.useEngineeringPipeline || routing.requestClass === 'ENGINEERING_CHANGE') {
          failures.push('Ask mode must not route to engineering write pipeline.');
        }
      } else if (shouldBlockPanelAutoApply(routing) !== isV1DirectWriteBlocked()) {
        // p-63 — v1 blocking follows the (reopened) write-block policy; the gate checks
        // consistency with that policy rather than asserting an unconditional block.
        failures.push('Panel auto-apply blocking must match the v1 write-block policy.');
      }
    }

    return {
      scenarioId: scenario.scenarioId,
      passed: failures.length === 0,
      releaseBlocking: scenario.releaseBlocking,
      failures,
      observedRequestClass: routing.requestClass,
    };
  }

  runRoutingSuite(scenarios: GoldenEvalScenario[] = GOLDEN_EVAL_SCENARIOS): GoldenEvalRunResult[] {
    return scenarios.map((scenario) => this.evaluateScenarioRouting(scenario));
  }

  summarizeResults(
    results: GoldenEvalRunResult[],
    labeledResults: GoldenEvalRunResult[] = [],
  ) {
    const withExpected = results.filter((result) => {
      const scenario = GOLDEN_EVAL_SCENARIOS.find((item) => item.scenarioId === result.scenarioId);
      return Boolean(scenario?.expectedRequestClass);
    });

    const routingPasses = withExpected.filter((result) => result.passed).length;
    const requestClassAccuracy = withExpected.length > 0
      ? routingPasses / withExpected.length
      : 1;

    const releaseBlocking = results.filter((result) => result.releaseBlocking);
    const releaseBlockingPassed = releaseBlocking.filter((result) => result.passed).length;
    const releaseBlockingFailures = releaseBlocking.length - releaseBlockingPassed;
    const labeledGate = summarizeLabeledGateResults(labeledResults);

    return {
      total: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      releaseBlockingFailures,
      releaseBlockingTotal: releaseBlocking.length,
      releaseBlockingPassed,
      requestClassAccuracy,
      labeledGateTotal: labeledGate.labeledGateTotal,
      labeledGatePassed: labeledGate.labeledGatePassed,
    };
  }

  getCatalogHealth() {
    return getGoldenEvalCatalogHealth();
  }

  validateCatalog() {
    return validateGoldenEvalCatalog();
  }

  /** AE-11 — context pack recall@K scaffold (GE-020). */
  evaluateContextPackRecallAtK(): GoldenEvalRunResult {
    const pack = contextIntelligenceService.buildRunContextPack({
      applicationScope: {
        kind: 'platform',
        scopeKey: 'platform:studio:page:users',
        mountId: 'studio',
        pageKey: 'users',
      },
      pageContext: {
        pageKey: 'users',
        pageLabel: 'Users',
        path: '/us/studio/users',
      },
      userPrompt: 'Add export action to users grid with RBAC checks.',
    });

    const failures: string[] = [];
    const recallK = 3;
    const topTargets = pack.primaryTargets.slice(0, recallK);

    if (!topTargets.some((target) => target.ref === 'users')) {
      failures.push('Recall@K missed users primary target.');
    }
    if (pack.selectionExplanations.length === 0) {
      failures.push('Context pack missing enrichment selection explanations.');
    }

    return {
      scenarioId: 'GE-020',
      passed: failures.length === 0,
      releaseBlocking: false,
      failures,
    };
  }

  /** AE-HARDEN-8 — exact ServerFunction → UI vertical slice with semantic assertions. */
  evaluateGeSfUi001Gate(): GoldenEvalRunResult {
    const result = evaluateGeSfUi001Scenario();
    return {
      scenarioId: GE_SF_UI_001_SCENARIO_ID,
      passed: result.passed,
      releaseBlocking: result.releaseBlocking,
      failures: result.failures,
    };
  }

  /** V4-PATCH P4 — agent-loop routing, retrieve gate, and activity label gates. */
  evaluateV4AgentLoopGoldenScenarios(): GoldenEvalRunResult[] {
    return evaluateAllV4AgentLoopGoldenScenarios().map((result) => ({
      scenarioId: result.scenarioId,
      passed: result.passed,
      releaseBlocking: true,
      failures: result.failures,
    }));
  }

  /** P4.1 — GE-AGENT-WF4-001 orchestrator E2E (retrieve → draft → proposal). */
  async evaluateGeAgentWf4OrchestratorE2e(): Promise<GoldenEvalRunResult> {
    const result = await runGeAgentWf4_001OrchestratorScenario();
    return {
      scenarioId: result.scenarioId,
      passed: result.passed,
      releaseBlocking: true,
      failures: result.failures,
    };
  }

  /** Section 13.2 — automated acceptance prompt gates (subset; manual prompts in p-72-ai-backlog section 5 MQA-15). */
  async evaluateAutomatedAcceptancePromptGates(): Promise<GoldenEvalRunResult[]> {
    const results = await runAutomatedAcceptancePromptGates();
    return results.map((result) => ({
      scenarioId: result.scenarioId,
      passed: result.passed,
      releaseBlocking: true,
      failures: result.failures,
    }));
  }

  /** V4-PATCH-5 — reverse ASP, promotion gate API, structured governed intent, deadlock probe. */
  evaluateV4Patch5GovernanceGates(): GoldenEvalRunResult[] {
    return evaluateV4Patch5GovernanceGates().map((result) => ({
      scenarioId: result.scenarioId,
      passed: result.passed,
      releaseBlocking: true,
      failures: result.failures,
    }));
  }

  /** AE-11.2 — approval-gated execute → verify → promote E2E on vertical slice. */
  evaluateEngineeringPipelineGate(): GoldenEvalRunResult {
    engineeringPipelineService.resetForTests();

    const scaffold = engineeringPipelineService.runScaffold({
      applicationScope: serverFunctionsScope(),
      pageContext: sumTwoNumbersPageContext(),
      userPrompt: GE_SF_UI_001_PROMPT,
      requiresApproval: true,
      executeBuilders: true,
    });

    const failures: string[] = [];

    if (!scaffold.planActionPolicy.canApprove) {
      failures.push(`Plan not approvable: ${scaffold.planActionPolicy.blockingReasonCodes.join(', ')}`);
    }

    if (scaffold.executedNodeCount !== 0) {
      failures.push('Expected builder execute to be blocked before approval.');
    }

    const bindingId = scaffold.approvalBinding?.bindingId;
    if (!bindingId) {
      failures.push('Expected approval binding to be registered.');
    } else {
      semanticPlanApprovalService.approve(bindingId, 'golden-eval');
      const executed = engineeringPipelineService.executeApprovedBinding(bindingId);

      if (executed.executedNodeCount === 0) {
        failures.push('Expected builder execute after approval.');
      }
      if (!executed.deployable) {
        failures.push('Expected verified revision to be deployable.');
      }
      if (!executed.promotionRunId) {
        failures.push('Expected promotion run after deployable verification.');
      }
      if (executed.promotionState !== 'DEPLOYED') {
        failures.push(`Expected promotion state DEPLOYED, got ${executed.promotionState ?? 'none'}.`);
      }
      if ((executed.runtimeActivatedCount ?? 0) === 0) {
        failures.push('Expected runtime activation after DEPLOYED promotion.');
      }
      if (!executed.packageSnapshotId) {
        failures.push('Expected package snapshot after DEPLOYED promotion.');
      }
      if (executed.packageRoundtripValidated !== true) {
        failures.push('Expected package export roundtrip validation after snapshot finalize.');
      }
    }

    return {
      scenarioId: 'GE-PIPELINE-GATE',
      passed: failures.length === 0,
      releaseBlocking: true,
      failures,
    };
  }

  /** AE-11.9 / GE-021 — live activation roundtrip gate under default-on test rollout. */
  evaluateLiveActivationRoundtripGate(): GoldenEvalRunResult {
    const failures: string[] = [];
    const liveProbe = probeLiveRuntimeActivationDepth();

    if (!liveProbe.ok) {
      failures.push(liveProbe.reason ?? 'Live runtime activation probe failed.');
    }

    engineeringPipelineService.resetForTests();
    const pipeline = this.evaluateEngineeringPipelineGate();
    if (!pipeline.passed) {
      failures.push(...pipeline.failures.map((failure) => `[live-roundtrip] ${failure}`));
    }

    return {
      scenarioId: 'GE-021',
      passed: failures.length === 0,
      releaseBlocking: true,
      failures,
    };
  }

  /** AE-11.9 — ASP composition + reuse attribution depth for plan-mode V3_4_TARGET scenarios. */
  evaluateAspScenarioDepth(scenario: GoldenEvalScenario): GoldenEvalRunResult {
    const failures: string[] = [];

    try {
      const built = semanticPlanningService.buildPlanFromContextInput({
        applicationScope: {
          kind: 'platform',
          scopeKey: 'platform:studio:page:users',
          mountId: 'studio',
          pageKey: 'users',
        },
        userPrompt: scenario.prompt,
      });

      if (built.plan.authority !== 'SCAFFOLD' && !built.plan.validation?.ok) {
        failures.push('ASP validation failed for scenario prompt.');
      }

      if (built.plan.proposedArtifacts.length === 0) {
        failures.push('Expected proposed artifacts from context pack.');
      }

      if (scenario.scenarioId === 'GE-017') {
        if ((built.plan.compositionCandidates?.length ?? 0) === 0) {
          failures.push('CRM macro scenario expected composition candidates.');
        }
        if ((built.plan.reuseSummary?.compositeReuseScore ?? 0) <= 0) {
          failures.push('CRM macro scenario expected reuse summary score.');
        }
      }

      if (scenario.scenarioId === 'GE-019') {
        const attribution = validateApprovalBindingAttribution(built.plan, built.contextPack, {
          planId: built.plan.planId,
          planRevision: built.plan.revision,
          contextPackId: built.contextPack.contextPackId,
          contextPackRevision: built.contextPack.revision,
          fingerprint: 'golden-eval-attribution',
        });
        if (!attribution.ok) {
          failures.push('Reuse attribution binding validation failed.');
        }
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'ASP depth evaluation failed.');
    }

    return {
      scenarioId: `${scenario.scenarioId}-ASP`,
      passed: failures.length === 0,
      releaseBlocking: scenario.releaseBlocking,
      failures,
    };
  }

  /** AE-11.9 — doc `13` engineering scenario routing batch (GE-004/005/016/017/018). */
  evaluateDoc13EngineeringRouting(): GoldenEvalRunResult[] {
    const scenarioIds = ['GE-004', 'GE-005', 'GE-016', 'GE-017', 'GE-018'];
    return scenarioIds.map((scenarioId) => {
      const scenario = GOLDEN_EVAL_SCENARIOS.find((item) => item.scenarioId === scenarioId);
      if (!scenario) {
        return {
          scenarioId,
          passed: false,
          releaseBlocking: true,
          failures: [`Scenario ${scenarioId} not found in catalog.`],
        };
      }
      return this.evaluateScenarioRouting(scenario);
    });
  }

  /** AE-11.4 — routing + full pipeline gate for doc `13` engineering change scenarios. */
  evaluateDoc13PipelineE2E(): GoldenEvalRunResult[] {
    const scenarioIds = ['GE-004', 'GE-005', 'GE-018'];

    return scenarioIds.flatMap((scenarioId) => {
      const scenario = GOLDEN_EVAL_SCENARIOS.find((item) => item.scenarioId === scenarioId);
      if (!scenario) {
        return [{
          scenarioId,
          passed: false,
          releaseBlocking: true,
          failures: [`Scenario ${scenarioId} not found in catalog.`],
        }];
      }

      const routing = this.evaluateScenarioRouting(scenario);
      engineeringPipelineService.resetForTests();
      const pipeline = this.evaluateEngineeringPipelineGate();

      return [
        routing,
        {
          scenarioId: `${scenarioId}-PIPELINE`,
          passed: pipeline.passed,
          releaseBlocking: true,
          failures: pipeline.failures.map((failure) => `[${scenarioId}] ${failure}`),
        },
      ];
    });
  }

  /** AE-11.5 — full doc `13` routing suite + engineering pipeline batch. */
  evaluateDoc13FullBatch(): GoldenEvalRunResult[] {
    const routingResults = this.runRoutingSuite();
    engineeringPipelineService.resetForTests();
    const pipelineGate = this.evaluateEngineeringPipelineGate();
    const liveActivationGate = this.evaluateLiveActivationRoundtripGate();
    const engineeringPipelineScenarios = GOLDEN_EVAL_SCENARIOS.filter(
      (scenario) => scenario.expectEngineeringPipeline,
    );

    const pipelineResults = engineeringPipelineScenarios.map((scenario) => ({
      scenarioId: `${scenario.scenarioId}-PIPELINE`,
      passed: pipelineGate.passed,
      releaseBlocking: scenario.releaseBlocking,
      failures: pipelineGate.failures.map((failure) => `[${scenario.scenarioId}] ${failure}`),
    }));

    return [
      ...routingResults,
      pipelineGate,
      liveActivationGate,
      ...pipelineResults,
    ];
  }

  /** AE-11.7 — enforce doc `13` labeled status gates on golden catalog. */
  evaluateDoc13LabeledStatusGates(): GoldenEvalRunResult[] {
    engineeringPipelineService.resetForTests();
    const pipelineGate = this.evaluateEngineeringPipelineGate();

    return GOLDEN_EVAL_SCENARIOS.map((scenario) => {
      if (scenario.catalogStatus === 'FUTURE_ECOSYSTEM' || scenario.catalogStatus === 'PACKAGE_DEPENDENT') {
        return {
          scenarioId: `${scenario.scenarioId}-STATUS`,
          passed: true,
          releaseBlocking: false,
          failures: [],
        };
      }

      const routing = this.evaluateScenarioRouting(scenario);
      const failures = [...routing.failures];

      if (scenario.catalogStatus === 'V3_4_TARGET' && scenario.expectEngineeringPipeline && !pipelineGate.passed) {
        failures.push(...pipelineGate.failures.map((failure) => `[pipeline] ${failure}`));
      }

      if (scenario.scenarioId === 'GE-020') {
        const recall = this.evaluateContextPackRecallAtK();
        if (!recall.passed) {
          failures.push(...recall.failures);
        }
      }

      if (scenario.catalogStatus === 'V3_4_TARGET'
        && (scenario.scenarioId === 'GE-017' || scenario.scenarioId === 'GE-019')) {
        const aspDepth = this.evaluateAspScenarioDepth(scenario);
        if (!aspDepth.passed) {
          failures.push(...aspDepth.failures);
        }
      }

      if (scenario.catalogStatus === 'AVAILABLE_NOW' && scenario.expectV1WriteBlocked && scenario.mode !== 'ask') {
        // p-63 — consistency with the (reopened) v1 write-block policy, not an unconditional block.
        const blocked = shouldBlockPanelAutoApply({
          useEngineeringPipeline: scenario.expectEngineeringPipeline ?? false,
          requestClass: scenario.expectedRequestClass ?? 'ENGINEERING_CHANGE',
        });
        const expectedBlocked = isV1DirectWriteBlocked() && (scenario.expectEngineeringPipeline ?? false);
        if (blocked !== expectedBlocked) {
          failures.push('AVAILABLE_NOW scenario v1 write blocking must match write-block policy.');
        }
      }

      const releaseBlocking = scenario.catalogStatus === 'AVAILABLE_NOW'
        ? scenario.releaseBlocking
        : scenario.releaseBlocking && scenario.catalogStatus === 'V3_4_TARGET';

      return {
        scenarioId: `${scenario.scenarioId}-STATUS`,
        passed: failures.length === 0,
        releaseBlocking,
        failures,
        observedRequestClass: routing.observedRequestClass,
      };
    });
  }

  /** AE-11.8 — doc `13` golden closure gate (catalog + labeled statuses + full batch + backing probe). */
  evaluateDoc13GoldenClosure(): {
    closed: boolean;
    catalogOk: boolean;
    scenarioDepthOk: boolean;
    labeledGatesOk: boolean;
    fullBatchOk: boolean;
    backingProbeOk: boolean;
    liveActivationProbeOk: boolean;
    contextPackEnrichmentOk: boolean;
    productionOpsOk: boolean;
    cutoverChecklistOk: boolean;
    v1RemovalChecklistOk: boolean;
    gatewayScaffoldOk: boolean;
    applicationIntelligenceScaffoldOk: boolean;
    codebaseRetrievalScaffoldOk: boolean;
    memoryKnowledgeCapabilitiesScaffoldOk: boolean;
    contextSemanticPlanningScaffoldOk: boolean;
    changeGraphWorkspaceScaffoldOk: boolean;
    builderOrchestrationScaffoldOk: boolean;
    verificationEngineScaffoldOk: boolean;
    architectUxScaffoldOk: boolean;
    appendooHardeningScaffoldOk: boolean;
    goldenEvalThresholdsOk: boolean;
    proposalOutcomeTelemetryOk: boolean;
    perceivedLatencyTelemetryOk: boolean;
    v4QualityMetricsOk: boolean;
    results: GoldenEvalRunResult[];
    summary: ReturnType<GoldenEvalService['summarizeResults']> & {
      meetsThresholds: boolean;
      thresholdFailures: string[];
    };
  } {
    const catalog = this.validateCatalog();
    const scenarioDepth = validateDoc13ScenarioDepth();
    engineeringPipelineService.resetForTests();
    const pipelineGate = this.evaluateEngineeringPipelineGate();
    const geSfUi001Gate = this.evaluateGeSfUi001Gate();
    const v4AgentLoopGates = this.evaluateV4AgentLoopGoldenScenarios();
    const cutoverChecklist = evaluateAppendooCutoverChecklist({
      pipelineGatePassed: pipelineGate.passed,
    });
    const v1RemovalChecklist = evaluateAppendooV1RemovalChecklist();
    const gatewayScaffold = probeAppendooGatewayScaffold();
    let applicationIntelligenceScaffold = {
      ok: false,
      failures: ['Feature graph not loaded.'],
      intelligenceVersion: '',
      indexVersion: 0,
      nodeCount: 0,
    };
    try {
      applicationIntelligenceScaffold = probeApplicationIntelligenceScaffold({
        graph: loadFeatureGraph(),
        applicationScopeRef: 'platform:studio',
      });
    } catch (error) {
      applicationIntelligenceScaffold = {
        ok: false,
        failures: [`Feature graph load failed: ${error instanceof Error ? error.message : String(error)}`],
        intelligenceVersion: '',
        indexVersion: 0,
        nodeCount: 0,
      };
    }
    const codebaseRetrievalScaffold = probeCodebaseRetrievalScaffold({
      applicationScopeRef: 'platform:studio',
      sampleFiles: [
        {
          path: 'src/features/users/UsersPage.tsx',
          content: 'export function buildContextPackScaffold() { return {}; }',
        },
      ],
      featureGraph: (() => {
        try {
          return loadFeatureGraph();
        } catch {
          return undefined;
        }
      })(),
    });
    const memoryKnowledgeCapabilitiesScaffold = probeMemoryKnowledgeCapabilitiesScaffold();
    const contextSemanticPlanningScaffold = probeContextSemanticPlanningScaffold();
    const changeGraphWorkspaceScaffold = probeChangeGraphWorkspaceScaffold();
    const builderOrchestrationScaffold = probeBuilderOrchestrationScaffold();
    const verificationEngineScaffold = probeVerificationEngineScaffold();
    const architectUxScaffold = probeArchitectUxScaffold();
    const appendooHardeningScaffold = probeAppendooHardeningScaffold();
    const labeledResults = this.evaluateDoc13LabeledStatusGates();
    const fullBatchResults = this.evaluateDoc13FullBatch();
    const backingProbe = probeChangeGraphCheckpointBacking();
    const liveActivationProbe = probeLiveRuntimeActivationDepth();
    const liveActivationGate = fullBatchResults.find((result) => result.scenarioId === 'GE-021');
    const contextPackEnrichment = probeContextPackEnrichmentProductionDepth({
      graph: (() => {
        try {
          return loadFeatureGraph();
        } catch {
          return undefined;
        }
      })(),
    });
    const productionOps = probeAppendooProductionOps();

    const routingResults = fullBatchResults.filter(
      (result) => !result.scenarioId.endsWith('-PIPELINE') && result.scenarioId !== 'GE-PIPELINE-GATE',
    );
    const summaryBase = this.summarizeResults(routingResults, labeledResults);
    const scaffoldProbes = [
      gatewayScaffold,
      applicationIntelligenceScaffold,
      codebaseRetrievalScaffold,
      memoryKnowledgeCapabilitiesScaffold,
      contextSemanticPlanningScaffold,
      changeGraphWorkspaceScaffold,
      builderOrchestrationScaffold,
      verificationEngineScaffold,
      architectUxScaffold,
      appendooHardeningScaffold,
    ];
    const thresholdConfig = validateGoldenEvalThresholdConfig();
    const thresholdCompliance = evaluateGoldenEvalThresholdCompliance({
      summary: summaryBase,
      verificationGraderCount: verificationEngineScaffold.implementedGraderCount,
      scaffoldProbePassCount: scaffoldProbes.filter((probe) => probe.ok).length,
      scaffoldProbeTotal: scaffoldProbes.length,
    });
    const goldenEvalThresholdsOk = thresholdConfig.ok && thresholdCompliance.ok;
    const proposalOutcomeTelemetry = probeProposalOutcomeTelemetryHealth();
    const perceivedLatencyTelemetry = probeChatPerceivedLatencyHealth();
    const v4QualityMetrics = probeV4QualityMetricsHealth();
    const summary = {
      ...summaryBase,
      meetsThresholds: thresholdCompliance.ok,
      thresholdFailures: thresholdCompliance.failures,
    };

    const labeledGatesOk = labeledResults
      .filter((result) => result.releaseBlocking)
      .every((result) => result.passed);

    const fullBatchOk = summary.meetsThresholds
      && fullBatchResults.find((result) => result.scenarioId === 'GE-PIPELINE-GATE')?.passed === true
      && geSfUi001Gate.passed
      && v4AgentLoopGates.every((result) => result.passed)
      && liveActivationGate?.passed === true
      && fullBatchResults
        .filter((result) => result.scenarioId.endsWith('-PIPELINE'))
        .every((result) => result.passed);

    const closed = catalog.ok && scenarioDepth.ok && labeledGatesOk && fullBatchOk
      && geSfUi001Gate.passed
      && v4AgentLoopGates.every((result) => result.passed)
      && backingProbe.ok && liveActivationProbe.ok && contextPackEnrichment.ok && productionOps.ok
      && cutoverChecklist.ok && v1RemovalChecklist.ok && gatewayScaffold.ok
      && applicationIntelligenceScaffold.ok && codebaseRetrievalScaffold.ok
      && memoryKnowledgeCapabilitiesScaffold.ok && contextSemanticPlanningScaffold.ok
      && changeGraphWorkspaceScaffold.ok && builderOrchestrationScaffold.ok
      && verificationEngineScaffold.ok && architectUxScaffold.ok
      && appendooHardeningScaffold.ok && goldenEvalThresholdsOk
      && proposalOutcomeTelemetry.ok
      && perceivedLatencyTelemetry.ok
      && v4QualityMetrics.ok;

    return {
      closed,
      catalogOk: catalog.ok,
      scenarioDepthOk: scenarioDepth.ok,
      labeledGatesOk,
      fullBatchOk,
      backingProbeOk: backingProbe.ok,
      liveActivationProbeOk: liveActivationProbe.ok && liveActivationGate?.passed === true,
      contextPackEnrichmentOk: contextPackEnrichment.ok,
      productionOpsOk: productionOps.ok,
      cutoverChecklistOk: cutoverChecklist.ok,
      v1RemovalChecklistOk: v1RemovalChecklist.ok,
      gatewayScaffoldOk: gatewayScaffold.ok,
      applicationIntelligenceScaffoldOk: applicationIntelligenceScaffold.ok,
      codebaseRetrievalScaffoldOk: codebaseRetrievalScaffold.ok,
      memoryKnowledgeCapabilitiesScaffoldOk: memoryKnowledgeCapabilitiesScaffold.ok,
      contextSemanticPlanningScaffoldOk: contextSemanticPlanningScaffold.ok,
      changeGraphWorkspaceScaffoldOk: changeGraphWorkspaceScaffold.ok,
      builderOrchestrationScaffoldOk: builderOrchestrationScaffold.ok,
      verificationEngineScaffoldOk: verificationEngineScaffold.ok,
      architectUxScaffoldOk: architectUxScaffold.ok,
      appendooHardeningScaffoldOk: appendooHardeningScaffold.ok,
      goldenEvalThresholdsOk,
      proposalOutcomeTelemetryOk: proposalOutcomeTelemetry.ok,
      perceivedLatencyTelemetryOk: perceivedLatencyTelemetry.ok,
      v4QualityMetricsOk: v4QualityMetrics.ok,
      results: [...labeledResults, ...fullBatchResults, geSfUi001Gate, ...v4AgentLoopGates],
      summary,
    };
  }

  /** AE-11.9 — doc `13` scenario metadata depth + routing coverage by catalog status. */
  evaluateDoc13ScenarioDepth(): {
    metadataOk: boolean;
    routingOk: boolean;
    depth: ReturnType<typeof summarizeDoc13ScenarioDepth>;
    results: GoldenEvalRunResult[];
  } {
    const metadata = validateDoc13ScenarioDepth();
    const routingResults = GOLDEN_EVAL_SCENARIOS
      .filter((scenario) => scenario.expectedRequestClass)
      .map((scenario) => this.evaluateScenarioRouting(scenario));

    const routingOk = routingResults
      .filter((result) => result.releaseBlocking)
      .every((result) => result.passed);

    return {
      metadataOk: metadata.ok,
      routingOk,
      depth: summarizeDoc13ScenarioDepth(),
      results: routingResults,
    };
  }
}

export const goldenEvalService = new GoldenEvalService();
