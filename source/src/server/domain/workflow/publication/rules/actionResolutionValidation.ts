import type { WorkflowModel, CanonicalMapping, CanonicalMappingValue, RetryPolicy } from '../../awm/types';
import { WORKFLOW_ERROR_REGISTRY, isWorkflowDomainError } from '../../errors';
import {
  getActionDefinitionWithPackages as getActionDefinition,
  resolveExactProviderWithPackages as resolveExactProvider,
  resolveCapabilityProviderWithPackages as resolveCapabilityProvider,
} from '../../actions/actionResolutionWithPackages';
import { computeMaximumLogicalInvocationWindowMs } from '../../actions/logicalInvocationKey';
import { canonicalJsonFingerprint } from '../../canonicalJson';
import type { ValidationIssue, ResolvedActionNodeBinding } from '../validationTypes';

/**
 * Action resolution, idempotency compatibility and secret-literal scanning — doc 04 sections 5, 7,
 * 8; doc 05 section 13.
 *
 * Slice 4 design decision (documented, no doc 09 authorization-policy implementation exists yet):
 * `CAPABILITY_RESOLVED` resolution here uses a permissive `isAuthorized = () => true` predicate.
 * Real capability/permission authorization policy is document 09 territory and is not yet built;
 * this keeps provider *ordering* correctness testable now without inventing a parallel auth
 * primitive. "permission/capability publication-policy failure" (doc 05 section 13) is therefore a
 * known deferred validation category, not silently claimed as implemented.
 */
const PERMISSIVE_AUTHORIZATION = () => true;

function findLiteralPathsIn(value: CanonicalMappingValue, basePath: string, sink: string[]): void {
  if (value.type === 'EXPRESSION') {
    if (value.expression.op === 'LITERAL' && typeof value.expression.value === 'string') {
      sink.push(basePath);
    }
    return;
  }
  if (value.type === 'OBJECT') {
    for (const [key, field] of Object.entries(value.fields)) findLiteralPathsIn(field, `${basePath}.${key}`, sink);
    return;
  }
  for (let i = 0; i < value.items.length; i += 1) findLiteralPathsIn(value.items[i], `${basePath}[${i}]`, sink);
}

/** Resolves a dotted `secretReferenceFields` pointer (e.g. "config.headers") against the node's CanonicalMapping tree and scans for literal string leaks under it. */
function scanSecretReferenceField(config: CanonicalMapping, input: CanonicalMapping, fieldPointer: string): string[] {
  const segments = fieldPointer.split('.');
  const rootName = segments[0];
  const root: CanonicalMapping | undefined = rootName === 'config' ? config : rootName === 'input' ? input : undefined;
  if (!root) return [];

  let current: CanonicalMappingValue = { type: 'OBJECT', fields: root.fields };
  for (const segment of segments.slice(1)) {
    if (current.type !== 'OBJECT' || !(segment in current.fields)) return [];
    current = current.fields[segment];
  }
  const literalPaths: string[] = [];
  findLiteralPathsIn(current, fieldPointer, literalPaths);
  return literalPaths;
}

export function runActionResolutionValidation(model: WorkflowModel): { issues: ValidationIssue[]; actionBindings: ResolvedActionNodeBinding[] } {
  const issues: ValidationIssue[] = [];
  const actionBindings: ResolvedActionNodeBinding[] = [];

  for (const node of model.nodes) {
    // WFV2-2 — FOR_EACH carries the exact same actionRef/config/input/retryPolicy shape as ACTION
    // (one action invoked per item) and needs the identical resolution/idempotency/secret-scanning
    // authority; only the diagnostic label below distinguishes the two in issue messages.
    if (node.kind !== 'ACTION' && node.kind !== 'FOR_EACH' && node.kind !== 'LOOP') continue;
    const kindLabel = node.kind;

    const resolvedRetryPolicy: RetryPolicy | undefined = node.retryPolicy ?? model.policies.defaultRetryPolicy;
    if (!resolvedRetryPolicy) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_RETRY_POLICY, severity: 'ERROR', message: `${kindLabel} node "${node.key}" has no node-level retryPolicy and no workflow defaultRetryPolicy is configured.`, nodeKey: node.key });
      continue;
    }

    // INLINE_CODE has no Action Registry entry — a much smaller, self-contained validation branch:
    // the code must be non-empty, and (since there is no per-action idempotency guarantee to prove
    // safe-under-replay) automatic retries are disallowed rather than silently assumed safe.
    if (node.actionRef.type === 'INLINE_CODE') {
      if (!node.actionRef.code.trim()) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `${kindLabel} node "${node.key}" has an empty INLINE_CODE implementation.`, nodeKey: node.key });
        continue;
      }
      if (resolvedRetryPolicy.maxAttempts > 1) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.ACTION_IDEMPOTENCY_INCOMPATIBLE, severity: 'ERROR', message: `${kindLabel} node "${node.key}" is INLINE_CODE — automatic retries (maxAttempts=${resolvedRetryPolicy.maxAttempts}) are not allowed since inline code has no declared idempotency guarantee. Set maxAttempts to 1.`, nodeKey: node.key });
        continue;
      }
      actionBindings.push({
        nodeKey: node.key,
        actionRef: node.actionRef,
        actionFingerprint: canonicalJsonFingerprint({ code: node.actionRef.code, language: node.actionRef.language ?? 'ts' }),
        resolvedRetryPolicy,
        maximumLogicalInvocationWindowMs: resolvedRetryPolicy.maxAttempts <= 1 ? 0 : 0,
        providerOrderPolicyVersion: 'workflow.capability-provider-order/v1',
        pinnedProvider: undefined,
      });
      continue;
    }

    let actionKey: string;
    let actionVersion: string;
    let definition: ReturnType<typeof getActionDefinition>;
    let pinnedProvider: ResolvedActionNodeBinding['pinnedProvider'];

    try {
      if (node.actionRef.type === 'EXACT_PROVIDER') {
        actionKey = node.actionRef.action.actionKey;
        actionVersion = node.actionRef.action.actionVersion;
        const provider = resolveExactProvider(actionKey, actionVersion, node.actionRef.providerId, node.actionRef.providerVersion);
        definition = getActionDefinition(actionKey, actionVersion);
        pinnedProvider = { providerId: provider.providerId, providerVersion: provider.providerVersion, providerFingerprint: definition!.fingerprint };
      } else {
        actionKey = node.actionRef.action.actionKey;
        actionVersion = node.actionRef.action.actionVersion;
        resolveCapabilityProvider(actionKey, actionVersion, node.actionRef.requiredCapabilities, PERMISSIVE_AUTHORIZATION);
        definition = getActionDefinition(actionKey, actionVersion);
      }
    } catch (error) {
      if (isWorkflowDomainError(error)) {
        issues.push({ code: error.code, severity: 'ERROR', message: error.message, nodeKey: node.key, details: error.details });
      } else {
        throw error;
      }
      continue;
    }

    if (!definition) {
      issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_ACTION_UNAVAILABLE, severity: 'ERROR', message: `${kindLabel} node "${node.key}" references unresolvable Action "${actionKey}@${actionVersion}".`, nodeKey: node.key });
      continue;
    }

    let maximumLogicalInvocationWindowMs: number;
    try {
      maximumLogicalInvocationWindowMs = computeMaximumLogicalInvocationWindowMs({
        actionTimeoutMs: definition.definition.executionTimeoutMs,
        retryPolicy: resolvedRetryPolicy,
        recoveryDetectionBoundMs: model.policies.recoveryDetectionBoundMs,
      });
    } catch (error) {
      if (isWorkflowDomainError(error)) {
        issues.push({ code: error.code, severity: 'ERROR', message: error.message, nodeKey: node.key });
        continue;
      }
      throw error;
    }

    // Doc 04 section 5: automatic uncertain replay is only required (and only needs
    // idempotency-safety proof) when the Action has an observable external side effect AND the
    // engine can automatically dispatch more than one attempt for the same logical invocation.
    // PURE actions have no external effect to duplicate; a policy allowing only one attempt has no
    // automatic replay at all (only an operator-forced new invocation, which is a distinct,
    // explicitly re-authorized path per doc 04 section 9 — not "automatic").
    const requiresReplaySafety = definition.definition.sideEffectClass !== 'PURE' && resolvedRetryPolicy.maxAttempts > 1;
    if (requiresReplaySafety) {
      const idempotency = definition.definition.idempotency;
      const windowSufficient = idempotency.guarantee === 'DEDUPLICATED' && (idempotency.deduplicationWindowMs ?? 0) >= maximumLogicalInvocationWindowMs;
      if (!windowSufficient) {
        issues.push({
          code: WORKFLOW_ERROR_REGISTRY.ACTION_IDEMPOTENCY_INCOMPATIBLE,
          severity: 'ERROR',
          message: `${kindLabel} node "${node.key}" requires automatic uncertain replay (sideEffectClass=${definition.definition.sideEffectClass}, maxAttempts=${resolvedRetryPolicy.maxAttempts}) but Action "${actionKey}@${actionVersion}" idempotency guarantee "${idempotency.guarantee}" with window ${idempotency.deduplicationWindowMs ?? 0}ms does not cover the computed logical window ${maximumLogicalInvocationWindowMs}ms.`,
          nodeKey: node.key,
        });
      }
    }

    for (const fieldPointer of definition.definition.secretReferenceFields) {
      const literalPaths = scanSecretReferenceField(node.config, node.input, fieldPointer);
      for (const path of literalPaths) {
        issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `${kindLabel} node "${node.key}" has a literal string value at secret-reference field "${path}" — secrets MUST be referenced indirectly, never as a literal in the draft/revision.`, nodeKey: node.key, path });
      }
    }

    // WFV2-14 — a declared compensation action must itself resolve to a real, available Action
    // (same resolution authority, not idempotency/replay-checked since compensation is invoked at
    // most once, best-effort, never automatically retried).
    if (node.kind === 'ACTION' && node.compensation) {
      const compRef = node.compensation.actionRef;
      if (compRef.type === 'INLINE_CODE') {
        if (!compRef.code.trim()) {
          issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM, severity: 'ERROR', message: `ACTION node "${node.key}" compensation has an empty INLINE_CODE implementation.`, nodeKey: node.key });
        }
      } else {
        try {
          if (compRef.type === 'EXACT_PROVIDER') {
            resolveExactProvider(compRef.action.actionKey, compRef.action.actionVersion, compRef.providerId, compRef.providerVersion);
          } else {
            resolveCapabilityProvider(compRef.action.actionKey, compRef.action.actionVersion, compRef.requiredCapabilities, PERMISSIVE_AUTHORIZATION);
          }
          const compDefinition = getActionDefinition(compRef.action.actionKey, compRef.action.actionVersion);
          if (!compDefinition) {
            issues.push({ code: WORKFLOW_ERROR_REGISTRY.DEF_ACTION_UNAVAILABLE, severity: 'ERROR', message: `ACTION node "${node.key}" compensation references unresolvable Action "${compRef.action.actionKey}@${compRef.action.actionVersion}".`, nodeKey: node.key });
          }
        } catch (error) {
          if (isWorkflowDomainError(error)) {
            issues.push({ code: error.code, severity: 'ERROR', message: `ACTION node "${node.key}" compensation: ${error.message}`, nodeKey: node.key, details: error.details });
          } else {
            throw error;
          }
        }
      }
    }

    actionBindings.push({
      nodeKey: node.key,
      actionRef: node.actionRef,
      actionFingerprint: definition.fingerprint,
      resolvedRetryPolicy,
      maximumLogicalInvocationWindowMs,
      providerOrderPolicyVersion: 'workflow.capability-provider-order/v1',
      pinnedProvider,
    });
  }

  return { issues, actionBindings };
}
