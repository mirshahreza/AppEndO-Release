import { randomUUID } from 'node:crypto';
import { prisma } from '../prismaHelpers';
import { WorkflowDomainError } from '../errors';
import {
  getActionDefinitionWithPackages as getActionDefinition,
  resolveExactProviderWithPackages as resolveExactProvider,
  resolveCapabilityProviderWithPackages as resolveCapabilityProvider,
} from '../actions/actionResolutionWithPackages';
import { computeActionDefinitionFingerprint } from '../actions/fingerprint';
import { executeInlineCodeAction } from '../actions/inlineCodeExecutor';
import { createStartedAttempt, getLatestAttemptForNode } from '../workflowExecutionAttemptRepository';
import { renewNodeLease } from '../workflowNodeInstanceRepository';
import { computeLogicalInvocationKey, computeRetryDelayMs, computeMaximumLogicalInvocationWindowMs } from '../actions/logicalInvocationKey';
import { canonicalJsonFingerprint } from '../canonicalJson';
import { emitTraceAutoRevision } from './traceEmission';
import { resolveWorkflowSecretFromEnv, applySecretReferenceFields } from './secretResolution';
import type { ActionExecutor, ActionExecutorContext, ActionExecutionResult } from '../actions/types';
import type { ActionResolutionRef, JsonValue, RetryPolicy, RetrySelector, ActionNodeDefinition, WorkflowModel } from '../awm/types';
import type { WorkflowExecutionAttemptRecord, WorkflowActorType } from '../types';
import {
  applyAttemptSuccessContinuation,
  applyAttemptRetryContinuation,
  applyAttemptUnhandledFailureContinuation,
  applyAttemptCaughtFailureContinuation,
  type AttemptTerminalPatch,
} from './continuationApply';

/**
 * ACTION attempt lifecycle — doc 06 sections 5 (logical invocation/attempt), 7 (timeout fencing), 8
 * (heartbeat), 16 (dispatch/retry/recovery algorithm authority), doc 04 section 2 (executor
 * boundary). Durable state transitions are `continuationApply.ts`'s job; this module resolves the
 * provider, begins the attempt, invokes the executor under a deadline race, and picks which
 * `continuationApply` transaction applies.
 */

export type ResolvedActionProvider = {
  actionKey: string;
  actionVersion: string;
  actionFingerprint: string;
  bindingMode: 'EXACT_PROVIDER' | 'CAPABILITY_RESOLVED';
  providerId: string;
  providerVersion: string;
  providerFingerprint: string;
  /** ACTION_RESOLVED trace evidence only (doc 03 section 29) — empty for EXACT_PROVIDER, since there is no ranked candidate set to reject from. */
  rejectedHigherRankedReasons: string[];
  executor: ActionExecutor;
  executionTimeoutMs: number;
  idempotencyGuarantee: 'DEDUPLICATED' | 'SUPPORTED' | 'BEST_EFFORT' | 'NONE';
  /** Doc 04 section 7 — dotted pointers (e.g. "config.headers") into the evaluated config/input where secret-reference strings may live; resolved just before the executor call (see `secretResolution.ts`). */
  secretReferenceFields: string[];
};

/** `INLINE_CODE` — no Action Registry entry to look up; the "provider" is a synthesized executor running `actionRef.code` in the Server Functions sandbox (`inlineCodeExecutor.ts`). `actionFingerprint`/`providerFingerprint` hash the code itself so a published revision's pinned fingerprint still changes when the author edits the code. */
function resolveInlineCodeProvider(actionRef: Extract<ActionResolutionRef, { type: 'INLINE_CODE' }>): ResolvedActionProvider {
  const fingerprint = canonicalJsonFingerprint({ code: actionRef.code, language: actionRef.language ?? 'ts' });
  return {
    actionKey: 'workflow.inline-code',
    actionVersion: '1',
    actionFingerprint: fingerprint,
    bindingMode: 'EXACT_PROVIDER',
    providerId: 'inline',
    providerVersion: '1',
    providerFingerprint: fingerprint,
    rejectedHigherRankedReasons: [],
    executor: { execute: (context, config, input) => executeInlineCodeAction(actionRef, context, config, input) },
    executionTimeoutMs: clampTimeoutMsForInlineCode(actionRef.timeoutMs),
    idempotencyGuarantee: 'NONE',
    secretReferenceFields: [],
  };
}

const clampTimeoutMsForInlineCode = (timeoutMs: number | undefined): number => (
  Number.isFinite(timeoutMs) && (timeoutMs as number) > 0 ? (timeoutMs as number) : 30000
);

/** Doc 04 section 7 — exact provider or deterministic-tuple capability resolution, revalidated at the execution boundary (doc 06 section 11) rather than trusting a stale publication-time binding. Authorization/capability policy itself is doc 09 territory; Slice 5 uses an always-authorized predicate for CAPABILITY_RESOLVED, matching the "not implemented until doc 09" gap already documented in Slice 3. `INLINE_CODE` (added per PO request — see `InlineCodeActionRef` doc comment) bypasses the registry entirely via `resolveInlineCodeProvider`. */
export function resolveActionProviderForNode(actionRef: ActionResolutionRef): ResolvedActionProvider {
  if (actionRef.type === 'INLINE_CODE') {
    return resolveInlineCodeProvider(actionRef);
  }
  const registered = getActionDefinition(actionRef.action.actionKey, actionRef.action.actionVersion);
  if (!registered || registered.definition.availability !== 'AVAILABLE') {
    throw new WorkflowDomainError('WF_ACTION_IMPLEMENTATION_UNAVAILABLE', `Action ${actionRef.action.actionKey}@${actionRef.action.actionVersion} is not available.`, { actionRef });
  }
  const rejectedHigherRankedReasons: string[] = [];
  let winner;
  if (actionRef.type === 'EXACT_PROVIDER') {
    winner = resolveExactProvider(actionRef.action.actionKey, actionRef.action.actionVersion, actionRef.providerId, actionRef.providerVersion);
  } else {
    const resolution = resolveCapabilityProvider(actionRef.action.actionKey, actionRef.action.actionVersion, actionRef.requiredCapabilities, () => true);
    winner = resolution.winner;
    rejectedHigherRankedReasons.push(...resolution.rejectedHigherRanked.map((r) => `${r.providerId}@${r.providerVersion}: ${r.reason}`));
  }

  return {
    actionKey: actionRef.action.actionKey,
    actionVersion: actionRef.action.actionVersion,
    actionFingerprint: computeActionDefinitionFingerprint(registered.definition),
    bindingMode: actionRef.type,
    providerId: winner.providerId,
    providerVersion: winner.providerVersion,
    providerFingerprint: canonicalJsonFingerprint({ actionKey: actionRef.action.actionKey, actionVersion: actionRef.action.actionVersion, providerId: winner.providerId, providerVersion: winner.providerVersion }),
    rejectedHigherRankedReasons,
    executor: winner.executor,
    executionTimeoutMs: registered.definition.executionTimeoutMs,
    idempotencyGuarantee: registered.definition.idempotency.guarantee,
    secretReferenceFields: registered.definition.secretReferenceFields,
  };
}

/** Doc 05 section 8: "Node-level override or workflow default is resolved at publication." Publication validates this resolution (`actionResolutionValidation.ts`) but does not rewrite it back onto the node, so runtime replicates the exact same rule. */
export function resolveEffectiveRetryPolicy(node: ActionNodeDefinition, model: WorkflowModel): RetryPolicy {
  const policy = node.retryPolicy ?? model.policies.defaultRetryPolicy;
  if (!policy) {
    throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `ACTION node "${node.key}" has no resolvable retryPolicy — publication should have rejected this.`, { nodeKey: node.key });
  }
  return policy;
}

export type FailureClassification = { errorCode?: string; errorClass?: string; isTimeout: boolean };

/** Doc 05 section 27: "A failed/timed-out attempt is retryable iff at least one selector exactly matches its persisted canonical error code/class or TIMEOUT. UNKNOWN is never matched." */
function retrySelectorMatches(selector: RetrySelector, classification: FailureClassification): boolean {
  if (selector.type === 'TIMEOUT') return classification.isTimeout;
  if (selector.type === 'ERROR_CODE') return classification.errorCode !== undefined && selector.codes.includes(classification.errorCode);
  return classification.errorClass !== undefined && selector.classes.includes(classification.errorClass);
}

export function matchesRetryPolicy(policy: RetryPolicy, classification: FailureClassification): boolean {
  return policy.retryOn.some((selector) => retrySelectorMatches(selector, classification));
}

/** ACTION_RETRY_SCHEDULED trace evidence (doc 03 section 29) wants "matched retry selector identity" — the first configured selector (declaration order) that actually matched, fingerprinted the same way every other registry-object identity in this trace payload family is (`providerFingerprint`, `policyVersion`). */
export function findMatchingRetrySelectorIdentity(policy: RetryPolicy, classification: FailureClassification): string {
  const matched = policy.retryOn.find((selector) => retrySelectorMatches(selector, classification));
  return matched ? canonicalJsonFingerprint(matched) : 'NO_MATCHED_SELECTOR';
}

export type BegunAttempt = {
  attempt: WorkflowExecutionAttemptRecord;
  logicalInvocationId: string;
  idempotencyKey: string;
};

/**
 * Doc 03 section 25 / doc 06 section 5 — allocates the attempt, persists logical-invocation identity/
 * provider and `deadlineAt` before external execution begins. Automatic retry reuses the previous
 * attempt's identities; `forceNewInvocation` (operator command) allocates fresh ones.
 *
 * Slice 10: also emits `ACTION_RESOLVED` and `ACTION_ATTEMPT_STARTED` (doc 03 section 29) in one
 * small transaction right after `createStartedAttempt` commits — deliberately NOT the same
 * transaction as the attempt row itself. `createStartedAttempt` already writes through its own
 * implicit (non-transactional) `prisma()` calls via `allocateNextAttemptNumber`'s CAS idiom (a
 * Slice 1 repository primitive, unchanged by Slice 10), so folding trace emission into that would
 * require rewriting attempt creation's storage shape — out of scope for a slice that adds evidence
 * emission, not new storage. A crash between attempt creation and this trace commit leaves an
 * attempt row with missing (not wrong) start evidence, which is recoverable/observable the same way
 * a pre-Slice-10 crash in this exact gap already was: `recoveryService.ts`'s uncertainty handling
 * only ever reads persisted attempt/node state, never trace rows, as its source of truth. Terminal
 * evidence (`ACTION_ATTEMPT_SUCCEEDED`/`FAILED`/`TIMED_OUT`/`UNKNOWN`/`CANCELLED`,
 * `ACTION_RETRY_SCHEDULED`) mutates node/instance status and IS co-atomic with its trace row, in
 * `continuationApply.ts`'s attempt-terminal transactions, matching doc 06 section 4's requirement.
 */
export async function beginActionAttempt(input: {
  workflowInstanceId: number;
  nodeInstanceId: number;
  nodeKey: string;
  resolvedProvider: ResolvedActionProvider;
  retryPolicy: RetryPolicy;
  recoveryDetectionBoundMs: number;
  forceNewInvocation?: boolean;
}): Promise<BegunAttempt> {
  const previous = input.forceNewInvocation ? undefined : await getLatestAttemptForNode(input.nodeInstanceId);
  const logicalInvocationId = previous ? previous.logicalInvocationId : randomUUID();
  const idempotencyKey = previous
    ? previous.idempotencyKey
    : computeLogicalInvocationKey({ workflowInstanceId: String(input.workflowInstanceId), nodeInstanceId: String(input.nodeInstanceId), logicalInvocationId });

  const canonicalNow = new Date();
  const deadlineAt = new Date(canonicalNow.getTime() + input.resolvedProvider.executionTimeoutMs);
  const logicalInvocationWindowMs = computeMaximumLogicalInvocationWindowMs({
    actionTimeoutMs: input.resolvedProvider.executionTimeoutMs,
    retryPolicy: input.retryPolicy,
    recoveryDetectionBoundMs: input.recoveryDetectionBoundMs,
  });

  const attempt = await createStartedAttempt({
    workflowInstanceId: input.workflowInstanceId,
    nodeInstanceId: input.nodeInstanceId,
    actionKey: input.resolvedProvider.actionKey,
    actionVersion: input.resolvedProvider.actionVersion,
    logicalInvocationId,
    idempotencyKey,
    selectedProviderId: input.resolvedProvider.providerId,
    selectedProviderVersion: input.resolvedProvider.providerVersion,
    selectedProviderFingerprint: input.resolvedProvider.providerFingerprint,
    deadlineAt,
    logicalInvocationWindowMs,
  });

  const idempotencyKeyFingerprint = canonicalJsonFingerprint({ idempotencyKey });
  const providerIdentity = `${input.resolvedProvider.providerId}@${input.resolvedProvider.providerVersion}`;
  await prisma().$transaction(async (tx) => {
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      traceType: 'ACTION_RESOLVED',
      actorType: 'SYSTEM',
      corePayload: {
        nodeKey: input.nodeKey,
        attemptId: String(attempt.id),
        actionKey: input.resolvedProvider.actionKey,
        actionVersion: input.resolvedProvider.actionVersion,
        actionFingerprint: input.resolvedProvider.actionFingerprint,
        bindingMode: input.resolvedProvider.bindingMode,
        // No separate "retry policy version" registry exists anywhere in the repo (same "no X
        // registry" Repository Reality Audit shape as every prior slice) — the effective policy's
        // own canonical fingerprint stands in as its version identity, matching how `providerFingerprint`
        // stands in for provider identity elsewhere in this same payload.
        policyVersion: canonicalJsonFingerprint(input.retryPolicy),
        selectedProviderId: input.resolvedProvider.providerId,
        selectedProviderVersion: input.resolvedProvider.providerVersion,
        selectedProviderFingerprint: input.resolvedProvider.providerFingerprint,
        rejectedHigherRankedReasons: input.resolvedProvider.rejectedHigherRankedReasons,
      },
    });
    await emitTraceAutoRevision(tx, {
      workflowInstanceId: input.workflowInstanceId,
      nodeInstanceId: input.nodeInstanceId,
      traceType: 'ACTION_ATTEMPT_STARTED',
      actorType: 'SYSTEM',
      corePayload: {
        nodeKey: input.nodeKey,
        attemptId: String(attempt.id),
        logicalInvocationId,
        attemptNumber: attempt.attemptNumber,
        idempotencyKeyFingerprint,
        providerIdentity,
      },
    });
  });

  return { attempt, logicalInvocationId, idempotencyKey };
}

export type ExecutorRaceResult =
  | { outcome: 'SUCCEEDED'; output: JsonValue; resultMetadataJson?: string }
  | { outcome: 'FAILED'; errorCode: string; errorClass: string; safeMessage: string }
  | { outcome: 'TIMED_OUT' };

const noopLogger = { info: () => {}, warn: () => {}, error: () => {} };

const DEFAULT_HEARTBEAT_LEASE_DURATION_MS = 30_000;
const HEARTBEAT_INTERVAL_FRACTION = 3; // renew at roughly 1/3 of the lease duration, well before expiry

/**
 * Doc 06 section 8 — "Lease heartbeat is owned by the engine invocation wrapper and continues
 * independently of Action executor callbacks while policy permits." Runs a periodic
 * `renewNodeLease` while the executor promise is pending. "Heartbeat failure does not itself assert
 * Action failure" — a renewal error is swallowed here (logged via the no-op logger's console
 * fallback would be Slice 10 trace territory) and simply stops future renewals; the node's lease
 * then ages out and ordinary recovery handles it, exactly as the frozen text describes.
 */
function startLeaseHeartbeat(input: { nodeInstanceId: number; leaseOwnerId: string; leaseDurationMs: number; getCurrentStateVersion: () => number; onRenewed: (newStateVersion: number) => void }): { stop: () => Promise<void> } {
  const intervalMs = Math.max(1, Math.floor(input.leaseDurationMs / HEARTBEAT_INTERVAL_FRACTION));
  let stopped = false;
  let inFlight: Promise<void> = Promise.resolve();
  const timer = setInterval(() => {
    if (stopped) return;
    inFlight = (async () => {
      try {
        const renewed = await renewNodeLease(input.nodeInstanceId, input.getCurrentStateVersion(), input.leaseOwnerId, input.leaseDurationMs);
        // Applied unconditionally, even if `stop()` was called while this renewal was in flight — the
        // DB row was already durably mutated by the time this resolves, so the local tracker must
        // reflect it or the caller's subsequent CAS would use a stale expected version and spuriously
        // fail. `stopped` only prevents *scheduling new* renewals, never suppresses an already-started one.
        input.onRenewed(renewed.stateVersion);
      } catch {
        // Heartbeat failure creates recoverable ownership uncertainty (doc 06 section 8); it does not assert Action failure. Recovery's lease-expiry scan is the safety net.
      }
    })();
  }, intervalMs);
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await inFlight; // ensure any renewal already in flight lands (and updates currentNodeStateVersion) before the caller trusts it
    },
  };
}

/**
 * Doc 06 section 7 — races the executor promise against the persisted deadline. Doc 04 section 2:
 * "Executor exceptions are never branching authority" — an uncaught throw is normalized to a FAILED
 * result rather than propagated as control flow. The deadline race is advisory for *this* in-process
 * call; the actual timeout winner is still decided by the CAS transition the caller applies
 * afterward (doc 06 section 7: "Persisted terminal attempt status wins"), so a concurrent
 * timeout-scanner racing the same attempt can never double-commit. Doc 06 section 8: a heartbeat
 * renews the node's lease independently of executor settlement while it runs; the caller must use
 * `currentNodeStateVersion` (not its original pre-call value) for the terminal CAS afterward, since
 * heartbeat renewals bump it.
 */
export async function invokeActionExecutorWithDeadline(input: {
  resolvedProvider: ResolvedActionProvider;
  attempt: WorkflowExecutionAttemptRecord;
  workflowInstanceId: number;
  nodeInstanceId: number;
  nodeStateVersion: number;
  leaseOwnerId: string;
  leaseDurationMs?: number;
  effectiveIdentity: { type: WorkflowActorType; id: string | null };
  config: JsonValue;
  actionInput: JsonValue;
  executionTimeoutMs: number;
}): Promise<{ result: ExecutorRaceResult; currentNodeStateVersion: number }> {
  const abortController = new AbortController();
  const context: ActionExecutorContext = {
    workflowInstanceId: String(input.workflowInstanceId),
    nodeInstanceId: String(input.nodeInstanceId),
    logicalInvocationId: input.attempt.logicalInvocationId,
    idempotencyKey: input.attempt.idempotencyKey,
    effectiveIdentity: input.effectiveIdentity,
    cancellationSignal: abortController.signal,
    // Doc 04 section 8 governed secret channel: env-var indirection, reusing the one convention the
    // platform already ships (`dataSourceSecrets.ts`). Executors may also call this directly for
    // secret-shaped values outside `secretReferenceFields` — none do today.
    resolveSecret: resolveWorkflowSecretFromEnv,
    logger: noopLogger,
    // Trace emission is Slice 10 territory (doc 11 section 1 item 10); metadata is accepted and discarded here, matching the precedent already set by traceTypes.ts ("emission... belongs to later delivery slices").
    writeTraceMetadata: () => {},
  };

  let currentNodeStateVersion = input.nodeStateVersion;
  const heartbeat = startLeaseHeartbeat({
    nodeInstanceId: input.nodeInstanceId,
    leaseOwnerId: input.leaseOwnerId,
    leaseDurationMs: input.leaseDurationMs ?? DEFAULT_HEARTBEAT_LEASE_DURATION_MS,
    getCurrentStateVersion: () => currentNodeStateVersion,
    onRenewed: (newStateVersion) => {
      currentNodeStateVersion = newStateVersion;
    },
  });

  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<ExecutorRaceResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      abortController.abort();
      resolve({ outcome: 'TIMED_OUT' });
    }, input.executionTimeoutMs);
  });

  const executionPromise = (async (): Promise<ExecutorRaceResult> => {
    let resolvedConfig = input.config;
    let resolvedActionInput = input.actionInput;
    if (input.resolvedProvider.secretReferenceFields.length > 0) {
      try {
        const substituted = await applySecretReferenceFields({
          config: input.config,
          actionInput: input.actionInput,
          secretReferenceFields: input.resolvedProvider.secretReferenceFields,
          resolveSecret: context.resolveSecret,
        });
        resolvedConfig = substituted.config;
        resolvedActionInput = substituted.actionInput;
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message : 'Secret resolution failed.';
        return { outcome: 'FAILED', errorCode: 'WF_EXEC_SECRET_RESOLUTION_FAILED', errorClass: 'SECRET_RESOLUTION_FAILED', safeMessage };
      }
    }

    let result: ActionExecutionResult;
    try {
      result = await input.resolvedProvider.executor.execute(context, resolvedConfig, resolvedActionInput);
    } catch (error) {
      return {
        outcome: 'FAILED',
        errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID',
        errorClass: 'EXECUTOR_EXCEPTION',
        safeMessage: 'Action executor raised an unexpected exception.',
      };
    }
    if (result.status === 'SUCCEEDED') {
      return { outcome: 'SUCCEEDED', output: result.output };
    }
    return { outcome: 'FAILED', errorCode: result.errorCode, errorClass: result.errorClass, safeMessage: result.safeMessage };
  })();

  let result: ExecutorRaceResult;
  try {
    result = await Promise.race([executionPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
  // Await heartbeat shutdown (including any renewal already in flight) *before* reading
  // `currentNodeStateVersion` — otherwise a renewal that started just before the race settled could
  // land after this function returns, leaving the caller's CAS using a stale expected version.
  await heartbeat.stop();
  return { result, currentNodeStateVersion };
}

export const attemptTerminalPatchForFailure = (classification: FailureClassification, safeMessage: string): AttemptTerminalPatch => ({
  command: classification.isTimeout ? 'DEADLINE_TRANSITION_WINS' : 'COMMIT_FAILURE',
  errorClass: classification.errorClass,
  errorCode: classification.errorCode,
  errorMessage: safeMessage,
});

export { applyAttemptSuccessContinuation, applyAttemptRetryContinuation, applyAttemptUnhandledFailureContinuation, applyAttemptCaughtFailureContinuation, computeRetryDelayMs };
