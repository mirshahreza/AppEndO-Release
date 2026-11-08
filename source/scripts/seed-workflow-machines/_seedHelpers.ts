/** Shared helpers for p-89 workflow machine seed scripts. */
import {
  createWorkflowDefinition,
  listWorkflowDefinitions,
  updateWorkflowDefinitionDraft,
} from '../../src/server/domain/workflow/workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../src/server/domain/workflow/publication/workflowPublicationService';
import { dispatchNode } from '../../src/server/domain/workflow/engine/dispatchService';
import { listNodeInstancesForInstance } from '../../src/server/domain/workflow/workflowNodeInstanceRepository';
import { claimWorkItem, completeWorkItem } from '../../src/server/domain/workflow/engine/workItemService';
import { getWorkItemByNodeInstance } from '../../src/server/domain/workflow/workItemRepository';
import type { WorkflowModel, CanonicalMapping, CanonicalExpression } from '../../src/server/domain/workflow/awm/types';
import { lit } from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import { prisma, fromUserId } from '../../src/server/domain/users/prismaHelpers';
import { listRoleMemberSummaries } from '../../src/server/domain/users/userRoleRepository';
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { reloadAppSettingsCacheFromDatabase } from '../../src/server/services/settings/appSettingsCache';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';

import { validateWorkflowDraftForPublication } from '../../src/server/domain/workflow/publication/publicationValidator';
import {
  findManagedFunctionByIdFromStore,
  updateManagedFunctionInStore,
} from '../../src/core/functions/FunctionFileStore';
import type { ServerFunctionHooksConfig } from '../../src/shared/api/contracts/server-functions/hooks';

/** Prisma + settings cache + core Actions — required for email/CMS/identity live seeds. */
export async function bootWorkflowMachineSeed(): Promise<void> {
  await initPrismaControlPlane(SETTINGS_PATH);
  await reloadAppSettingsCacheFromDatabase();
  registerCoreActionPack();
}

/**
 * Persist an after-hook on a managed Data API function and bump `index.json` so the
 * running server's ManagedFunctionRouteRegistry reloads (raw metadata writes alone do not).
 */
export function wireManagedFunctionAfterHook(
  functionId: string,
  workflowName: string,
  fields: string[] = ['data'],
): void {
  const existing = findManagedFunctionByIdFromStore(functionId);
  if (!existing) {
    throw new Error(`Managed function "${functionId}" not found in FunctionFileStore`);
  }
  const hooks: ServerFunctionHooksConfig = {
    ...(existing.hooks ?? {}),
    after: { workflowName, fields },
  };
  updateManagedFunctionInStore(functionId, {
    name: existing.name,
    folder: existing.folder,
    method: existing.method,
    path: existing.path,
    code: existing.code,
    language: existing.language,
    testPayload: existing.test_payload ?? '{}',
    runtimeVersion: existing.runtime_version ?? 'v1',
    memoryLimit: existing.memory_limit ?? 128,
    timeoutMs: existing.timeout_ms ?? 30_000,
    useGlobalConfig: existing.use_global_config !== false,
    enableLogs: existing.enable_logs !== false,
    cacheEnabled: existing.cache_enabled === true,
    cacheTtlMs: existing.cache_ttl_ms ?? 300_000,
    cacheByParam: existing.cache_by_param === true,
    cacheByUser: existing.cache_by_user === true,
    engineType: existing.engine_type,
    metadataJson: existing.metadata_json,
    accessControl: existing.access_control,
    hooks,
  });
  console.log(
    `[seed] wired after-hook on ${functionId} → workflow "${workflowName}" (fields: ${fields.join(', ')}; index bumped)`,
  );
}

export const ACTION = (actionKey: string) => ({
  type: 'EXACT_PROVIDER' as const,
  action: { actionKey, actionVersion: '1' },
  providerId: 'core',
  providerVersion: '1',
});

export const NO_RETRY = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

export const templateInput = (template: string, variables: Record<string, CanonicalExpression>): CanonicalMapping => ({
  type: 'OBJECT',
  fields: {
    template: { type: 'EXPRESSION', expression: lit(template) },
    variables: {
      type: 'OBJECT',
      fields: Object.fromEntries(
        Object.entries(variables).map(([k, expression]) => [k, { type: 'EXPRESSION' as const, expression }]),
      ),
    },
  },
});

export async function ensurePublished(definitionKey: string, model: WorkflowModel): Promise<{ definitionId: number; revisionId: number }> {
  const assertPublished = async (revision: { id: number; revisionNumber: number; publicationStatus: string }, definitionId: number) => {
    if (revision.publicationStatus === 'PUBLISHED') return;
    const report = await validateWorkflowDraftForPublication(model, 'global');
    throw new Error(
      `Publish rejected for ${definitionKey}: ${revision.publicationStatus}\n${report.issues.map((i) => `${i.severity}/${i.code}: ${i.message}`).join('\n')}`,
    );
  };

  const existing = await listWorkflowDefinitions('global');
  const already = existing.find((d) => d.key === definitionKey);
  if (already) {
    const fresh = await updateWorkflowDefinitionDraft(already.id, already.draftVersion, {
      draftDefinitionJson: JSON.stringify(model),
    });
    const { revision } = await publishWorkflowDefinition(fresh.id, fresh.draftVersion);
    await assertPublished(revision, fresh.id);
    console.log(`[seed] updated+published "${definitionKey}" (id=${fresh.id}, rev #${revision.revisionNumber}).`);
    return { definitionId: fresh.id, revisionId: revision.id };
  }
  const definition = await createWorkflowDefinition({
    scopeKey: 'global',
    key: definitionKey,
    draftDefinitionJson: JSON.stringify(model),
    creationMode: 'NEW',
  });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  await assertPublished(revision, definition.id);
  console.log(`[seed] published "${definitionKey}" (id=${definition.id}, rev #${revision.revisionNumber}).`);
  return { definitionId: definition.id, revisionId: revision.id };
}

export async function pickUnlockedUser() {
  const row = await prisma().baseUser.findFirst({
    where: { locked: 0 },
    orderBy: { id: 'asc' },
    select: { id: true, username: true, email: true },
  });
  return row ? { userId: fromUserId(row.id), username: row.username, email: row.email } : null;
}

export async function pickRoleMembers(roleName: string, min = 1) {
  const result = await listRoleMemberSummaries(roleName);
  if ('roleMissing' in result) throw new Error(`Role ${roleName} missing`);
  if (result.members.length < min) {
    throw new Error(`Need >=${min} ${roleName} members; found ${result.members.length}`);
  }
  return result.members;
}

export async function drainAutomated(instanceId: number, leaseOwnerId: string, maxSteps = 50) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const ready = nodes.find((n) => n.status === 'READY');
    if (ready) {
      await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
      continue;
    }
    // Wait out in-flight ACTION/FOR_EACH dispatches before concluding the drain.
    if (nodes.some((n) => n.status === 'RUNNING')) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    return;
  }
}

export async function dispatchUntilKey(instanceId: number, semanticNodeKey: string, leaseOwnerId: string, maxSteps = 50) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const waiting = nodes.find((n) => n.semanticNodeKey === semanticNodeKey && n.status === 'WAITING_HUMAN');
    if (waiting) return waiting;
    const ended = nodes.find((n) => n.semanticNodeKey.startsWith('end-') && n.status === 'SUCCEEDED');
    if (ended) return null;
    const ready = nodes.find((n) => n.status === 'READY');
    if (ready) {
      await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
      continue;
    }
    if (nodes.some((n) => n.status === 'RUNNING')) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

export async function dispatchUntilAllWaiting(instanceId: number, keys: string[], leaseOwnerId: string, maxSteps = 80) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const waiting = nodes.filter((n) => keys.includes(n.semanticNodeKey) && n.status === 'WAITING_HUMAN');
    if (waiting.length >= keys.length) return waiting;
    const ready = nodes.find((n) => n.status === 'READY');
    if (ready) {
      await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
      continue;
    }
    if (nodes.some((n) => n.status === 'RUNNING')) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  const nodes = await listNodeInstancesForInstance(instanceId);
  return nodes.filter((n) => keys.includes(n.semanticNodeKey) && n.status === 'WAITING_HUMAN');
}

export async function completeWi(nodeInstanceId: number, actorUserId: number, outcome: string) {
  const item = await getWorkItemByNodeInstance(nodeInstanceId);
  if (!item) throw new Error(`No work item for node ${nodeInstanceId}`);
  await claimWorkItem({ workItemId: item.id, actorUserId });
  await completeWorkItem({ workItemId: item.id, actorUserId, outcome, output: null });
  console.log(`[seed] Work Item #${item.id} ${outcome} by #${actorUserId}`);
  return item.id;
}

export async function assertEnd(instanceId: number, endKey: string) {
  const nodes = await listNodeInstancesForInstance(instanceId);
  const end = nodes.find((n) => n.semanticNodeKey === endKey && n.status === 'SUCCEEDED');
  if (!end) {
    console.log(`[seed] statuses: ${nodes.map((n) => `${n.semanticNodeKey}:${n.status}`).join(', ')}`);
    throw new Error(`Did not reach ${endKey}`);
  }
  console.log(`[seed] reached ${endKey}.`);
}
