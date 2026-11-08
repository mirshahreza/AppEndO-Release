import { validateLatinSlug } from '../../../../shared/lib/latinSlug';
import { WorkflowDomainError } from '../errors';
import { findWorkflowDefinitionByScopeAndKey } from '../workflowDefinitionRepository';
import type { WorkflowActorType } from '../types';
import type { JsonValue } from '../awm/types';
import { startWorkflowInstance, type StartWorkflowInstanceInput } from './startService';

/**
 * p-68 WHOOK — the shared "start a workflow by name" primitive behind all three trigger surfaces
 * (external webhook, Server Function direct-call utility, Server Function before/after hooks).
 * Names resolve only within scopeKey 'global' (no qualified/scoped names yet — deliberately out of
 * scope) and always to the definition's
 * `currentPublishedRevisionId` — there is no revision pinning.
 */

export type StartWorkflowByNameOptions = {
  /** true = caller awaits the created instance; false = fire-and-forget (rejection is logged, never thrown to the caller). */
  await: boolean;
  startedByType: WorkflowActorType;
  startedById?: number | null;
  startType: string;
};

export type ResolvedWorkflowStart = {
  workflowDefinitionId: number;
  workflowRevisionId: number;
};

/** Resolves a workflow name (global scope only) to its current published revision. Throws WF_DEF_NOT_STARTABLE if unknown or unpublished. */
export async function resolveWorkflowByName(name: string): Promise<ResolvedWorkflowStart> {
  const slugError = validateLatinSlug(name, { fieldLabel: 'Workflow name' });
  if (slugError) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', slugError, { name });
  }

  const definition = await findWorkflowDefinitionByScopeAndKey('global', name);
  if (!definition) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', `No workflow named "${name}" exists in the global scope.`, { name });
  }
  if (definition.currentPublishedRevisionId === null) {
    throw new WorkflowDomainError('WF_DEF_NOT_STARTABLE', `Workflow "${name}" has no published revision.`, { name });
  }

  return { workflowDefinitionId: definition.id, workflowRevisionId: definition.currentPublishedRevisionId };
}

export type StartWorkflowByNameResult = Awaited<ReturnType<typeof startWorkflowInstance>>;

/**
 * Resolves `name` and starts an instance. When `options.await` is false, the returned promise
 * still resolves immediately (fire-and-forget) — the actual start runs in the background and any
 * failure is swallowed after logging, matching Part C's "never let a hook break the caller" rule.
 */
export async function startWorkflowByName(
  name: string,
  input: JsonValue,
  options: StartWorkflowByNameOptions,
): Promise<StartWorkflowByNameResult | undefined> {
  const startInput: Omit<StartWorkflowInstanceInput, 'workflowRevisionId'> = {
    input,
    startedByType: options.startedByType,
    startedById: options.startedById,
    startType: options.startType,
  };

  const run = async (): Promise<StartWorkflowByNameResult> => {
    const { workflowRevisionId } = await resolveWorkflowByName(name);
    return startWorkflowInstance({ ...startInput, workflowRevisionId });
  };

  if (options.await) {
    return run();
  }

  run().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(`[workflowTriggerService] fire-and-forget start of "${name}" failed:`, error);
  });
  return undefined;
}
