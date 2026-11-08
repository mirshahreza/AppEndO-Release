import crypto from 'node:crypto';
import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import { listAvailableActionDefinitions } from '../../../../domain/workflow/actions/registry';
import { listPackageActionDefinitions } from '../../../../domain/workflow/actions/packageActionRegistry';
import { getActionDefinitionWithPackages, resolveCapabilityProviderWithPackages } from '../../../../domain/workflow/actions/actionResolutionWithPackages';
import { resolveWorkflowSecretFromEnv } from '../../../../domain/workflow/engine/secretResolution';
import type { ActionDefinition, ActionExecutorContext } from '../../../../domain/workflow/actions/types';
import type { JsonValue } from '../../../../domain/workflow/awm/types';

/**
 * p-99/WFT-4 — connects the workflow Action catalog (CORE/PLATFORM + package-contributed,
 * `actionResolutionWithPackages.ts`) directly to the AppEndoo agent's `ToolRegistry`, as TWO
 * generic tools rather than one tool per action (~74+ and growing) — matching this project's own
 * "few general tools, not dozens of single-purpose ones" direction (p-98 audit) and avoiding
 * flooding the agent's tool list every time a new Action ships. This is deliberately NOT a real
 * MCP server (see the p-99 plan's WFT-4 decision note) — it is an in-process adapter reusing the
 * same Action Registry the workflow engine dispatches against, with no network protocol involved.
 *
 * V1 safety boundary, deliberately narrower than a real workflow's ON_ERROR/saga-backed dispatch:
 * only `sideEffectClass !== 'WRITE_EXTERNAL'` Actions are invocable here (data transforms, crypto,
 * text/date, web fetch/search, identity reads, AI calls, read-only DB queries, ...). An Action with
 * a real external write effect (CMS writes, email sends, ...) is excluded — those still require a
 * real workflow definition, consistent with this agent's existing draft-then-confirm posture for
 * anything that writes. `AGENTIC` executionMode actions are excluded too (none exist in the
 * catalog today, per `types.ts`'s own doc comment on why AGENTIC is unused — excluding by
 * construction rather than assuming that never changes).
 */

export const LIST_WORKFLOW_ACTIONS_TOOL_NAME = 'list_workflow_actions';
export const INVOKE_WORKFLOW_ACTION_TOOL_NAME = 'invoke_workflow_action';

const MAX_INVOKE_TIMEOUT_MS = 30_000;

export const isActionInvocableFromAgent = (definition: ActionDefinition): boolean => (
  definition.availability === 'AVAILABLE'
  && definition.executionMode === 'DETERMINISTIC'
  && definition.sideEffectClass !== 'WRITE_EXTERNAL'
);

function listInvocableActionDefinitions(): ActionDefinition[] {
  const seen = new Set<string>();
  const combined: ActionDefinition[] = [];
  for (const definition of [...listAvailableActionDefinitions(), ...listPackageActionDefinitions()]) {
    const key = `${definition.key}@${definition.version}`;
    if (seen.has(key)) continue; // CORE/PLATFORM wins over a same-key package entry — listed first.
    seen.add(key);
    combined.push(definition);
  }
  return combined.filter(isActionInvocableFromAgent);
}

export const executeListWorkflowActions = (args: Record<string, unknown>) => {
  const categoryFilter = typeof args.category === 'string' ? args.category.trim() : '';
  const items = listInvocableActionDefinitions()
    .filter((definition) => !categoryFilter || definition.key.startsWith(`${categoryFilter}.`))
    .map((definition) => ({
      key: definition.key,
      version: definition.version,
      contributor: definition.contributor,
      sideEffectClass: definition.sideEffectClass,
      riskClass: definition.riskClass,
      tags: definition.tags,
      configSchema: definition.configSchema,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    ok: true as const,
    summary: `Listed ${items.length} invocable workflow action(s)${categoryFilter ? ` matching "${categoryFilter}.*"` : ''}.`,
    data: { items, totalCount: items.length },
  };
};

const syntheticAgentActionContext = (actionKey: string): ActionExecutorContext => ({
  workflowInstanceId: 'AGENT_TOOL',
  nodeInstanceId: `AGENT_TOOL:${actionKey}`,
  logicalInvocationId: `AGENT_TOOL:${actionKey}:${crypto.randomUUID()}`,
  idempotencyKey: `AGENT_TOOL:${actionKey}:${crypto.randomUUID()}`,
  effectiveIdentity: { type: 'SYSTEM', id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: resolveWorkflowSecretFromEnv,
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
});

const asJsonObject = (value: unknown): JsonValue => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonValue : {}
);

export const executeInvokeWorkflowAction = async (args: Record<string, unknown>) => {
  const actionKey = typeof args.actionKey === 'string' ? args.actionKey.trim() : '';
  const actionVersion = typeof args.actionVersion === 'string' ? args.actionVersion.trim() : '';
  if (!actionKey || !actionVersion) {
    return { ok: false as const, summary: 'actionKey and actionVersion are required — call list_workflow_actions first to find them.', error: 'missing_action_ref' };
  }

  const registered = getActionDefinitionWithPackages(actionKey, actionVersion);
  if (!registered) {
    return { ok: false as const, summary: `Workflow action "${actionKey}@${actionVersion}" was not found.`, error: 'action_not_found' };
  }
  const { definition } = registered;
  if (!isActionInvocableFromAgent(definition)) {
    return {
      ok: false as const,
      summary: `Workflow action "${actionKey}@${actionVersion}" cannot be invoked directly (sideEffectClass=${definition.sideEffectClass}, executionMode=${definition.executionMode}, availability=${definition.availability}). Actions with external write effects need a real workflow definition.`,
      error: 'action_not_invocable',
    };
  }

  let executor;
  try {
    executor = resolveCapabilityProviderWithPackages(actionKey, actionVersion, definition.requiredCapabilities, () => true).winner.executor;
  } catch (error) {
    return { ok: false as const, summary: `No provider is registered for "${actionKey}@${actionVersion}".`, error: error instanceof Error ? error.message : String(error) };
  }

  const config = asJsonObject(args.config);
  const input = asJsonObject(args.input);
  const timeoutMs = Math.min(definition.executionTimeoutMs, MAX_INVOKE_TIMEOUT_MS);

  let result;
  try {
    result = await Promise.race([
      executor.execute(syntheticAgentActionContext(actionKey), config, input),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Action "${actionKey}@${actionVersion}" exceeded ${timeoutMs}ms.`)), timeoutMs)),
    ]);
  } catch (error) {
    return { ok: false as const, summary: error instanceof Error ? error.message : String(error), error: 'action_timeout_or_throw' };
  }

  if (result.status === 'SUCCEEDED') {
    return { ok: true as const, summary: `Action "${actionKey}@${actionVersion}" succeeded.`, data: { output: result.output } };
  }
  return { ok: false as const, summary: `Action "${actionKey}@${actionVersion}" failed: ${result.safeMessage}`, error: result.errorCode };
};

export const createWorkflowActionsTools = (): NativeToolDefinition[] => [
  {
    name: LIST_WORKFLOW_ACTIONS_TOOL_NAME,
    description: 'List workflow Actions (AppEndO\'s built-in + package-contributed toolbox) invocable via invoke_workflow_action — read-only/computational actions only (data transforms, crypto, text, date, web fetch/search, identity reads, AI calls, read-only DB queries). Actions with external write effects (CMS writes, emails, ...) are excluded; those need a real workflow definition. Optionally filter by a key-prefix category (e.g. "crypto", "identity").',
    group: 'workflow',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional key-prefix filter, e.g. "data", "crypto", "identity", "web".' },
      },
    },
    execute: async (args) => executeListWorkflowActions(args),
  },
  {
    name: INVOKE_WORKFLOW_ACTION_TOOL_NAME,
    description: 'Invoke one workflow Action by exact key + version, outside of any workflow instance. Call list_workflow_actions first to discover available keys and their config/input JSON Schemas.',
    group: 'workflow',
    parameters: {
      type: 'object',
      properties: {
        actionKey: { type: 'string', description: 'Exact action key from list_workflow_actions, e.g. "crypto.hash".' },
        actionVersion: { type: 'string', description: 'Exact action version from list_workflow_actions, e.g. "1".' },
        config: { type: 'object', description: 'Author-time config values, matching the action\'s configSchema.' },
        input: { type: 'object', description: 'Per-invocation input values, matching the action\'s inputSchema.' },
      },
      required: ['actionKey', 'actionVersion'],
    },
    execute: async (args) => executeInvokeWorkflowAction(args),
  },
];
