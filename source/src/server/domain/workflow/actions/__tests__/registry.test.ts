import { describe, expect, it, beforeEach } from 'vitest';
import {
  registerActionDefinition,
  registerActionProvider,
  resolveExactProvider,
  resolveCapabilityProvider,
  listAvailableActionDefinitions,
  __resetActionRegistryForTests,
} from '../registry';
import type { ActionDefinition, ActionProviderRegistration } from '../types';

const baseDefinition = (overrides: Partial<ActionDefinition> = {}): ActionDefinition => ({
  key: 'test.action',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: { type: 'INLINE', schema: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  executionTimeoutMs: 5000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'PURE',
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

describe('Action registry', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
  });

  it('registers a definition and rejects a duplicate exact key/version', () => {
    registerActionDefinition(baseDefinition());
    expect(() => registerActionDefinition(baseDefinition())).toThrow();
  });

  it('rejects registering a provider for an unregistered Action', () => {
    expect(() => registerActionProvider(baseProvider())).toThrow();
  });

  it('lists only AVAILABLE definitions in the read projection', () => {
    registerActionDefinition(baseDefinition());
    registerActionDefinition(baseDefinition({ key: 'test.unavailable', availability: 'UNAVAILABLE' }));
    const listed = listAvailableActionDefinitions();
    expect(listed.map((d) => d.key)).toEqual(['test.action']);
  });

  it('resolves an EXACT_PROVIDER by exact identity', () => {
    registerActionDefinition(baseDefinition());
    registerActionProvider(baseProvider());
    const resolved = resolveExactProvider('test.action', '1', 'core', '1');
    expect(resolved.providerId).toBe('core');
  });

  it('throws WF_ACTION_IMPLEMENTATION_UNAVAILABLE for an unregistered exact provider', () => {
    registerActionDefinition(baseDefinition());
    expect(() => resolveExactProvider('test.action', '1', 'ghost', '1')).toMatchObject({});
    try {
      resolveExactProvider('test.action', '1', 'ghost', '1');
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: 'WF_ACTION_IMPLEMENTATION_UNAVAILABLE' });
    }
  });

  describe('CAPABILITY_RESOLVED tuple ordering (doc 04 section 7)', () => {
    it('orders by registryPriority ASC first', () => {
      registerActionDefinition(baseDefinition());
      registerActionProvider(baseProvider({ providerId: 'low-priority', registryPriority: 2000, providesCapabilities: ['http'] }));
      registerActionProvider(baseProvider({ providerId: 'high-priority', registryPriority: 500, providesCapabilities: ['http'] }));
      const result = resolveCapabilityProvider('test.action', '1', ['http'], () => true);
      expect(result.winner.providerId).toBe('high-priority');
    });

    it('orders by contributorTypeOrder ASC when priority ties (CORE=0 before PLATFORM=1 before PACKAGE=2)', () => {
      registerActionDefinition(baseDefinition());
      registerActionProvider(baseProvider({ providerId: 'package-provider', contributorType: 'PACKAGE', providesCapabilities: ['http'] }));
      registerActionProvider(baseProvider({ providerId: 'core-provider', contributorType: 'CORE', providesCapabilities: ['http'] }));
      registerActionProvider(baseProvider({ providerId: 'platform-provider', contributorType: 'PLATFORM', providesCapabilities: ['http'] }));
      const result = resolveCapabilityProvider('test.action', '1', ['http'], () => true);
      expect(result.winner.providerId).toBe('core-provider');
    });

    it('orders by providerId ASC (ordinal) when priority and contributorType tie', () => {
      registerActionDefinition(baseDefinition());
      registerActionProvider(baseProvider({ providerId: 'zzz', providesCapabilities: ['http'] }));
      registerActionProvider(baseProvider({ providerId: 'aaa', providesCapabilities: ['http'] }));
      const result = resolveCapabilityProvider('test.action', '1', ['http'], () => true);
      expect(result.winner.providerId).toBe('aaa');
    });

    it('filters out providers that do not satisfy required capabilities', () => {
      registerActionDefinition(baseDefinition());
      registerActionProvider(baseProvider({ providerId: 'incapable', providesCapabilities: ['other'] }));
      registerActionProvider(baseProvider({ providerId: 'capable', providesCapabilities: ['http', 'other'] }));
      const result = resolveCapabilityProvider('test.action', '1', ['http'], () => true);
      expect(result.winner.providerId).toBe('capable');
      expect(result.rejectedHigherRanked.some((r) => r.providerId === 'incapable')).toBe(true);
    });

    it('filters out unauthorized providers even if otherwise higher-ranked', () => {
      registerActionDefinition(baseDefinition());
      registerActionProvider(baseProvider({ providerId: 'unauthorized', registryPriority: 1, providesCapabilities: ['http'] }));
      registerActionProvider(baseProvider({ providerId: 'authorized', registryPriority: 999, providesCapabilities: ['http'] }));
      const result = resolveCapabilityProvider('test.action', '1', ['http'], (p) => p.providerId === 'authorized');
      expect(result.winner.providerId).toBe('authorized');
    });

    it('throws WF_ACTION_IMPLEMENTATION_UNAVAILABLE when no provider is capable/authorized', () => {
      registerActionDefinition(baseDefinition());
      registerActionProvider(baseProvider({ providesCapabilities: ['other'] }));
      try {
        resolveCapabilityProvider('test.action', '1', ['http'], () => true);
        expect.unreachable();
      } catch (error) {
        expect(error).toMatchObject({ code: 'WF_ACTION_IMPLEMENTATION_UNAVAILABLE' });
      }
    });

    it('registration order/iteration order never affects the winner (deterministic tuple only)', () => {
      registerActionDefinition(baseDefinition());
      registerActionProvider(baseProvider({ providerId: 'b', providesCapabilities: ['http'] }));
      registerActionProvider(baseProvider({ providerId: 'a', providesCapabilities: ['http'] }));
      registerActionProvider(baseProvider({ providerId: 'c', providesCapabilities: ['http'] }));
      const result = resolveCapabilityProvider('test.action', '1', ['http'], () => true);
      expect(result.winner.providerId).toBe('a');
    });
  });

  it('rejects an Action definition missing a required deduplicationWindowMs for DEDUPLICATED idempotency', () => {
    expect(() => registerActionDefinition(baseDefinition({ idempotency: { guarantee: 'DEDUPLICATED' } }))).toThrow();
  });

  it('rejects a DETERMINISTIC Action that declares agenticConstraints', () => {
    expect(() =>
      registerActionDefinition(
        baseDefinition({
          executionMode: 'DETERMINISTIC',
          agenticConstraints: { allowedToolActionRefs: [], maximumTurns: 1, maximumToolCalls: 1, memoryPolicy: 'NONE' },
        }),
      ),
    ).toThrow();
  });
});
