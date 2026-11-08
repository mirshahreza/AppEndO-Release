/**
 * Bug found (parity audit item 35): in Interactive Preview, `executeDesignerMutation` returned
 * normally after HTTP errors (only calling onError), so `.then(() => runDynamicActions...)` always
 * ran the success chain. Export already throws on `!response.ok`. Fixed by rejecting after onError
 * and gating success trueActions on a resolved `true` from the mutation helpers.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  executeDesignerMutation,
} from '../bindingMutationRuntime';
import type { ResolvedEventBinding } from '../bindingEngine';

const baseBinding = (overrides: Partial<ResolvedEventBinding> = {}): ResolvedEventBinding => ({
  bindingKey: 'event:onClick',
  nodeId: 'btn1',
  targetEvent: 'onClick',
  actionType: 'POST',
  endpoint: '/api/orders',
  urlParams: {},
  headers: {},
  definition: {
    sourceType: 'apiRef',
    bindingRole: 'event',
    targetEvent: 'onClick',
    endpoint: '/api/orders',
    actionType: 'POST',
  },
  ...overrides,
});

describe('mutation success chain only on HTTP ok (item 35)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects after onError when the mutation HTTP response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'validation failed' }),
      text: async () => 'validation failed',
    } as unknown as Response);

    const onError = vi.fn();
    const onSuccess = vi.fn();

    await expect(
      executeDesignerMutation(baseBinding(), {}, { name: 'x' }, { onError, onSuccess }),
    ).rejects.toThrow();

    expect(onError).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('resolves true on HTTP ok so callers can run success actions', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    } as unknown as Response);

    const onError = vi.fn();
    const onSuccess = vi.fn();
    const ok = await executeDesignerMutation(baseBinding(), {}, { name: 'x' }, { onError, onSuccess });

    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(null);
  });

  it('preview success-chain helper only runs when mutation resolves true', async () => {
    const runSuccess = (mutation: Promise<boolean>): Promise<boolean> =>
      mutation
        .then((succeeded) => Boolean(succeeded))
        .catch(() => false);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
      text: async () => 'boom',
    } as unknown as Response);

    const onError = vi.fn();
    const chainedOnFailure = await runSuccess(
      executeDesignerMutation(baseBinding(), {}, { name: 'x' }, { onError }),
    );
    expect(chainedOnFailure).toBe(false);
    expect(onError).toHaveBeenCalled();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    } as unknown as Response);

    const chainedOnSuccess = await runSuccess(
      executeDesignerMutation(baseBinding(), {}, { name: 'x' }, { onError: vi.fn() }),
    );
    expect(chainedOnSuccess).toBe(true);
  });
});
