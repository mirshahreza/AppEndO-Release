import { describe, expect, it, beforeEach } from 'vitest';
import type { WorkflowNodeDefinition, RetryPolicy } from '../../awm/types';
import { registerActionDefinition, registerActionProvider, __resetActionRegistryForTests } from '../../actions/registry';
import type { ActionDefinition, ActionProviderRegistration } from '../../actions/types';
import { runActionResolutionValidation } from '../rules/actionResolutionValidation';
import { baseModel, mappingOf, lit, nodeOutput } from './fixtures';

const baseDefinition = (overrides: Partial<ActionDefinition> = {}): ActionDefinition => ({
  key: 'test.action',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: { type: 'INLINE', schema: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  executionTimeoutMs: 1000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: [],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: [],
  ...overrides,
});

const noopExecutor = { execute: async () => ({ status: 'SUCCEEDED' as const, output: null }) };

const baseProvider = (overrides: Partial<ActionProviderRegistration> = {}): ActionProviderRegistration => ({
  actionKey: 'test.action',
  actionVersion: '1',
  providerId: 'core',
  providerVersion: '1',
  contributorType: 'CORE',
  providesCapabilities: [],
  registryPriority: 1000,
  executor: noopExecutor,
  ...overrides,
});

const fixedRetry = (maxAttempts = 1): RetryPolicy => ({ maxAttempts, strategy: 'FIXED', initialDelayMs: 10, retryOn: [] });

const actionNodeWith = (overrides: Partial<Extract<WorkflowNodeDefinition, { kind: 'ACTION' }>> = {}): WorkflowNodeDefinition => ({
  kind: 'ACTION',
  key: 'a1',
  actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'test.action', actionVersion: '1' }, providerId: 'core', providerVersion: '1' },
  config: mappingOf({}),
  input: mappingOf({}),
  retryPolicy: fixedRetry(),
  ...overrides,
});

describe('runActionResolutionValidation', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
  });

  it('resolves an EXACT_PROVIDER reference and pins the provider identity', () => {
    registerActionDefinition(baseDefinition());
    registerActionProvider(baseProvider());
    const model = baseModel({ nodes: [actionNodeWith()] });
    const result = runActionResolutionValidation(model);
    expect(result.issues).toHaveLength(0);
    expect(result.actionBindings).toHaveLength(1);
    expect(result.actionBindings[0].pinnedProvider).toMatchObject({ providerId: 'core', providerVersion: '1' });
  });

  it('resolves a CAPABILITY_RESOLVED reference without pinning a provider', () => {
    registerActionDefinition(baseDefinition());
    registerActionProvider(baseProvider({ providesCapabilities: ['http'] }));
    const model = baseModel({
      nodes: [
        actionNodeWith({
          actionRef: { type: 'CAPABILITY_RESOLVED', action: { actionKey: 'test.action', actionVersion: '1' }, requiredCapabilities: ['http'] },
        }),
      ],
    });
    const result = runActionResolutionValidation(model);
    expect(result.issues).toHaveLength(0);
    expect(result.actionBindings[0].pinnedProvider).toBeUndefined();
  });

  it('rejects an ACTION node with no node-level retryPolicy and no workflow defaultRetryPolicy', () => {
    registerActionDefinition(baseDefinition());
    registerActionProvider(baseProvider());
    const model = baseModel({ nodes: [actionNodeWith({ retryPolicy: undefined })] });
    const result = runActionResolutionValidation(model);
    expect(result.issues.map((i) => i.code)).toContain('WF_DEF_INVALID_RETRY_POLICY');
    expect(result.actionBindings).toHaveLength(0);
  });

  it('falls back to the workflow defaultRetryPolicy when the node has none', () => {
    registerActionDefinition(baseDefinition());
    registerActionProvider(baseProvider());
    const model = baseModel({
      nodes: [actionNodeWith({ retryPolicy: undefined })],
      policies: { ...baseModel().policies, defaultRetryPolicy: fixedRetry() },
    });
    const result = runActionResolutionValidation(model);
    expect(result.issues).toHaveLength(0);
    expect(result.actionBindings).toHaveLength(1);
  });

  it('reports an unresolvable EXACT_PROVIDER reference as a domain-error-coded issue', () => {
    registerActionDefinition(baseDefinition());
    // No provider registered at all.
    const model = baseModel({ nodes: [actionNodeWith()] });
    const result = runActionResolutionValidation(model);
    expect(result.issues.map((i) => i.code)).toContain('WF_ACTION_IMPLEMENTATION_UNAVAILABLE');
    expect(result.actionBindings).toHaveLength(0);
  });

  it('surfaces an invalid EXPONENTIAL retry policy from the invocation-window computation as an issue, not a thrown exception', () => {
    registerActionDefinition(baseDefinition());
    registerActionProvider(baseProvider());
    const model = baseModel({
      nodes: [actionNodeWith({ retryPolicy: { maxAttempts: 3, strategy: 'EXPONENTIAL', initialDelayMs: 10, multiplier: 0.5, retryOn: [] } })],
    });
    const result = runActionResolutionValidation(model);
    expect(result.issues.map((i) => i.code)).toContain('WF_DEF_INVALID_RETRY_POLICY');
  });

  describe('idempotency-compatibility (doc 04 section 5)', () => {
    it('rejects a non-PURE Action with maxAttempts > 1 and no sufficient deduplication window', () => {
      registerActionDefinition(baseDefinition({ sideEffectClass: 'WRITE_EXTERNAL', idempotency: { guarantee: 'NONE' } }));
      registerActionProvider(baseProvider());
      const model = baseModel({ nodes: [actionNodeWith({ retryPolicy: fixedRetry(3) })] });
      const result = runActionResolutionValidation(model);
      expect(result.issues.map((i) => i.code)).toContain('WF_ACTION_IDEMPOTENCY_INCOMPATIBLE');
    });

    it('accepts a non-PURE Action with maxAttempts > 1 when the deduplication window covers the computed logical window', () => {
      registerActionDefinition(
        baseDefinition({ sideEffectClass: 'WRITE_EXTERNAL', executionTimeoutMs: 1000, idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 1_000_000 } }),
      );
      registerActionProvider(baseProvider());
      const model = baseModel({ nodes: [actionNodeWith({ retryPolicy: fixedRetry(3) })] });
      const result = runActionResolutionValidation(model);
      expect(result.issues).toHaveLength(0);
    });

    it('rejects when the deduplication window is smaller than the computed logical invocation window', () => {
      registerActionDefinition(
        baseDefinition({ sideEffectClass: 'WRITE_EXTERNAL', executionTimeoutMs: 100_000, idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 10 } }),
      );
      registerActionProvider(baseProvider());
      const model = baseModel({ nodes: [actionNodeWith({ retryPolicy: fixedRetry(3) })] });
      const result = runActionResolutionValidation(model);
      expect(result.issues.map((i) => i.code)).toContain('WF_ACTION_IDEMPOTENCY_INCOMPATIBLE');
    });

    it('does not require replay safety for a PURE Action even with maxAttempts > 1 and no dedup guarantee', () => {
      registerActionDefinition(baseDefinition({ sideEffectClass: 'PURE', idempotency: { guarantee: 'NONE' } }));
      registerActionProvider(baseProvider());
      const model = baseModel({ nodes: [actionNodeWith({ retryPolicy: fixedRetry(5) })] });
      const result = runActionResolutionValidation(model);
      expect(result.issues).toHaveLength(0);
    });

    it('does not require replay safety when maxAttempts is 1 (no automatic replay at all)', () => {
      registerActionDefinition(baseDefinition({ sideEffectClass: 'WRITE_EXTERNAL', idempotency: { guarantee: 'NONE' } }));
      registerActionProvider(baseProvider());
      const model = baseModel({ nodes: [actionNodeWith({ retryPolicy: fixedRetry(1) })] });
      const result = runActionResolutionValidation(model);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('secret-literal scanning', () => {
    it('flags a literal string value at a declared secretReferenceFields pointer', () => {
      registerActionDefinition(baseDefinition({ secretReferenceFields: ['config.apiKey'] }));
      registerActionProvider(baseProvider());
      const model = baseModel({ nodes: [actionNodeWith({ config: mappingOf({ apiKey: lit('sk-super-secret') }) })] });
      const result = runActionResolutionValidation(model);
      expect(result.issues.some((i) => i.code === 'WF_DEF_INVALID_AWM' && i.path === 'config.apiKey')).toBe(true);
    });

    it('does not flag a secret-reference field that is an indirect (non-literal) expression', () => {
      registerActionDefinition(baseDefinition({ secretReferenceFields: ['config.apiKey'] }));
      registerActionProvider(baseProvider());
      const model = baseModel({ nodes: [actionNodeWith({ config: mappingOf({ apiKey: nodeOutput('other-node', ['secret']) }) })] });
      const result = runActionResolutionValidation(model);
      expect(result.issues.some((i) => i.code === 'WF_DEF_INVALID_AWM')).toBe(false);
    });

    it('resolves a secret-reference pointer rooted at "input" as well as "config"', () => {
      registerActionDefinition(baseDefinition({ secretReferenceFields: ['input.token'] }));
      registerActionProvider(baseProvider());
      const model = baseModel({ nodes: [actionNodeWith({ input: mappingOf({ token: lit('literal-token') }) })] });
      const result = runActionResolutionValidation(model);
      expect(result.issues.some((i) => i.code === 'WF_DEF_INVALID_AWM' && i.path === 'input.token')).toBe(true);
    });
  });
});
