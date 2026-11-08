import { WorkflowDomainError } from '../errors';
import { getActionDefinition, markActionUnavailable } from '../actions/registry';
import { listPublishedRevisionsForActionImpactScan } from '../workflowRevisionRepository';
import { countActiveInstancesByRevisionIds } from '../workflowInstanceRepository';
import { getWorkflowDefinitionById } from '../workflowDefinitionRepository';
import { disableWorkflowDefinition } from '../publication/workflowPublicationService';
import type { ResolvedActionNodeBinding } from '../publication/validationTypes';

/**
 * Package Action removal governance (doc 09 section 9, doc 11 section 14). Repository Reality
 * Audit (Slice 12): the platform's real package-manager subsystem
 * (`src/server/services/package-runtime/packageLifecycle.service.ts`) has a static
 * manifest-declared reverse-dependency check (`packageDependency.service.ts`) but no pub/sub or
 * plugin "ask other subsystems before removal" hook, and `PluginObjectRegistry` (the package
 * contribution-record system) has no Workflow-Action contribution kind — see
 * `docs/standards/workflow-engine-testing.md` for the full audit. Per doc 09 section 9's own instruction
 * ("if package subsystem lacks a canonical pre-removal impact hook, stop the package-integration
 * slice with `WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT`"), the *live wiring* into
 * `packageLifecycle.service.ts`'s uninstall flow is NOT built — there is no hook to wire into.
 *
 * What doc 11 section 14's tests actually exercise is Workflow's *own* governed-policy authority
 * over its *own* revisions/registry, which needs no external hook to exist and is fully built here:
 * impact analysis over active/startable pinned revisions, and the exact
 * `BLOCK | WARN_AND_DISABLE_NEW_STARTS | FORCE` policy semantics. A future package-manager
 * integration calls `applyActionRemovalPolicy` from inside its own pre-removal step once that hook
 * exists; until then this is a ready, tested, callable Workflow authority, not a faked stub.
 */

export type ActionRemovalImpactRow = { workflowDefinitionId: number; workflowRevisionId: number; revisionNumber: number; startable: boolean; runningInstanceCount: number };

export type ActionRemovalImpact = {
  actionKey: string;
  actionVersion: string;
  affectedRevisions: ActionRemovalImpactRow[];
};

function revisionReferencesAction(actionBindingsJson: string, actionKey: string, actionVersion: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(actionBindingsJson);
  } catch {
    return false;
  }
  // Some revisions (e.g. MANUAL_API/WEBHOOK-start `PUBLISHED/NOT_REQUIRED` candidates, doc 03
  // section 10 row 2) may not carry a resolved-array shape here; treat anything that isn't
  // literally an array of bindings as "references nothing" rather than crashing the whole scan.
  if (!Array.isArray(parsed)) return false;
  const bindings = parsed as ResolvedActionNodeBinding[];
  return bindings.some((b) => b?.actionRef?.action?.actionKey === actionKey && b?.actionRef?.action?.actionVersion === actionVersion);
}

/** Doc 09 section 9 "Before destructive package/provider removal, package management MUST invoke Workflow impact analysis." Over every `PUBLISHED` revision that references the Action, startable (new-start-eligible) or not — "active" means it still has non-terminal running instances even if disabled for new starts (doc 03 section 15, revision pinning survives definition-level disable). */
export async function analyzeActionRemovalImpact(actionKey: string, actionVersion: string): Promise<ActionRemovalImpact> {
  const publishedRevisions = await listPublishedRevisionsForActionImpactScan();
  const referencing = publishedRevisions.filter((r) => revisionReferencesAction(r.actionBindingsJson, actionKey, actionVersion));
  const runningCounts = await countActiveInstancesByRevisionIds(referencing.map((r) => r.id));

  // Doc 05 section 14: "startable" requires the binding-state check AND an ACTIVE owning
  // WorkflowDefinition lifecycle (same rule `startService.ts`'s `assertRevisionIsStartable`
  // enforces at actual Start time — this must not silently diverge from that authority).
  const definitionIds = Array.from(new Set(referencing.map((r) => r.workflowDefinitionId)));
  const definitionLifecycleById = new Map<number, string>();
  for (const id of definitionIds) {
    const def = await getWorkflowDefinitionById(id);
    if (def) definitionLifecycleById.set(id, def.lifecycleStatus);
  }

  const affectedRevisions: ActionRemovalImpactRow[] = referencing.map((r) => ({
    workflowDefinitionId: r.workflowDefinitionId,
    workflowRevisionId: r.id,
    revisionNumber: r.revisionNumber,
    startable: (r.bindingStatus === 'ACTIVE' || r.bindingStatus === 'NOT_REQUIRED') && definitionLifecycleById.get(r.workflowDefinitionId) === 'ACTIVE',
    runningInstanceCount: runningCounts.get(r.id) ?? 0,
  }));

  return { actionKey, actionVersion, affectedRevisions };
}

export type ActionRemovalPolicy = 'BLOCK' | 'WARN_AND_DISABLE_NEW_STARTS' | 'FORCE';

export type ActionRemovalPolicyInput = {
  actionKey: string;
  actionVersion: string;
  policy: ActionRemovalPolicy;
  /** Doc 09 section 9 — FORCE "requires elevated destructive-change authorization and explicit impact acknowledgement." A minimal proxy for that acknowledgement, matching the existing `ForceNewInvocation`'s `acknowledgeDuplicateEffectRisk` precedent (`operationalCommands.ts`) — full authz/audit is doc 09 territory and not built (same carried-forward gap as every operational command since Slice 5). */
  forceAcknowledgement?: { acknowledged: boolean; authorizedBy: string };
  /** Doc 09 section 9 "requires explicit operator confirmation before provider removal" — WARN_AND_DISABLE_NEW_STARTS only disables affected definitions on this call; the caller passes `confirmProviderRemoval: true` on a *second*, separate call once ready to actually FORCE-remove (this function never chains the two itself). */
  disableExpectedDefinitionStateVersions?: Record<number, number>;
};

export type ActionRemovalPolicyResult = {
  policy: ActionRemovalPolicy;
  impact: ActionRemovalImpact;
  disabledDefinitionIds: number[];
  markedUnavailable: boolean;
};

/**
 * Doc 09 section 9's exact governed policy. Every branch starts with the same impact analysis so
 * the decision is always made against current data, never stale/assumed impact.
 */
export async function applyActionRemovalPolicy(input: ActionRemovalPolicyInput): Promise<ActionRemovalPolicyResult> {
  const impact = await analyzeActionRemovalImpact(input.actionKey, input.actionVersion);
  const hasActiveOrStartableDependents = impact.affectedRevisions.some((r) => r.startable || r.runningInstanceCount > 0);

  if (input.policy === 'BLOCK') {
    if (hasActiveOrStartableDependents) {
      // No doc 03 section 14/30 code names "action removal blocked" exactly; `WF_ACTION_IMPLEMENTATION_UNAVAILABLE`
      // is the closest registered semantic match ("this Action would become unavailable to currently-dependent
      // active/startable revisions") and reuses the canonical registry rather than inventing a 34th code.
      throw new WorkflowDomainError('WF_ACTION_IMPLEMENTATION_UNAVAILABLE', `Action ${input.actionKey}@${input.actionVersion} is BLOCKed from removal: ${impact.affectedRevisions.length} PUBLISHED revision(s) still depend on it.`, { impact });
    }
    return { policy: 'BLOCK', impact, disabledDefinitionIds: [], markedUnavailable: false };
  }

  if (input.policy === 'WARN_AND_DISABLE_NEW_STARTS') {
    const startableDefinitionIds = Array.from(new Set(impact.affectedRevisions.filter((r) => r.startable).map((r) => r.workflowDefinitionId)));
    const disabledDefinitionIds: number[] = [];
    for (const definitionId of startableDefinitionIds) {
      const expectedVersion = input.disableExpectedDefinitionStateVersions?.[definitionId];
      if (expectedVersion === undefined) {
        throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `WARN_AND_DISABLE_NEW_STARTS requires an expectedDefinitionStateVersion for WorkflowDefinition #${definitionId}.`, { definitionId });
      }
      await disableWorkflowDefinition(definitionId, expectedVersion);
      disabledDefinitionIds.push(definitionId);
    }
    // Running instances are deliberately left untouched (doc 09 section 9 "preserves running instances") — provider removal itself does not happen under this policy; it requires the caller's later, separate explicit-confirmation FORCE call.
    return { policy: 'WARN_AND_DISABLE_NEW_STARTS', impact, disabledDefinitionIds, markedUnavailable: false };
  }

  // FORCE
  if (!input.forceAcknowledgement?.acknowledged || !input.forceAcknowledgement.authorizedBy) {
    throw new WorkflowDomainError('WF_AUTH_FORBIDDEN', 'FORCE removal requires elevated destructive-change authorization and explicit impact acknowledgement.', { actionKey: input.actionKey, actionVersion: input.actionVersion });
  }
  const registered = getActionDefinition(input.actionKey, input.actionVersion);
  if (!registered) {
    throw new WorkflowDomainError('WF_ACTION_IMPLEMENTATION_UNAVAILABLE', `Action ${input.actionKey}@${input.actionVersion} is not registered.`, { actionKey: input.actionKey, actionVersion: input.actionVersion });
  }
  markActionUnavailable(input.actionKey, input.actionVersion);
  // Any running pinned revision that later dispatches a node bound to this Action now fails at
  // `resolveExactProvider`/`resolveCapabilityProvider` with `WF_ACTION_IMPLEMENTATION_UNAVAILABLE`
  // (registry.ts, unchanged) — exactly doc 09 section 9's required runtime failure mode; no new
  // dispatch-path code is needed for that half of FORCE.
  return { policy: 'FORCE', impact, disabledDefinitionIds: [], markedUnavailable: true };
}
