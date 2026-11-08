import type { CanonicalPlatformBindingRef, StartDefinition } from '../../awm/types';

/**
 * Binding activation adapter port — doc 03 sections 10, 11; doc 02 section 13. One adapter per
 * `StartDefinition.type` that requires binding (`EVENT | SCHEDULE | WEBHOOK`; `MANUAL_API` never
 * goes through this port because its binding is `NOT_REQUIRED`). Each adapter is the sole boundary
 * between `WorkflowPublicationService` and the real canonical AppEndO platform primitive — the
 * service never talks to the scheduler/event/webhook primitive directly.
 */
export type BindingActivationOutcome = { ok: true } | { ok: false; code: string; message: string };

export type BindingActivationInput = {
  workflowDefinitionId: number;
  workflowRevisionId: number;
  start: StartDefinition;
};

export type WorkflowBindingActivationAdapter = {
  readonly bindingType: StartDefinition['type'];
  /** Attempt to make the binding deliver (doc 03 section 10's ACTIVATE_OR_RETRY_ACTIVATION → ACTIVATION_SUCCEEDS/FAILS decision). Idempotent under retry. */
  activate(input: BindingActivationInput): Promise<BindingActivationOutcome>;
  /** Make a delivering binding stop delivering without losing its registration (DISABLE_DEFINITION / ARCHIVE_DEFINITION). */
  deactivate(input: BindingActivationInput): Promise<BindingActivationOutcome>;
  /** Repair adapter drift back toward the delivering state required by the pinned binding definition (REENABLE_OR_RECONCILE) — never alters semantic content. */
  reconcile(input: BindingActivationInput): Promise<BindingActivationOutcome>;
};

export const bindingRefOf = (start: StartDefinition): CanonicalPlatformBindingRef | null => {
  if (start.type === 'SCHEDULE') return start.scheduledTaskBinding;
  if (start.type === 'WEBHOOK') return start.ingressBinding;
  return null;
};
