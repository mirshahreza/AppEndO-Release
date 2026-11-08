import type { ServerFunctionHookConfig } from '../../../shared/api/contracts/server-functions/hooks';
import { startWorkflowByName } from '../../domain/workflow/engine/workflowTriggerService';
import type { JsonValue } from '../../domain/workflow/awm/types';

/**
 * p-68 WHOOK Part C — fires a Server Function before/after hook. Always `await: false`
 * (fire-and-forget): the caller (`ServerFunctionService.execute()`) must never be slowed down or
 * broken by a hook failure, and never sees/uses the hook's own output — that's the whole point of
 * this being a notification, not an interceptor. Any resolution/start failure is logged and
 * otherwise swallowed by `startWorkflowByName` itself.
 */
export function fireServerFunctionHook(
  hook: ServerFunctionHookConfig | undefined,
  source: Record<string, unknown> | null | undefined,
): void {
  if (!hook || !hook.workflowName) return;

  const picked: Record<string, JsonValue> = {};
  for (const field of hook.fields) {
    if (source && Object.prototype.hasOwnProperty.call(source, field)) {
      picked[field] = source[field] as JsonValue;
    }
  }

  void startWorkflowByName(hook.workflowName, picked, {
    await: false,
    startedByType: 'SYSTEM',
    startType: 'SERVER_FUNCTION_HOOK',
  });
}
