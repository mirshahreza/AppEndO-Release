import { RESERVED_SCHEDULED_START_FUNCTION_ID } from '../../../../../shared/api/contracts/server-functions/reservedFunctions';
import { findManagedFunctionById, insertManagedFunctionRecord } from '../../../functions/functionRepository';
import { mergeSchedulerTask, removeSchedulerTask, getSchedulerSettingsFromFile } from '../../../../db/schedulerSettingsStore';
import { SETTINGS_PATH } from '../../../../config/settingsFile';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import type { WorkflowBindingActivationAdapter, BindingActivationOutcome, BindingActivationInput } from './types';

/**
 * SCHEDULE start-binding adapter. Repository Reality Audit (Slice 4) found AppEndO's real
 * Scheduled Task capability (`src/server/services/scheduler/scheduler.service.ts`) DOES support
 * the doc 03 section 11 "non-delivering staged registration" contract — a task created with
 * `enabled: false` is registered but `evaluateDueTasks` skips it, and flipping `enabled: true` is
 * the activation step.
 *
 * WFV2-3 (2026-07-17): the missing piece — the reserved managed function `functionId` every task
 * needs — is now wired for real, closing the gap p-61/p-62 flagged. Two design decisions, made
 * because the frozen AWM contract genuinely under-specifies them:
 *
 * 1. **`scheduledTaskBinding.bindingId` is the literal cron expression.** `CanonicalPlatformBindingRef`
 *    (`{ bindingType, bindingId }`) has no dedicated cron field, and no separate schedule-binding
 *    registry exists to look one up by id — `bindingId` is the only string an author can carry, so
 *    it is interpreted directly as the cron string. `bindingType` MUST be `'CRON'` (the only
 *    schedule kind this platform's `SchedulerService` understands); anything else is a definition
 *    error, not a missing-primitive error.
 * 2. **The reserved function never runs through the sandbox.** `executeServerFunction`'s sandboxed
 *    JS execution model (Node `vm` context in a worker thread) has no bridge to internal engine
 *    modules like `startWorkflowInstance` — only `req`/`res`-shaped objects and an optional
 *    `dbQuery` callback cross that boundary (Repository Reality Audit, WFV2-3). Building a
 *    sandbox-reachable HTTP round-trip back into the admin-only runtime API would need a
 *    service-to-service auth primitive this repo doesn't have. Instead, `jobServerFunctionExecutor.ts`
 *    intercepts this exact reserved `functionId` natively (before the sandbox ever runs) and calls
 *    `startWorkflowInstance` in-process — the registered function record's `code` is a
 *    documentation placeholder that is never executed.
 */
export { RESERVED_SCHEDULED_START_FUNCTION_ID } from '../../../../../shared/api/contracts/server-functions/reservedFunctions';
const RESERVED_SCHEDULED_START_FOLDER = 'workflow-engine';
const RESERVED_SCHEDULED_START_NAME = 'scheduled-start';

const scheduledTaskId = (input: BindingActivationInput): string => `workflow-revision-${input.workflowRevisionId}`;

const missingFunctionContract = (): BindingActivationOutcome => ({
  ok: false,
  code: WORKFLOW_ERROR_REGISTRY.MISSING_CANONICAL_PLATFORM_CONTRACT,
  message: `SCHEDULE start binding requires the reserved managed function "${RESERVED_SCHEDULED_START_FUNCTION_ID}" (Workflow's canonical scheduled-start entry point), which is not registered in this environment yet.`,
});

const invalidBindingType = (bindingType: string): BindingActivationOutcome => ({
  ok: false,
  code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM,
  message: `SCHEDULE start binding's scheduledTaskBinding.bindingType must be "CRON" (got "${bindingType}").`,
});

/**
 * Idempotent bootstrap registration for the reserved function record above. Call once at server
 * startup (`bootstrapFullRuntime.ts`) — safe to call on every boot, a no-op once the record exists.
 * The stored `code` documents that it is never executed; see the module doc comment.
 */
export async function ensureReservedScheduledStartFunctionRegistered(): Promise<void> {
  const existing = await findManagedFunctionById(RESERVED_SCHEDULED_START_FUNCTION_ID);
  if (existing) return;

  await insertManagedFunctionRecord({
    id: RESERVED_SCHEDULED_START_FUNCTION_ID,
    name: RESERVED_SCHEDULED_START_NAME,
    folder: RESERVED_SCHEDULED_START_FOLDER,
    method: 'POST',
    path: '/system/workflow-engine/scheduled-start',
    code: [
      '// Reserved system function — never executed.',
      '// jobServerFunctionExecutor.ts intercepts functionId "workflow-engine.scheduled-start"',
      '// natively and calls startWorkflowInstance() in-process instead of running this sandbox.',
      '// This placeholder exists only so the record satisfies SchedulerService.evaluateDueTasks\'s',
      '// "does the function exist" check (see scheduleBindingAdapter.ts).',
      'module.exports = function handler(req, res) {',
      '  res.status(500).json({ error: "This reserved function must never run through the sandbox." });',
      '};',
    ].join('\n'),
    language: 'js',
    testPayload: '{}',
    runtimeVersion: 'v20.x',
    memoryLimit: 128,
    timeoutMs: 5000,
    cacheEnabled: false,
    cacheTtlMs: 0,
    cacheByParam: false,
    cacheByUser: false,
    engineType: 'SANDBOX_JS',
    metadataJson: null,
    createdBy: null,
    updatedBy: null,
  });
}

export const scheduleBindingAdapter: WorkflowBindingActivationAdapter = {
  bindingType: 'SCHEDULE',

  async activate(input) {
    if (input.start.type !== 'SCHEDULE') {
      throw new Error('scheduleBindingAdapter.activate called with a non-SCHEDULE start.');
    }
    const managed = await findManagedFunctionById(RESERVED_SCHEDULED_START_FUNCTION_ID);
    if (!managed) return missingFunctionContract();

    const { bindingType, bindingId } = input.start.scheduledTaskBinding;
    if (bindingType !== 'CRON') return invalidBindingType(bindingType);

    mergeSchedulerTask(SETTINGS_PATH, {
      id: scheduledTaskId(input),
      name: `Workflow revision ${input.workflowRevisionId} scheduled start`,
      enabled: true,
      functionId: RESERVED_SCHEDULED_START_FUNCTION_ID,
      cron: bindingId,
      payload: { workflowRevisionId: input.workflowRevisionId, workflowDefinitionId: input.workflowDefinitionId },
      note: 'Managed by WorkflowPublicationService — do not edit manually; disable/archive the workflow definition instead.',
    });

    return { ok: true };
  },

  async deactivate(input) {
    const managed = await findManagedFunctionById(RESERVED_SCHEDULED_START_FUNCTION_ID);
    if (!managed) return missingFunctionContract();

    const settings = getSchedulerSettingsFromFile(SETTINGS_PATH);
    if (settings.tasks.some((task) => task.id === scheduledTaskId(input))) {
      removeSchedulerTask(SETTINGS_PATH, scheduledTaskId(input));
    }
    return { ok: true };
  },

  async reconcile(input) {
    if (input.start.type !== 'SCHEDULE') {
      throw new Error('scheduleBindingAdapter.reconcile called with a non-SCHEDULE start.');
    }
    const managed = await findManagedFunctionById(RESERVED_SCHEDULED_START_FUNCTION_ID);
    if (!managed) return missingFunctionContract();

    const { bindingType, bindingId } = input.start.scheduledTaskBinding;
    if (bindingType !== 'CRON') return invalidBindingType(bindingType);

    // Reconcile is idempotent by construction — re-merging is exactly "repair drift back to the
    // pinned binding definition" (doc 03 section 10's REENABLE_OR_RECONCILE), same as activate.
    mergeSchedulerTask(SETTINGS_PATH, {
      id: scheduledTaskId(input),
      name: `Workflow revision ${input.workflowRevisionId} scheduled start`,
      enabled: true,
      functionId: RESERVED_SCHEDULED_START_FUNCTION_ID,
      cron: bindingId,
      payload: { workflowRevisionId: input.workflowRevisionId, workflowDefinitionId: input.workflowDefinitionId },
      note: 'Managed by WorkflowPublicationService — do not edit manually; disable/archive the workflow definition instead.',
    });

    return { ok: true };
  },
};
