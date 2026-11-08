import { reactivateWebhookBindingIfConfigured, disableWebhookBinding } from '../../../../services/workflow/webhookSecretService';
import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import type { WorkflowBindingActivationAdapter, BindingActivationOutcome } from './types';

/**
 * WEBHOOK start-binding adapter (p-68 WHOOK). Unlike SCHEDULE's `scheduledTaskBinding.bindingId`
 * (the author-facing cron string), a webhook has no author-facing configuration — the secret is
 * server-generated, never authored — so `ingressBinding` stays a fixed `{ bindingType: 'HTTP',
 * bindingId: 'AUTO' }` placeholder the Designer sets automatically; all real state (the secret hash,
 * enablement, which revision it targets) lives in the `WorkflowWebhookBinding` table, keyed by
 * `workflowDefinitionId` — same "real state lives in a side-store, not in bindingId" shape as
 * `scheduleBindingAdapter.ts`.
 *
 * `activate`/`reconcile` never rotate OR create a secret — a webhook secret is only ever born from
 * the explicit admin "Generate" action (`webhookSecretService.rotateWebhookSecret`), never as a
 * side effect of publishing (see `reactivateWebhookBindingIfConfigured`'s doc comment for why:
 * auto-generating here would produce a secret nobody could ever retrieve). Publishing a workflow
 * whose start type is WEBHOOK succeeds regardless of whether a secret has been generated yet — the
 * admin can generate the URL before or after the first publish.
 */
const invalidBindingType = (bindingType: string): BindingActivationOutcome => ({
  ok: false,
  code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM,
  message: `WEBHOOK start binding's ingressBinding.bindingType must be "HTTP" (got "${bindingType}").`,
});

export const webhookBindingAdapter: WorkflowBindingActivationAdapter = {
  bindingType: 'WEBHOOK',

  async activate(input) {
    if (input.start.type !== 'WEBHOOK') {
      throw new Error('webhookBindingAdapter.activate called with a non-WEBHOOK start.');
    }
    const { bindingType } = input.start.ingressBinding;
    if (bindingType !== 'HTTP') return invalidBindingType(bindingType);

    await reactivateWebhookBindingIfConfigured(input.workflowDefinitionId, input.workflowRevisionId);
    return { ok: true };
  },

  async deactivate(input) {
    await disableWebhookBinding(input.workflowDefinitionId);
    return { ok: true };
  },

  async reconcile(input) {
    if (input.start.type !== 'WEBHOOK') {
      throw new Error('webhookBindingAdapter.reconcile called with a non-WEBHOOK start.');
    }
    const { bindingType } = input.start.ingressBinding;
    if (bindingType !== 'HTTP') return invalidBindingType(bindingType);

    // Idempotent by construction — re-ensures the row is active for the pinned revision without
    // rotating the secret, same "repair drift back to the pinned binding" contract as activate.
    await reactivateWebhookBindingIfConfigured(input.workflowDefinitionId, input.workflowRevisionId);
    return { ok: true };
  },
};
