import type { ApplicationScopeRef } from '../../api/contracts/appendoo/applicationScope.types';
import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import type {
  AppEndooSemanticPlan,
  BuildSemanticPlanInput,
  SemanticPlanArtifact,
} from '../../api/contracts/appendoo/semanticPlan.types';
import type {
  PlanDecision,
  RequestedOutcome,
  UISemanticDesign,
} from '../../api/contracts/appendoo/semanticPlanAuthority.types';
import { detectUIIntent } from '../detectCodingIntent';
import {
  evaluateContextSufficiencyGate,
  resolveExactTargetBinding,
  resolveFunctionTargets,
} from './semanticPlanAuthorityGates';
import {
  enrichContextPackForServerFunctionFixture,
  resolveServerFunctionFixture,
} from './serverFunctionContractFixtures';
import {
  buildCompositionCandidates,
  computeReuseSummary,
  validateSemanticPlanScaffold,
} from './semanticPlanCompositionScaffold';
import { compileChangeGraphScaffold } from './engineeringWorkspaceScaffold';

const slugifyUiTarget = (functionRef: string): string => (
  `${functionRef.trim().toLowerCase().replace(/\./g, '-').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')}-calculator`
);

const buildUiSemanticDesign = (
  fixture: NonNullable<ReturnType<typeof resolveServerFunctionFixture>>,
): UISemanticDesign => {
  const evidenceRefs = [
    `function:${fixture.canonicalId}`,
    `contract:${fixture.canonicalId}:input`,
    `contract:${fixture.canonicalId}:output`,
    fixture.analogousUiRef,
  ];

  return {
    purpose: `Operator UI to execute ${fixture.displayName}`,
    userOutcome: 'Submit inputs and view the computed result.',
    boundOperations: [{
      serverFunctionRef: {
        targetKind: 'function',
        targetId: `function:${fixture.canonicalId}`,
        ref: fixture.canonicalId,
      },
      fingerprint: fixture.fingerprint,
      inputContractRef: `contract:${fixture.canonicalId}:input`,
      outputContractRef: `contract:${fixture.canonicalId}:output`,
      errorContractRefs: fixture.errors.map((error) => `error:${fixture.canonicalId}:${error.code}`),
      permissionRefs: fixture.permissions,
    }],
    interactionModel: {
      trigger: 'User opens calculator page and fills the form.',
      inputFlow: fixture.inputFields.map((field) => `Collect ${field.label}`),
      submissionBehavior: 'Validate required fields then invoke server function.',
      resultBehavior: 'Render numeric result and expression summary.',
    },
    inputBindings: fixture.inputFields.map((field) => ({
      fieldId: field.fieldId,
      contractPath: field.contractPath,
      label: field.label,
      required: field.required,
    })),
    outputBindings: fixture.outputFields.map((field) => ({
      outputId: field.fieldId,
      contractPath: field.contractPath,
      renderAs: field.type === 'number' ? 'text' : field.type === 'object' ? 'json' : 'text',
    })),
    states: {
      initial: {
        label: 'Ready',
        userVisibleMessage: 'Enter values to calculate.',
        evidenceRefs,
      },
      loading: {
        label: 'Loading',
        userVisibleMessage: 'Running server function…',
        evidenceRefs,
      },
      success: {
        label: 'Success',
        userVisibleMessage: 'Result is shown below.',
        evidenceRefs,
      },
      validationError: {
        label: 'Validation error',
        userVisibleMessage: fixture.errors[0]?.message ?? 'Fix the highlighted fields.',
        evidenceRefs: [`error:${fixture.canonicalId}:VALIDATION_ERROR`],
      },
      operationError: {
        label: 'Operation error',
        userVisibleMessage: 'The server function failed.',
        evidenceRefs: [`error:${fixture.canonicalId}:VALIDATION_ERROR`],
      },
      permissionDenied: {
        label: 'Permission denied',
        userVisibleMessage: 'You do not have permission to run this function.',
        evidenceRefs: fixture.permissions,
      },
    },
    actions: [
      {
        actionId: 'submit',
        label: 'Calculate',
        trigger: 'submit',
        evidenceRefs,
      },
      {
        actionId: 'reset',
        label: 'Reset',
        trigger: 'reset',
        evidenceRefs,
      },
    ],
    placement: {
      artifactKind: 'PAGE',
      route: `/studio/server-functions/${fixture.canonicalId.replace('.', '/')}`,
      portal: 'studio',
      rationale: `Evidence-backed placement near ${fixture.canonicalId} using ${fixture.analogousUiRef}.`,
    },
    permissions: fixture.permissions.map((permissionId) => ({
      permissionId,
      behavior: 'disable',
      evidenceRefs: [permissionId],
    })),
    responsiveRequirements: ['Stack inputs on phone', 'Preserve label-over-input spacing'],
    accessibilityRequirements: ['Associate labels with inputs', 'Announce result changes'],
    rtlRequirements: ['Support RTL form layout'],
    evidenceRefs,
  };
};

const buildRequestedOutcome = (
  fixture: NonNullable<ReturnType<typeof resolveServerFunctionFixture>>,
): RequestedOutcome => ({
  actor: 'operator',
  goal: `Manually execute ${fixture.displayName}`,
  successMeaning: 'User sees the computed result after submitting valid inputs.',
  interactionExpectation: 'Form with submit and visible result.',
  confidence: 1,
  evidenceRefs: [`function:${fixture.canonicalId}`, fixture.analogousUiRef],
});

const buildPlanDecisions = (
  fixture: NonNullable<ReturnType<typeof resolveServerFunctionFixture>>,
  design: UISemanticDesign,
): PlanDecision[] => [
  {
    decisionId: 'placement',
    kind: 'placement',
    value: design.placement,
    evidenceRefs: [fixture.analogousUiRef],
    inferenceClass: 'DETERMINISTIC',
  },
  {
    decisionId: 'operation-binding',
    kind: 'bound-operation',
    value: design.boundOperations[0],
    evidenceRefs: [`contract:${fixture.canonicalId}:input`, `contract:${fixture.canonicalId}:output`],
    inferenceClass: 'DETERMINISTIC',
  },
];

export const canBuildServerFunctionUiPlan = (
  contextPack: ContextPack,
  userPrompt?: string,
): boolean => {
  if (!userPrompt?.trim() || !detectUIIntent(userPrompt)) {
    return false;
  }
  const { binding, blockers } = resolveExactTargetBinding(contextPack);
  if (!binding || blockers.length > 0) {
    return false;
  }
  return Boolean(resolveServerFunctionFixture(binding.canonicalId));
};

export const buildServerFunctionUiPlan = (
  input: BuildSemanticPlanInput,
): AppEndooSemanticPlan | null => {
  const enrichedPack = (() => {
    const functionTargets = resolveFunctionTargets(input.contextPack);
    const canonicalId = functionTargets[0]?.ref?.trim();
    const fixture = canonicalId ? resolveServerFunctionFixture(canonicalId) : undefined;
    return fixture
      ? enrichContextPackForServerFunctionFixture(input.contextPack, fixture)
      : input.contextPack;
  })();

  if (!canBuildServerFunctionUiPlan(enrichedPack, input.userPrompt)) {
    return null;
  }

  const { binding, blockers: targetBlockers } = resolveExactTargetBinding(enrichedPack);
  if (!binding) {
    return null;
  }

  const fixture = resolveServerFunctionFixture(binding.canonicalId);
  if (!fixture) {
    return null;
  }

  const contextBlockers = evaluateContextSufficiencyGate(enrichedPack, binding);
  const blockingIssues = [...targetBlockers, ...contextBlockers];
  if (blockingIssues.some((blocker) => blocker.materiality === 'BLOCKING')) {
    return null;
  }

  const scopeKey = input.applicationScope?.scopeKey ?? enrichedPack.applicationScopeRef;
  const uiTargetRef = slugifyUiTarget(fixture.canonicalId);
  const uiSemanticDesign = buildUiSemanticDesign(fixture);
  const requestedOutcome = buildRequestedOutcome(fixture);
  const proposedArtifacts: SemanticPlanArtifact[] = [{
    artifactId: `artifact:page:${uiTargetRef}`,
    kind: 'page',
    title: `UI for ${fixture.displayName}`,
    action: 'create',
    targetRef: uiTargetRef,
    evidenceIds: [
      binding.targetId,
      `function:${fixture.canonicalId}`,
      `contract:${fixture.canonicalId}:input`,
      `contract:${fixture.canonicalId}:output`,
      fixture.analogousUiRef,
    ],
  }];

  const changeSetId = `cs:${enrichedPack.contextPackId}`;
  const compositionCandidates = buildCompositionCandidates(enrichedPack, input.userPrompt);

  const basePlan: AppEndooSemanticPlan = {
    planId: `asp:${enrichedPack.contextPackId}:${Date.now()}`,
    revision: 1,
    applicationScopeRef: scopeKey,
    contextPackId: enrichedPack.contextPackId,
    objective: input.userPrompt?.trim() || `Build UI for ${fixture.canonicalId}`,
    scope: scopeKey,
    resolvedTargets: [binding.targetId],
    requirements: enrichedPack.governance,
    assumptions: [],
    nonGoals: ['Generic placeholder UI'],
    proposedArtifacts,
    artifactModifications: [],
    permissions: enrichedPack.permissions,
    requiredCapabilities: enrichedPack.capabilityEvidence,
    capabilityGaps: [],
    appliedStandards: enrichedPack.engineeringStandards.map((standard) => standard.sourceId),
    selectedPatterns: enrichedPack.trustedPatterns,
    acceptanceCriteria: [
      'evidence:inputs-bound',
      'evidence:outputs-rendered',
      'evidence:loading-state',
      'evidence:error-state',
      'evidence:permission-behavior',
      'evidence:placement',
    ],
    risks: [],
    conflicts: [],
    requestedOutcomes: [requestedOutcome.goal],
    compositionCandidates,
    changeGraphProposal: compileChangeGraphScaffold({
      changeSetId,
      applicationScope: input.applicationScope,
    }),
    createdAt: new Date().toISOString(),
    authority: 'VALIDATED',
    status: 'READY_FOR_APPROVAL',
    producer: 'server_function_ui_planner',
    resolvedTargetBindings: [binding],
    requestedOutcome,
    uiSemanticDesign,
    planDecisions: buildPlanDecisions(fixture, uiSemanticDesign),
    blockingIssues: [],
    validationFingerprint: `vf:${fixture.fingerprint}:${enrichedPack.revision}`,
    contextPackRevision: enrichedPack.revision,
  };

  const { reuseSummary } = computeReuseSummary(enrichedPack, basePlan);
  const validation = validateSemanticPlanScaffold(basePlan, enrichedPack);

  return {
    ...basePlan,
    reuseSummary,
    validation: {
      ...validation,
      ok: validation.ok && blockingIssues.length === 0,
    },
  };
};

export const enrichContextPackForServerFunctionUiPlanning = (
  pack: ContextPack,
): ContextPack => {
  const functionTargets = resolveFunctionTargets(pack);
  const canonicalId = functionTargets[0]?.ref?.trim();
  const fixture = canonicalId ? resolveServerFunctionFixture(canonicalId) : undefined;
  return fixture ? enrichContextPackForServerFunctionFixture(pack, fixture) : pack;
};

export type ServerFunctionUiPlanningApplicationScope = ApplicationScopeRef | null;
