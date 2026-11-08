import type { StartDefinition } from '../../awm/types';
import type { WorkflowBindingActivationAdapter } from './types';
import { eventBindingAdapter } from './eventBindingAdapter';
import { scheduleBindingAdapter } from './scheduleBindingAdapter';
import { webhookBindingAdapter } from './webhookBindingAdapter';

export type { WorkflowBindingActivationAdapter, BindingActivationInput, BindingActivationOutcome } from './types';
export { RESERVED_SCHEDULED_START_FUNCTION_ID } from './scheduleBindingAdapter';

/** `MANUAL_API` is intentionally absent — its binding is `NOT_REQUIRED` and never reaches this port (doc 03 section 10). */
const ADAPTERS_BY_BINDING_TYPE: Partial<Record<StartDefinition['type'], WorkflowBindingActivationAdapter>> = {
  EVENT: eventBindingAdapter,
  SCHEDULE: scheduleBindingAdapter,
  WEBHOOK: webhookBindingAdapter,
};

export function getBindingActivationAdapter(startType: StartDefinition['type']): WorkflowBindingActivationAdapter | null {
  return ADAPTERS_BY_BINDING_TYPE[startType] ?? null;
}
