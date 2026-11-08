/**
 * p-68 WHOOK Part C — before/after workflow-trigger hooks on a Server Function. Deliberately
 * minimal compared to `accessControl.ts`: each hook is just "which workflow" plus "which fields to
 * forward" — always fire-and-forget (see `workflowTriggerService.startWorkflowByName` with
 * `await: false`), never a gate/interceptor over the function's own input or output.
 */
export type ServerFunctionHookConfig = {
  workflowName: string;
  fields: string[];
};

export type ServerFunctionHooksConfig = {
  before?: ServerFunctionHookConfig;
  after?: ServerFunctionHookConfig;
};

export const EMPTY_SERVER_FUNCTION_HOOKS: ServerFunctionHooksConfig = {};

const normalizeHookConfig = (value: unknown): ServerFunctionHookConfig | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Partial<ServerFunctionHookConfig>;
  const workflowName = typeof raw.workflowName === 'string' ? raw.workflowName.trim() : '';
  if (!workflowName) return undefined;
  const fields = Array.isArray(raw.fields)
    ? [...new Set(raw.fields.filter((f): f is string => typeof f === 'string' && f.trim().length > 0).map((f) => f.trim()))]
    : [];
  return { workflowName, fields };
};

export const normalizeServerFunctionHooks = (
  value: Partial<ServerFunctionHooksConfig> | null | undefined,
): ServerFunctionHooksConfig => {
  const before = normalizeHookConfig(value?.before);
  const after = normalizeHookConfig(value?.after);
  const result: ServerFunctionHooksConfig = {};
  if (before) result.before = before;
  if (after) result.after = after;
  return result;
};

export const parseServerFunctionHooks = (value: unknown): ServerFunctionHooksConfig => {
  if (!value) return EMPTY_SERVER_FUNCTION_HOOKS;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return EMPTY_SERVER_FUNCTION_HOOKS;
    try {
      return normalizeServerFunctionHooks(JSON.parse(trimmed) as Partial<ServerFunctionHooksConfig>);
    } catch {
      return EMPTY_SERVER_FUNCTION_HOOKS;
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return normalizeServerFunctionHooks(value as Partial<ServerFunctionHooksConfig>);
  }

  return EMPTY_SERVER_FUNCTION_HOOKS;
};
