import { WORKFLOW_ERROR_REGISTRY } from '../../errors';
import type { WorkflowBindingActivationAdapter, BindingActivationOutcome } from './types';

/**
 * EVENT start-binding adapter. The canonical subscriber list is the set of ACTIVE published
 * Workflow revisions whose `start.type === 'EVENT'` — no side table is required. Activation
 * therefore only validates that an event name was authored; `ingestWorkflowEvent` fans new
 * instances out at ingress time (`engine/eventStartFanout.ts`).
 */
const missingEventName = (): BindingActivationOutcome => ({
  ok: false,
  code: WORKFLOW_ERROR_REGISTRY.DEF_INVALID_AWM,
  message: 'EVENT start binding requires a non-empty eventName.',
});

export const eventBindingAdapter: WorkflowBindingActivationAdapter = {
  bindingType: 'EVENT',

  async activate(input) {
    if (input.start.type !== 'EVENT') {
      throw new Error('eventBindingAdapter.activate called with a non-EVENT start.');
    }
    if (!input.start.eventName.trim()) return missingEventName();
    return { ok: true };
  },

  async deactivate() {
    return { ok: true };
  },

  async reconcile(input) {
    if (input.start.type !== 'EVENT') {
      throw new Error('eventBindingAdapter.reconcile called with a non-EVENT start.');
    }
    if (!input.start.eventName.trim()) return missingEventName();
    return { ok: true };
  },
};
