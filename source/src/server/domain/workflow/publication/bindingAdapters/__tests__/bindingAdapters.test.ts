import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBindingAdapter } from '../eventBindingAdapter';
import { webhookBindingAdapter } from '../webhookBindingAdapter';
import {
  scheduleBindingAdapter,
  ensureReservedScheduledStartFunctionRegistered,
  RESERVED_SCHEDULED_START_FUNCTION_ID,
} from '../scheduleBindingAdapter';
import { getBindingActivationAdapter } from '../index';

/** p-68 WHOOK — real `WorkflowWebhookBinding` state lives in Prisma; mocked here so this unit test never touches a real database, same reasoning as the SCHEDULE adapter's `schedulerSettingsStore` mock below. */
const reactivateWebhookBindingIfConfigured = vi.fn(async () => undefined);
const disableWebhookBinding = vi.fn(async () => undefined);
vi.mock('../../../../../services/workflow/webhookSecretService', () => ({
  reactivateWebhookBindingIfConfigured: (...args: unknown[]) => reactivateWebhookBindingIfConfigured(...args),
  disableWebhookBinding: (...args: unknown[]) => disableWebhookBinding(...args),
}));

/**
 * `mergeSchedulerTask`/`removeSchedulerTask`/`getSchedulerSettingsFromFile` are real, file-backed
 * (`settings.json` at repo root via `SETTINGS_PATH`) — mocked here so this unit test never mutates
 * the real developer/CI settings file. The reserved managed-function record itself is NOT mocked;
 * `ensureReservedScheduledStartFunctionRegistered()` writes a real record to the same
 * `workspace/server-functions/` store every other FunctionFileStore integration test uses.
 */
let fakeTasks = new Map<string, Record<string, unknown>>();
vi.mock('../../../../../db/schedulerSettingsStore', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    mergeSchedulerTask: vi.fn((_settingsPath: string, task: { id: string }) => {
      fakeTasks.set(task.id, task);
      return { tasks: [...fakeTasks.values()] };
    }),
    removeSchedulerTask: vi.fn((_settingsPath: string, taskId: string) => {
      fakeTasks.delete(taskId);
      return { tasks: [...fakeTasks.values()] };
    }),
    getSchedulerSettingsFromFile: vi.fn(() => ({ tasks: [...fakeTasks.values()] })),
  };
});

const input = { workflowDefinitionId: 1, workflowRevisionId: 1, start: { type: 'EVENT' as const, targetNodeKey: 'n1', eventName: 'e' } };

describe('EVENT binding adapter (workflow event bus subscriber list)', () => {
  it('activate/deactivate/reconcile succeed when eventName is non-empty', async () => {
    for (const op of ['activate', 'deactivate', 'reconcile'] as const) {
      const outcome = await eventBindingAdapter[op](input);
      expect(outcome).toEqual({ ok: true });
    }
  });

  it('activate/reconcile reject a blank eventName as a definition error', async () => {
    const blank = { ...input, start: { type: 'EVENT' as const, targetNodeKey: 'n1', eventName: '   ' } };
    for (const op of ['activate', 'reconcile'] as const) {
      const outcome = await eventBindingAdapter[op](blank);
      expect(outcome).toMatchObject({ ok: false, code: 'WF_DEF_INVALID_AWM' });
    }
  });
});

describe('WEBHOOK binding adapter (p-68 WHOOK — real, backed by WorkflowWebhookBinding)', () => {
  const webhookInput = { ...input, start: { type: 'WEBHOOK' as const, targetNodeKey: 'n1', ingressBinding: { bindingType: 'HTTP', bindingId: 'AUTO' } } };

  beforeEach(() => {
    reactivateWebhookBindingIfConfigured.mockClear();
    disableWebhookBinding.mockClear();
  });

  it('activate re-points an existing binding at the new revision without creating/rotating a secret', async () => {
    const outcome = await webhookBindingAdapter.activate(webhookInput);
    expect(outcome).toEqual({ ok: true });
    expect(reactivateWebhookBindingIfConfigured).toHaveBeenCalledWith(1, 1);
  });

  it('deactivate disables the binding', async () => {
    const outcome = await webhookBindingAdapter.deactivate(webhookInput);
    expect(outcome).toEqual({ ok: true });
    expect(disableWebhookBinding).toHaveBeenCalledWith(1);
  });

  it('reconcile re-points the binding at the pinned revision, same as activate', async () => {
    const outcome = await webhookBindingAdapter.reconcile(webhookInput);
    expect(outcome).toEqual({ ok: true });
    expect(reactivateWebhookBindingIfConfigured).toHaveBeenCalledWith(1, 1);
  });

  it('rejects a non-HTTP bindingType as a definition error', async () => {
    const badInput = { ...webhookInput, start: { ...webhookInput.start, ingressBinding: { bindingType: 'MQTT', bindingId: 'x' } } };
    const outcome = await webhookBindingAdapter.activate(badInput);
    expect(outcome).toMatchObject({ ok: false, code: 'WF_DEF_INVALID_AWM' });
    expect(reactivateWebhookBindingIfConfigured).not.toHaveBeenCalled();
  });
});

describe('SCHEDULE binding adapter (WFV2-3 — real staged-registration wiring against SchedulerService)', () => {
  const scheduleInput = { ...input, workflowRevisionId: 42, start: { type: 'SCHEDULE' as const, targetNodeKey: 'n1', scheduledTaskBinding: { bindingType: 'CRON', bindingId: '*/5 * * * *' } } };

  beforeEach(() => {
    fakeTasks = new Map();
  });

  it('activate registers a real, enabled scheduler task pointing at the reserved function once the function exists', async () => {
    await ensureReservedScheduledStartFunctionRegistered();

    const outcome = await scheduleBindingAdapter.activate(scheduleInput);
    expect(outcome).toEqual({ ok: true });
    expect(fakeTasks.get('workflow-revision-42')).toMatchObject({
      id: 'workflow-revision-42',
      enabled: true,
      functionId: RESERVED_SCHEDULED_START_FUNCTION_ID,
      cron: '*/5 * * * *',
      payload: { workflowRevisionId: 42, workflowDefinitionId: 1 },
    });
  });

  it('activate is idempotent under retry (re-running merges, does not throw a duplicate-id error)', async () => {
    await ensureReservedScheduledStartFunctionRegistered();
    await scheduleBindingAdapter.activate(scheduleInput);
    const second = await scheduleBindingAdapter.activate(scheduleInput);
    expect(second).toEqual({ ok: true });
    expect(fakeTasks.size).toBe(1);
  });

  it('deactivate removes the scheduler task', async () => {
    await ensureReservedScheduledStartFunctionRegistered();
    await scheduleBindingAdapter.activate(scheduleInput);
    expect(fakeTasks.has('workflow-revision-42')).toBe(true);

    const outcome = await scheduleBindingAdapter.deactivate(scheduleInput);
    expect(outcome).toEqual({ ok: true });
    expect(fakeTasks.has('workflow-revision-42')).toBe(false);
  });

  it('deactivate is a no-op (not an error) when no task is currently registered', async () => {
    await ensureReservedScheduledStartFunctionRegistered();
    const outcome = await scheduleBindingAdapter.deactivate(scheduleInput);
    expect(outcome).toEqual({ ok: true });
  });

  it('reconcile re-merges the task (repairs drift) and is idempotent', async () => {
    await ensureReservedScheduledStartFunctionRegistered();
    const outcome = await scheduleBindingAdapter.reconcile(scheduleInput);
    expect(outcome).toEqual({ ok: true });
    expect(fakeTasks.get('workflow-revision-42')).toMatchObject({ enabled: true, cron: '*/5 * * * *' });
  });

  it('rejects a non-CRON bindingType as a definition error, not a missing-primitive error', async () => {
    await ensureReservedScheduledStartFunctionRegistered();
    const badInput = { ...scheduleInput, start: { ...scheduleInput.start, scheduledTaskBinding: { bindingType: 'HTTP_POLL', bindingId: 'x' } } };
    const outcome = await scheduleBindingAdapter.activate(badInput);
    expect(outcome).toMatchObject({ ok: false, code: 'WF_DEF_INVALID_AWM' });
  });
});

describe('getBindingActivationAdapter', () => {
  it('returns the matching adapter for EVENT/SCHEDULE/WEBHOOK', () => {
    expect(getBindingActivationAdapter('EVENT')).toBe(eventBindingAdapter);
    expect(getBindingActivationAdapter('SCHEDULE')).toBe(scheduleBindingAdapter);
    expect(getBindingActivationAdapter('WEBHOOK')).toBe(webhookBindingAdapter);
  });

  it('returns null for MANUAL_API, which never reaches this port (binding is NOT_REQUIRED)', () => {
    expect(getBindingActivationAdapter('MANUAL_API')).toBeNull();
  });
});
