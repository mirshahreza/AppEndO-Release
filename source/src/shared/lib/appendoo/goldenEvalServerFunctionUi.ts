import type { GoldenEvalEvidence } from '../../api/contracts/appendoo/semanticPlanAuthority.types';
import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import { MATH_SUM_TWO_NUMBERS_FIXTURE } from './serverFunctionContractFixtures';
import { buildSemanticPlan } from './semanticPlanBuilder';
import {
  resolvePlanActionPolicy,
  assertChangeGraphCompileAllowed,
  evaluateAspCompletionGate,
  assertBuilderInputSufficient,
} from './semanticPlanAuthorityGates';
import {
  ChangeGraphCompileForbiddenError,
  compileChangeGraphFromPlan,
} from './changeGraphCompiler';
import { serverFunctionsScope } from '../../../server/services/ai/__tests__/e2eEngineeringPipeline.helpers';

export const GE_SF_UI_001_SCENARIO_ID = 'GE-SF-UI-001';

export const GE_SF_UI_001_PROMPT = `Build a UI for Server Function ${MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId}`;

export const buildGeSfUi001ContextPack = (): ContextPack => ({
  contextPackId: 'ctxpack:ge-sf-ui-001',
  revision: 1,
  applicationScopeRef: 'platform:studio:page:server-functions',
  indexVersions: { knowledgeRegistry: '1', retrievalPolicy: '1' },
  tokenBudget: 8000,
  primaryTargets: [{
    targetId: `function:${MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId}`,
    kind: 'function',
    label: MATH_SUM_TWO_NUMBERS_FIXTURE.displayName,
    ref: MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId,
  }],
  dependencies: [],
  governance: [],
  businessRules: [],
  permissions: [...MATH_SUM_TWO_NUMBERS_FIXTURE.permissions],
  structuralEvidence: [
    `contract:${MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId}:input`,
    `contract:${MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId}:output`,
    `contract:${MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId}:errors`,
  ],
  similarImplementations: [MATH_SUM_TWO_NUMBERS_FIXTURE.analogousUiRef],
  trustedPatterns: [],
  engineeringStandards: [],
  capabilityEvidence: ['capability:appendo-server-functions'],
  capabilityGaps: [],
  relevantChanges: [],
  excludedCandidates: [],
  unresolvedTerms: [],
  conflicts: [],
  selectionExplanations: [{
    reasonCode: 'EXACT_TARGET',
    evidenceId: `function:${MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId}`,
    summary: 'Exact server function target.',
  }],
});

export type GeSfUi001EvalResult = {
  passed: boolean;
  releaseBlocking: boolean;
  failures: string[];
  evidence: GoldenEvalEvidence;
};

export const evaluateGeSfUi001Scenario = (): GeSfUi001EvalResult => {
  const failures: string[] = [];
  const contextPack = buildGeSfUi001ContextPack();
  const plan = buildSemanticPlan({
    applicationScope: serverFunctionsScope(),
    contextPack,
    userPrompt: GE_SF_UI_001_PROMPT,
  });

  if (plan.authority === 'SCAFFOLD') {
    failures.push('ENGINEERING_SEMANTIC_PIPELINE_BYPASS: plan remained scaffold.');
  }
  if (plan.status !== 'READY_FOR_APPROVAL') {
    failures.push(`Expected READY_FOR_APPROVAL, got ${plan.status ?? 'undefined'}.`);
  }
  if (!plan.uiSemanticDesign) {
    failures.push('ASP missing UISemanticDesign.');
  }
  if (!plan.resolvedTargetBindings?.some((binding) => (
    binding.canonicalId === MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId
  ))) {
    failures.push('Exact server function target not resolved.');
  }
  if (!plan.uiSemanticDesign?.inputBindings.every((binding) => binding.contractPath)) {
    failures.push('Input bindings incomplete.');
  }
  if (!plan.uiSemanticDesign?.outputBindings.length) {
    failures.push('Output rendering not specified.');
  }
  if (!plan.uiSemanticDesign?.states.loading || !plan.uiSemanticDesign.states.success) {
    failures.push('UI state model incomplete.');
  }

  const actionPolicy = resolvePlanActionPolicy(plan);
  if (actionPolicy.canApprove && !(plan.validation?.ok ?? false)) {
    failures.push('Premature approval: policy allows approve without validation.');
  }

  const scaffoldPlan = {
    ...plan,
    authority: 'SCAFFOLD' as const,
    producer: 'scaffold' as const,
  };
  if (assertChangeGraphCompileAllowed(scaffoldPlan).ok) {
    failures.push('Scaffold plan incorrectly allowed change graph compile.');
  }

  let compileBlockedForScaffold = false;
  try {
    compileChangeGraphFromPlan(scaffoldPlan);
  } catch (error) {
    if (error instanceof ChangeGraphCompileForbiddenError) {
      compileBlockedForScaffold = true;
    }
  }
  if (!compileBlockedForScaffold) {
    failures.push('Change graph compiled from scaffold.');
  }

  const builderCheck = assertBuilderInputSufficient(plan, 'CREATE_PAGE');
  if (!builderCheck.ok) {
    failures.push(`Builder input insufficient: ${builderCheck.errors.join(' ')}`);
  }

  const aspBlockers = evaluateAspCompletionGate(plan);
  if (aspBlockers.some((blocker) => blocker.materiality === 'BLOCKING')) {
    failures.push(`ASP blocking issues: ${aspBlockers.map((blocker) => blocker.code).join(', ')}`);
  }

  let changeGraphSnapshot: unknown;
  if (plan.validation?.ok) {
    try {
      changeGraphSnapshot = compileChangeGraphFromPlan(plan);
    } catch (error) {
      failures.push(`Validated plan failed compile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const evidence: GoldenEvalEvidence = {
    scenarioId: GE_SF_UI_001_SCENARIO_ID,
    prompt: GE_SF_UI_001_PROMPT,
    intentSnapshot: { prompt: GE_SF_UI_001_PROMPT, target: MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId },
    contextPackSnapshot: contextPack,
    planSnapshot: plan,
    validationReport: plan.validation,
    changeGraphSnapshot,
    stageMetrics: {
      targetBindingCoverage: plan.evidenceMetrics?.targetBindingCoverage ?? 0,
      materialDecisionEvidenceCoverage: plan.evidenceMetrics?.materialDecisionEvidenceCoverage ?? 0,
    },
    failureCodes: failures,
  };

  return {
    passed: failures.length === 0,
    releaseBlocking: true,
    failures,
    evidence,
  };
};
