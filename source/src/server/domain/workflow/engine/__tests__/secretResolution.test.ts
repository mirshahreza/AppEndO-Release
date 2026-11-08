import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// p-99/WFT-3 — `resolveWorkflowSecretFromEnv` now checks the encrypted vault before falling back
// to `process.env` (see `secretResolution.ts`'s doc comment). This suite is a unit suite, not a
// "(real DB)" one (per `docs/standards/workflow-engine-testing.md`'s naming convention) — mock the
// vault lookup so these tests never need a live database, and so "no value stored" (the only case
// most of these tests exercise) behaves exactly like the pre-vault pure-env-var lookup did.
const resolveWorkflowCredentialValueMock = vi.fn(async (name: string) => {
  const value = String(process.env[name] ?? '').trim();
  return value.length > 0 ? value : null;
});
vi.mock('../../workflowSecretReferenceRepository', () => ({
  resolveWorkflowCredentialValue: (...args: [string]) => resolveWorkflowCredentialValueMock(...args),
}));

import { resolveWorkflowSecretFromEnv, applySecretReferenceFields } from '../secretResolution';
import { invokeActionExecutorWithDeadline, type ResolvedActionProvider } from '../attemptService';
import type { ActionExecutor } from '../../actions/types';
import type { WorkflowExecutionAttemptRecord } from '../../types';

const ENV_KEY = 'WF_TEST_SECRET_REF__API_TOKEN';

describe('resolveWorkflowSecretFromEnv', () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('resolves a secret reference from process.env', async () => {
    process.env[ENV_KEY] = 'sk-live-abc123';
    await expect(resolveWorkflowSecretFromEnv(ENV_KEY)).resolves.toBe('sk-live-abc123');
  });

  it('throws when the referenced environment variable is unset', async () => {
    await expect(resolveWorkflowSecretFromEnv(ENV_KEY)).rejects.toThrow();
  });

  it('throws on an empty/whitespace secret reference', async () => {
    await expect(resolveWorkflowSecretFromEnv('   ')).rejects.toThrow();
  });

  it('prefers a stored vault value over an env var of the same name', async () => {
    process.env[ENV_KEY] = 'from-env-should-be-ignored';
    resolveWorkflowCredentialValueMock.mockResolvedValueOnce('from-vault');
    await expect(resolveWorkflowSecretFromEnv(ENV_KEY)).resolves.toBe('from-vault');
  });
});

describe('applySecretReferenceFields', () => {
  const resolveSecret = async (ref: string) => `resolved:${ref}`;

  it('resolves every string leaf under a pointed-to config subtree, leaving the rest untouched', async () => {
    const result = await applySecretReferenceFields({
      config: { headers: { Authorization: 'AUTH_TOKEN_ENV' }, otherField: 'left-alone' },
      actionInput: { url: 'https://example.com' },
      secretReferenceFields: ['config.headers'],
      resolveSecret,
    });
    expect(result.config).toEqual({ headers: { Authorization: 'resolved:AUTH_TOKEN_ENV' }, otherField: 'left-alone' });
    expect(result.actionInput).toEqual({ url: 'https://example.com' });
  });

  it('resolves pointers into actionInput ("input.*") as well as config', async () => {
    const result = await applySecretReferenceFields({
      config: {},
      actionInput: { credentials: ['REF_A', 'REF_B'] },
      secretReferenceFields: ['input.credentials'],
      resolveSecret,
    });
    expect(result.actionInput).toEqual({ credentials: ['resolved:REF_A', 'resolved:REF_B'] });
  });

  it('skips a pointer whose field the author omitted, without error', async () => {
    const result = await applySecretReferenceFields({
      config: {},
      actionInput: {},
      secretReferenceFields: ['config.headers'],
      resolveSecret,
    });
    expect(result.config).toEqual({});
  });

  it('propagates a resolveSecret rejection (e.g. missing env var)', async () => {
    const failing = async () => {
      throw new Error('boom');
    };
    await expect(
      applySecretReferenceFields({ config: { headers: { Authorization: 'X' } }, actionInput: {}, secretReferenceFields: ['config.headers'], resolveSecret: failing }),
    ).rejects.toThrow('boom');
  });
});

describe('invokeActionExecutorWithDeadline — secret substitution before executor call', () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  const baseAttempt: WorkflowExecutionAttemptRecord = {
    id: 1,
    workflowInstanceId: 1,
    nodeInstanceId: 1,
    attemptNumber: 1,
    actionKey: 'test.secret-echo',
    actionVersion: '1',
    logicalInvocationId: 'log-1',
    idempotencyKey: 'idem-1',
    status: 'STARTED',
    selectedProviderId: 'core',
    selectedProviderVersion: '1',
    selectedProviderFingerprint: 'fp',
    deadlineAt: null,
    logicalInvocationWindowMs: null,
    startedAt: null,
    completedAt: null,
    errorClass: null,
    errorCode: null,
    errorMessage: null,
    resultMetadataJson: null,
    stateVersion: 1,
    createdAt: null,
    updatedAt: null,
  };

  function resolvedProvider(secretReferenceFields: string[], executor: ActionExecutor): ResolvedActionProvider {
    return {
      actionKey: 'test.secret-echo',
      actionVersion: '1',
      actionFingerprint: 'fp',
      bindingMode: 'EXACT_PROVIDER',
      providerId: 'core',
      providerVersion: '1',
      providerFingerprint: 'fp',
      rejectedHigherRankedReasons: [],
      executor,
      executionTimeoutMs: 5_000,
      idempotencyGuarantee: 'NONE',
      secretReferenceFields,
    };
  }

  it('replaces the reference string with the resolved secret before the executor sees it', async () => {
    process.env[ENV_KEY] = 'sk-live-real-token';
    let observedHeaders: unknown;
    const executor: ActionExecutor = {
      async execute(_context, config) {
        observedHeaders = (config as { headers: unknown }).headers;
        return { status: 'SUCCEEDED', output: null };
      },
    };

    const { result } = await invokeActionExecutorWithDeadline({
      resolvedProvider: resolvedProvider(['config.headers'], executor),
      attempt: baseAttempt,
      workflowInstanceId: 1,
      nodeInstanceId: 1,
      nodeStateVersion: 1,
      leaseOwnerId: 'test-owner',
      effectiveIdentity: { type: 'SYSTEM', id: null },
      config: { headers: { Authorization: ENV_KEY } },
      actionInput: {},
      executionTimeoutMs: 5_000,
    });

    expect(result.outcome).toBe('SUCCEEDED');
    expect(observedHeaders).toEqual({ Authorization: 'sk-live-real-token' });
  });

  it('fails the attempt (not an uncaught exception) when the secret reference cannot be resolved', async () => {
    const executor: ActionExecutor = {
      async execute() {
        throw new Error('executor should never run when secret resolution fails');
      },
    };

    const { result } = await invokeActionExecutorWithDeadline({
      resolvedProvider: resolvedProvider(['config.headers'], executor),
      attempt: baseAttempt,
      workflowInstanceId: 1,
      nodeInstanceId: 1,
      nodeStateVersion: 1,
      leaseOwnerId: 'test-owner',
      effectiveIdentity: { type: 'SYSTEM', id: null },
      config: { headers: { Authorization: ENV_KEY } },
      actionInput: {},
      executionTimeoutMs: 5_000,
    });

    expect(result).toMatchObject({ outcome: 'FAILED', errorCode: 'WF_EXEC_SECRET_RESOLUTION_FAILED', errorClass: 'SECRET_RESOLUTION_FAILED' });
  });

  it('does not touch config/actionInput when the resolved provider declares no secretReferenceFields', async () => {
    let observedHeaders: unknown;
    const executor: ActionExecutor = {
      async execute(_context, config) {
        observedHeaders = (config as { headers: unknown }).headers;
        return { status: 'SUCCEEDED', output: null };
      },
    };

    const { result } = await invokeActionExecutorWithDeadline({
      resolvedProvider: resolvedProvider([], executor),
      attempt: baseAttempt,
      workflowInstanceId: 1,
      nodeInstanceId: 1,
      nodeStateVersion: 1,
      leaseOwnerId: 'test-owner',
      effectiveIdentity: { type: 'SYSTEM', id: null },
      config: { headers: { Authorization: ENV_KEY } },
      actionInput: {},
      executionTimeoutMs: 5_000,
    });

    expect(result.outcome).toBe('SUCCEEDED');
    expect(observedHeaders).toEqual({ Authorization: ENV_KEY });
  });
});
