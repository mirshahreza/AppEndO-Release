import { WorkflowDomainError } from '../errors';
import { actionDefinitionSchema } from './schemas';
import { computeActionDefinitionFingerprint } from './fingerprint';
import type { ActionDefinition, ActionProviderRegistration, ActionContributorType } from './types';

/**
 * Trusted in-process Action Registry — sole authority per
 * docs/standards/workflow-engine-testing.md (doc 04 §3)
 * trusted contributions (server boot code only — never a public write endpoint), enforces exact
 * key/version uniqueness, computes fingerprints, and resolves providers per section 7. Executable
 * implementation is never duplicated in the database (doc 03 section 19) — this Map *is* the
 * executable authority; any DB projection is a read-only cache of this registry's safe metadata.
 */

const CONTRIBUTOR_TYPE_ORDER: Record<ActionContributorType, number> = { CORE: 0, PLATFORM: 1, PACKAGE: 2 };
const DEFAULT_REGISTRY_PRIORITY = 1000;

const actionKey = (key: string, version: string): string => `${key}@${version}`;

type RegisteredDefinition = { definition: ActionDefinition; fingerprint: string };

const definitions = new Map<string, RegisteredDefinition>();
const providers = new Map<string, ActionProviderRegistration[]>();

/** Test-only reset — the registry is otherwise append-only for the lifetime of the process (boot-time registration). */
export function __resetActionRegistryForTests(): void {
  definitions.clear();
  providers.clear();
}

export function registerActionDefinition(definition: ActionDefinition): { definition: ActionDefinition; fingerprint: string } {
  const parsed = actionDefinitionSchema.parse(definition);
  const key = actionKey(parsed.key, parsed.version);
  if (definitions.has(key)) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Action ${key} is already registered (exact key/version uniqueness).`, { actionKey: parsed.key, actionVersion: parsed.version });
  }
  const fingerprint = computeActionDefinitionFingerprint(parsed as ActionDefinition);
  definitions.set(key, { definition: parsed as ActionDefinition, fingerprint });
  return { definition: parsed as ActionDefinition, fingerprint };
}

export function registerActionProvider(registration: ActionProviderRegistration): void {
  const key = actionKey(registration.actionKey, registration.actionVersion);
  if (!definitions.has(key)) {
    throw new WorkflowDomainError('WF_DEF_ACTION_UNAVAILABLE', `Cannot register a provider for unregistered Action ${key}.`, registration);
  }
  const existing = providers.get(key) ?? [];
  const duplicate = existing.some((p) => p.providerId === registration.providerId && p.providerVersion === registration.providerVersion);
  if (duplicate) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Provider ${registration.providerId}@${registration.providerVersion} is already registered for Action ${key}.`, registration);
  }
  providers.set(key, [...existing, registration]);
}

export function getActionDefinition(key: string, version: string): RegisteredDefinition | undefined {
  return definitions.get(actionKey(key, version));
}

/**
 * Governed FORCE package/provider removal (Slice 12, doc 09 section 9): "Running pinned revisions
 * that later reach missing Action fail with `WF_ACTION_IMPLEMENTATION_UNAVAILABLE`." The registry
 * is otherwise append-only (boot-time registration, see module doc) — this is the one narrow,
 * intentional runtime mutation doc 09 section 9 requires, and it is exactly what already makes
 * `resolveExactProvider`/`resolveCapabilityProvider` throw `WF_ACTION_IMPLEMENTATION_UNAVAILABLE`
 * for any subsequent dispatch, with no other code path needing to change (Slice 3's registry design
 * already gates every resolution call on `availability === 'AVAILABLE'`). Only
 * `packageActionRemovalService.ts`'s `applyActionRemovalPolicy('FORCE', ...)` calls this — it is
 * not a public write endpoint.
 */
export function markActionUnavailable(actionKeyValue: string, actionVersion: string): void {
  const key = actionKey(actionKeyValue, actionVersion);
  const existing = definitions.get(key);
  if (!existing || existing.definition.availability === 'UNAVAILABLE') return;
  const nextDefinition: ActionDefinition = { ...existing.definition, availability: 'UNAVAILABLE' };
  definitions.set(key, { definition: nextDefinition, fingerprint: computeActionDefinitionFingerprint(nextDefinition) });
}

/** Authorized read projection (doc 04 section 3) — safe metadata only, never executable authority. */
export function listAvailableActionDefinitions(): ActionDefinition[] {
  return Array.from(definitions.values())
    .map((d) => d.definition)
    .filter((d) => d.availability === 'AVAILABLE');
}

export function resolveExactProvider(actionKeyValue: string, actionVersion: string, providerId: string, providerVersion: string): ActionProviderRegistration {
  const registered = getActionDefinition(actionKeyValue, actionVersion);
  if (!registered || registered.definition.availability !== 'AVAILABLE') {
    throw new WorkflowDomainError('WF_ACTION_IMPLEMENTATION_UNAVAILABLE', `Action ${actionKeyValue}@${actionVersion} is not available.`, { actionKeyValue, actionVersion });
  }
  const candidates = providers.get(actionKey(actionKeyValue, actionVersion)) ?? [];
  const found = candidates.find((p) => p.providerId === providerId && p.providerVersion === providerVersion);
  if (!found) {
    throw new WorkflowDomainError('WF_ACTION_IMPLEMENTATION_UNAVAILABLE', `Provider ${providerId}@${providerVersion} is not registered for Action ${actionKeyValue}@${actionVersion}.`, { providerId, providerVersion });
  }
  return found;
}

export type CapabilityResolutionResult = {
  winner: ActionProviderRegistration;
  rejectedHigherRanked: Array<{ providerId: string; providerVersion: string; reason: string }>;
};

/**
 * Doc 04 section 7 — exact tuple ordering: `registryPriority ASC, contributorTypeOrder ASC,
 * contributorId ASC, providerKey (providerId) ASC, providerVersion ASC`. Ordinal string
 * comparison throughout. Exact tuple ties are a registry validation error, not a silent pick.
 * `isAuthorized` is a caller-supplied predicate — authorization/capability-satisfaction policy
 * itself is doc 09 territory, out of Slice 3 scope; this function is the deterministic-ordering
 * authority only.
 */
export function resolveCapabilityProvider(
  actionKeyValue: string,
  actionVersion: string,
  requiredCapabilities: readonly string[],
  isAuthorized: (provider: ActionProviderRegistration) => boolean,
): CapabilityResolutionResult {
  const registered = getActionDefinition(actionKeyValue, actionVersion);
  if (!registered || registered.definition.availability !== 'AVAILABLE') {
    throw new WorkflowDomainError('WF_ACTION_IMPLEMENTATION_UNAVAILABLE', `Action ${actionKeyValue}@${actionVersion} is not available.`, { actionKeyValue, actionVersion });
  }
  const candidates = providers.get(actionKey(actionKeyValue, actionVersion)) ?? [];
  const requiredSet = new Set(requiredCapabilities);

  const rejected: Array<{ providerId: string; providerVersion: string; reason: string }> = [];
  const eligible = candidates.filter((p) => {
    const satisfiesCapabilities = Array.from(requiredSet).every((c) => p.providesCapabilities.includes(c));
    if (!satisfiesCapabilities) {
      rejected.push({ providerId: p.providerId, providerVersion: p.providerVersion, reason: 'CAPABILITY_NOT_SATISFIED' });
      return false;
    }
    if (!isAuthorized(p)) {
      rejected.push({ providerId: p.providerId, providerVersion: p.providerVersion, reason: 'NOT_AUTHORIZED' });
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    throw new WorkflowDomainError('WF_ACTION_IMPLEMENTATION_UNAVAILABLE', `No authorized/capable provider for Action ${actionKeyValue}@${actionVersion}.`, { requiredCapabilities, rejected });
  }

  const ordinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const sorted = [...eligible].sort((a, b) => {
    const priorityDiff = (a.registryPriority ?? DEFAULT_REGISTRY_PRIORITY) - (b.registryPriority ?? DEFAULT_REGISTRY_PRIORITY);
    if (priorityDiff !== 0) return priorityDiff;
    const contributorTypeDiff = CONTRIBUTOR_TYPE_ORDER[a.contributorType] - CONTRIBUTOR_TYPE_ORDER[b.contributorType];
    if (contributorTypeDiff !== 0) return contributorTypeDiff;
    // contributorId is not carried on ActionProviderRegistration directly; providerId stands in
    // as the next ordinal tiebreaker along with providerVersion, matching section 7's intent
    // that ties are impossible once providerId/providerVersion are ordinally distinct.
    const providerIdDiff = ordinal(a.providerId, b.providerId);
    if (providerIdDiff !== 0) return providerIdDiff;
    return ordinal(a.providerVersion, b.providerVersion);
  });

  const [winner, runnerUp] = sorted;
  if (
    runnerUp &&
    (winner.registryPriority ?? DEFAULT_REGISTRY_PRIORITY) === (runnerUp.registryPriority ?? DEFAULT_REGISTRY_PRIORITY) &&
    CONTRIBUTOR_TYPE_ORDER[winner.contributorType] === CONTRIBUTOR_TYPE_ORDER[runnerUp.contributorType] &&
    winner.providerId === runnerUp.providerId &&
    winner.providerVersion === runnerUp.providerVersion
  ) {
    // Defensive: `registerActionProvider`'s (providerId, providerVersion) uniqueness check already
    // makes this branch unreachable in practice, but doc 04 section 7 requires ties to be a hard
    // registry error rather than a silent pick, so the check stays even though it can't fire today.
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Exact tuple tie resolving provider for Action ${actionKeyValue}@${actionVersion} — registry validation error.`, { actionKeyValue, actionVersion });
  }

  return {
    winner,
    rejectedHigherRanked: rejected,
  };
}
