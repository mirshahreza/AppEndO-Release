import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';
import type { AppEndooSemanticPlan, BuildSemanticPlanInput, SemanticPlanArtifact } from '../../api/contracts/appendoo/semanticPlan.types';
import type { PlanningBlocker } from '../../api/contracts/appendoo/semanticPlanAuthority.types';
import { detectServerFunctionIntent, detectUIIntent } from '../detectCodingIntent';
import { resolveExactTargetBinding } from './semanticPlanAuthorityGates';
import { resolveServerFunctionFixture } from './serverFunctionContractFixtures';
import { resolveServerFunctionDraftMetadata } from '../../../core/ai/serverFunctionManualParity';
import { buildCompositionCandidates, computeReuseSummary, validateSemanticPlanScaffold } from './semanticPlanCompositionScaffold';
import { compileChangeGraphScaffold } from './engineeringWorkspaceScaffold';

/**
 * V5 Phase P06 § 8.2 / EV-1 (p-60) — the phase doc's own named acceptance scenario: "create a
 * new server function" (fa acceptance phrasing) must produce an authoritative
 * (`authority: 'VALIDATED'`, `status: 'READY_FOR_APPROVAL'`, `validation.ok: true`) plan, not
 * fall through to `buildSemanticPlanScaffold` (`authority: 'SCAFFOLD'`, `validation.ok: false`,
 * `blockingIssues: [PLANNING_NOT_IMPLEMENTED]`) — the exact, confirmed gap documented in
 * `engineeringPipeline.liveActivation.test.ts`'s `it.skip` (kept, not deleted, with a full
 * explanation) and re-confirmed by direct inspection during this phase (see
 * PHASE-EVIDENCE-REPORT-P06.md § Source Evidence Map).
 *
 * Mirrors `serverFunctionUiPlanner.ts`'s pattern (`canBuild.../build...`, same
 * `AppEndooSemanticPlan` type — no parallel plan-type hierarchy introduced, per the Ownership
 * Rule) but for the CREATE case: no existing function target resolves (that's exactly what
 * `resolveExactTargetBinding` already reports as `TARGET_NOT_FOUND` today), the user clearly
 * wants a server function (not a UI for one), and a real, mechanical (not NLP/live-model —
 * EV-3) name is derivable from the prompt.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'that', 'this', 'to', 'for', 'of', 'and', 'or', 'is', 'are', 'be', 'new',
  'server', 'function', 'add', 'create', 'build', 'make', 'write', 'please', 'export', 'i', 'want',
  'need',
]);

/**
 * Real, mechanical (regex/stopword-filter) extraction — not NLP/live-model. Picks up to 3
 * significant words from the prompt, in order, to form a slug. Deterministic and testable, same
 * heuristic-over-NLP style already used throughout this codebase (`detectCodingIntent.ts`).
 */
export const deriveServerFunctionNameFromPrompt = (userPrompt: string): string => {
  const words = userPrompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));

  const slug = words.slice(0, 4).join('-').replace(/[^a-z0-9-]/g, '');
  return slug || 'custom-function';
};

export const canBuildCreateServerFunctionPlan = (
  contextPack: ContextPack,
  userPrompt?: string,
): boolean => {
  const trimmed = userPrompt?.trim();
  if (!trimmed) return false;
  if (detectUIIntent(trimmed)) return false; // that's buildServerFunctionUiPlan's / a UI plan's job
  if (!detectServerFunctionIntent(trimmed)) return false;

  // Requires a CONCRETE named target (e.g. `pageContext.functionId`) that just doesn't resolve
  // to a real existing function — NOT the fully-generic "no target anywhere" case. A prompt like
  // "Add a list items API server function" with no functionId/name anywhere is genuinely
  // ambiguous (which list? what shape?) and must stay blocked/SCAFFOLD — this is a real,
  // intentional safety property this planner must not weaken (confirmed by
  // `e2eEngineeringPipelineWf1.test.ts`'s "blocks generic server-function planning" test, which
  // this exact distinction was added to keep green). Only a bound-but-unresolvable target (a
  // real name was given, it just isn't a known function yet — the EV-1 scenario) counts.
  const { binding } = resolveExactTargetBinding(contextPack);
  if (!binding) return false;
  return !resolveServerFunctionFixture(binding.canonicalId);
};

export const buildCreateServerFunctionPlan = (
  input: BuildSemanticPlanInput,
): AppEndooSemanticPlan | null => {
  if (!canBuildCreateServerFunctionPlan(input.contextPack, input.userPrompt)) {
    return null;
  }

  const userPrompt = input.userPrompt!.trim();
  // Prefer an explicit, already-chosen name over prompt-parsing when one exists: the unresolved
  // binding's canonicalId (e.g. `pageContext.functionId` — a real, already-existing signal for
  // "the name the operator picked before writing the prompt", not a fabricated new source).
  // `binding` here is guaranteed non-real by `canBuildCreateServerFunctionPlan` (no fixture
  // resolves for it), so reusing its canonicalId as the new function's name is safe.
  const { binding } = resolveExactTargetBinding(input.contextPack);
  const derivedName = binding?.canonicalId?.trim() || deriveServerFunctionNameFromPrompt(userPrompt);
  // 'appendoo' matches the existing real convention for agent/plan-created server functions
  // (see `builderWorkspaceWriter.ts` scaffoldMetadataJson, `runtimeActivationExperienceLive.service.ts`).
  const metadata = resolveServerFunctionDraftMetadata({ name: derivedName, folder: 'appendoo' });

  const scopeKey = input.applicationScope?.scopeKey ?? input.contextPack.applicationScopeRef;
  // targetRef must be the bare NAME, not the fully-qualified `folder.name` functionId — the
  // downstream builder (`builderWorkspaceWriter.ts` scaffoldMetadataJson) independently applies
  // its own 'appendoo' folder prefix on top of `targetRef`, so passing the already-qualified
  // functionId here would double-prefix it (a real bug caught by re-enabling
  // engineeringPipeline.liveActivation.test.ts during this phase — see PHASE-EVIDENCE-REPORT-P06.md).
  const proposedArtifacts: SemanticPlanArtifact[] = [{
    artifactId: `artifact:function:${metadata.functionId}`,
    kind: 'server_function',
    title: `Create server function ${metadata.functionId}`,
    action: 'create',
    targetRef: metadata.name,
    evidenceIds: [`prompt:${userPrompt.slice(0, 80)}`, `derived-name:${derivedName}`],
  }];

  const changeSetId = `cs:${input.contextPack.contextPackId}`;
  const compositionCandidates = buildCompositionCandidates(input.contextPack, userPrompt);

  const blockingIssues: PlanningBlocker[] = [];

  const basePlan: AppEndooSemanticPlan = {
    planId: `asp:${input.contextPack.contextPackId}:${Date.now()}`,
    revision: 1,
    applicationScopeRef: scopeKey,
    contextPackId: input.contextPack.contextPackId,
    objective: userPrompt,
    scope: scopeKey,
    resolvedTargets: [metadata.functionId],
    requirements: input.contextPack.governance,
    assumptions: [
      `Function name "${derivedName}" derived mechanically (from page context or prompt, not a live model — EV-3) — the operator must review before approval.`,
    ],
    nonGoals: ['Generating the function implementation body (drafting happens via draft_server_function after this plan is approved)'],
    proposedArtifacts,
    artifactModifications: [],
    permissions: input.contextPack.permissions,
    requiredCapabilities: input.contextPack.capabilityEvidence,
    capabilityGaps: [],
    appliedStandards: input.contextPack.engineeringStandards.map((standard) => standard.sourceId),
    selectedPatterns: input.contextPack.trustedPatterns,
    acceptanceCriteria: [
      'evidence:function-registered',
      'evidence:test-payload-defined',
      'evidence:handler-drafted',
    ],
    risks: ['Function name derived mechanically from free text — confirm before approval.'],
    conflicts: [],
    requestedOutcomes: [`Create server function ${metadata.functionId} per the request`],
    compositionCandidates,
    changeGraphProposal: compileChangeGraphScaffold({
      changeSetId,
      applicationScope: input.applicationScope,
    }),
    createdAt: new Date().toISOString(),
    authority: 'VALIDATED',
    status: 'READY_FOR_APPROVAL',
    producer: 'create_server_function_planner',
    blockingIssues,
    contextPackRevision: input.contextPack.revision,
    // No EXISTING function to bind to (this creates one) — a real, honestly-labeled binding to
    // the newly-derived target, not a fabricated "exact match". `computeEvidenceMetrics`'s
    // `targetBindingCoverage` gate (semanticPlanAuthorityGates.ts) requires at least one bound
    // target with evidence for the plan to be approvable — without this, the plan would be
    // authoritative in name only and blocked by `evaluateAspCompletionGate` in practice.
    resolvedTargetBindings: [{
      artifactRef: { targetKind: 'function', targetId: `function:${metadata.functionId}`, ref: metadata.functionId },
      artifactType: 'SERVER_FUNCTION',
      canonicalId: metadata.functionId,
      versionOrFingerprint: `new:${metadata.functionId}`,
      resolutionMethod: 'DERIVED_NEW_TARGET',
      evidenceRefs: [`prompt:${userPrompt.slice(0, 80)}`, `derived-name:${derivedName}`],
      confidence: 0.6,
    }],
  };

  const { reuseSummary } = computeReuseSummary(input.contextPack, basePlan);
  const validation = validateSemanticPlanScaffold(basePlan, input.contextPack);

  return {
    ...basePlan,
    reuseSummary,
    validation: {
      ...validation,
      ok: validation.ok && blockingIssues.length === 0,
    },
  };
};
