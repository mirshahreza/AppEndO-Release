/**
 * p-89 WFM-02 — `multi-stage-amount-approval`
 *
 * Real entities: base_users (identity.user-get), base_work_items (ADMIN then DEVELOPER ROLE queues),
 * communication.email-send when requester has email.
 *
 * Tiers (amount in workflow input — not a Finance table):
 *   <= 1000  → auto-approve + optional email
 *   <= 10000 → ADMIN Work Item
 *   > 10000  → ADMIN Work Item → DEVELOPER Work Item
 *
 * Run: `npx tsx scripts/seed-workflow-machines/multi-stage-amount-approval.ts`
 */
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import {
  createWorkflowDefinition,
  listWorkflowDefinitions,
  getWorkflowDefinitionById,
  updateWorkflowDefinitionDraft,
} from '../../src/server/domain/workflow/workflowDefinitionRepository';
import { prisma } from '../../src/server/domain/workflow/prismaHelpers';
import { publishWorkflowDefinition } from '../../src/server/domain/workflow/publication/workflowPublicationService';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import { dispatchNode } from '../../src/server/domain/workflow/engine/dispatchService';
import { listNodeInstancesForInstance } from '../../src/server/domain/workflow/workflowNodeInstanceRepository';
import { claimWorkItem, completeWorkItem } from '../../src/server/domain/workflow/engine/workItemService';
import { getWorkItemByNodeInstance } from '../../src/server/domain/workflow/workItemRepository';
import type { WorkflowModel, CanonicalMapping, CanonicalExpression } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel,
  endNode,
  decisionNode,
  decisionEdge,
  decisionDefaultEdge,
  actionNode,
  unconditionalEdge,
  workItemNode,
  workItemOutcomeEdge,
  lit,
  workflowInputPath,
  workflowVariable,
  nodeOutput,
  errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import { fromUserId } from '../../src/server/domain/users/prismaHelpers';

const DEFINITION_KEY = 'multi-stage-amount-approval';
const ACTION = (actionKey: string) => ({
  type: 'EXACT_PROVIDER' as const,
  action: { actionKey, actionVersion: '1' },
  providerId: 'core',
  providerVersion: '1',
});
const NO_RETRY = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

const templateInput = (template: string, variables: Record<string, CanonicalExpression>): CanonicalMapping => ({
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

const hasEmailCondition: CanonicalExpression = {
  op: 'AND',
  values: [
    { op: 'IS_NOT_NULL', value: workflowVariable('requesterEmail') },
    { op: 'NE', left: workflowVariable('requesterEmail'), right: lit('') },
  ],
};

const amountPath = workflowInputPath(['amount']);

const sharedWiInput: CanonicalMapping = {
  type: 'OBJECT',
  fields: {
    requesterUserId: { type: 'EXPRESSION', expression: workflowVariable('requesterUserId') },
    requesterDisplayName: { type: 'EXPRESSION', expression: workflowVariable('requesterDisplayName') },
    title: { type: 'EXPRESSION', expression: workflowInputPath(['title']) },
    amount: { type: 'EXPRESSION', expression: amountPath },
    currency: { type: 'EXPRESSION', expression: workflowInputPath(['currency']) },
    costCenter: { type: 'EXPRESSION', expression: workflowInputPath(['costCenter']) },
  },
};

function buildModel(): WorkflowModel {
  return baseModel({
    key: DEFINITION_KEY,
    name: 'Multi-stage amount approval',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          requesterUserId: { type: 'integer' },
          title: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          costCenter: { type: 'string' },
        },
        required: ['requesterUserId', 'title', 'amount'],
      },
    },
    variables: [
      { key: 'requesterUserId', schema: { type: 'INLINE', schema: {} } },
      { key: 'requesterEmail', schema: { type: 'INLINE', schema: {} } },
      { key: 'requesterDisplayName', schema: { type: 'INLINE', schema: {} } },
      { key: 'notifyText', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('resolve-requester', {
        actionRef: ACTION('identity.user-get'),
        input: {
          type: 'OBJECT',
          fields: { userId: { type: 'EXPRESSION', expression: workflowInputPath(['requesterUserId']) } },
        },
        outputAssignments: [
          { targetVariableKey: 'requesterUserId', value: nodeOutput('resolve-requester', ['userId']) },
          { targetVariableKey: 'requesterEmail', value: nodeOutput('resolve-requester', ['email']) },
          { targetVariableKey: 'requesterDisplayName', value: nodeOutput('resolve-requester', ['displayName']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-tier', 'FIRST_MATCH'),

      // Tier 1 — auto
      actionNode('msg-auto', {
        actionRef: ACTION('text.template'),
        input: templateInput('Hi {{name}}, "{{title}}" for {{amount}} was auto-approved (tier 1).', {
          name: workflowVariable('requesterDisplayName'),
          title: workflowInputPath(['title']),
          amount: amountPath,
        }),
        outputAssignments: [{ targetVariableKey: 'notifyText', value: nodeOutput('msg-auto', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-email-auto', 'EXACT_ONE'),
      actionNode('email-auto', {
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: workflowVariable('requesterEmail') },
            subject: { type: 'EXPRESSION', expression: lit('Request auto-approved') },
            text: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-auto', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('AUTO_APPROVED') } },
      }),

      // Stage 1 — ADMIN
      workItemNode('manager-approval', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Manager approval (amount request)'),
        input: sharedWiInput,
      }),
      decisionNode('d-after-manager', 'EXACT_ONE'),

      // Stage 2 — DEVELOPER (stands in for director/finance ROLE that exists in this env)
      workItemNode('director-approval', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Director approval (high amount)'),
        input: sharedWiInput,
        excludeUsersFromWorkItemKeys: ['manager-approval'],
      }),

      actionNode('msg-approved', {
        actionRef: ACTION('text.template'),
        input: templateInput('Hi {{name}}, "{{title}}" for {{amount}} was approved.', {
          name: workflowVariable('requesterDisplayName'),
          title: workflowInputPath(['title']),
          amount: amountPath,
        }),
        outputAssignments: [{ targetVariableKey: 'notifyText', value: nodeOutput('msg-approved', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-email-approved', 'EXACT_ONE'),
      actionNode('email-approved', {
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: workflowVariable('requesterEmail') },
            subject: { type: 'EXPRESSION', expression: lit('Request approved') },
            text: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-approved', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('APPROVED') } },
      }),

      actionNode('msg-rejected', {
        actionRef: ACTION('text.template'),
        input: templateInput('Hi {{name}}, "{{title}}" was rejected.', {
          name: workflowVariable('requesterDisplayName'),
          title: workflowInputPath(['title']),
        }),
        outputAssignments: [{ targetVariableKey: 'notifyText', value: nodeOutput('msg-rejected', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-email-rejected', 'EXACT_ONE'),
      actionNode('email-rejected', {
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: workflowVariable('requesterEmail') },
            subject: { type: 'EXPRESSION', expression: lit('Request rejected') },
            text: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
    ],
    edges: [
      unconditionalEdge('e-resolve-tier', 'resolve-requester', 'd-tier'),
      decisionEdge('e-tier1', 'd-tier', 'msg-auto', { op: 'LTE', left: amountPath, right: lit(1000) }, 10),
      decisionEdge('e-tier2', 'd-tier', 'manager-approval', { op: 'LTE', left: amountPath, right: lit(10000) }, 20),
      decisionDefaultEdge('e-tier3', 'd-tier', 'manager-approval'),

      unconditionalEdge('e-msg-auto-dec', 'msg-auto', 'd-email-auto'),
      decisionEdge('e-email-auto', 'd-email-auto', 'email-auto', hasEmailCondition),
      decisionDefaultEdge('e-skip-email-auto', 'd-email-auto', 'end-auto'),
      unconditionalEdge('e-email-auto-end', 'email-auto', 'end-auto'),
      errorEdge('e-email-auto-err', 'email-auto', 'end-auto'),

      workItemOutcomeEdge('e-mgr-approve', 'manager-approval', 'd-after-manager', 'APPROVE'),
      workItemOutcomeEdge('e-mgr-reject', 'manager-approval', 'msg-rejected', 'REJECT'),

      // After manager approve: mid-tier ends; high-tier needs director
      decisionEdge('e-mid-done', 'd-after-manager', 'msg-approved', { op: 'LTE', left: amountPath, right: lit(10000) }),
      decisionDefaultEdge('e-need-director', 'd-after-manager', 'director-approval'),

      workItemOutcomeEdge('e-dir-approve', 'director-approval', 'msg-approved', 'APPROVE'),
      workItemOutcomeEdge('e-dir-reject', 'director-approval', 'msg-rejected', 'REJECT'),

      unconditionalEdge('e-msg-appr-dec', 'msg-approved', 'd-email-approved'),
      decisionEdge('e-email-appr', 'd-email-approved', 'email-approved', hasEmailCondition),
      decisionDefaultEdge('e-skip-email-appr', 'd-email-approved', 'end-approved'),
      unconditionalEdge('e-email-appr-end', 'email-approved', 'end-approved'),
      errorEdge('e-email-appr-err', 'email-approved', 'end-approved'),

      unconditionalEdge('e-msg-rej-dec', 'msg-rejected', 'd-email-rejected'),
      decisionEdge('e-email-rej', 'd-email-rejected', 'email-rejected', hasEmailCondition),
      decisionDefaultEdge('e-skip-email-rej', 'd-email-rejected', 'end-rejected'),
      unconditionalEdge('e-email-rej-end', 'email-rejected', 'end-rejected'),
      errorEdge('e-email-rej-err', 'email-rejected', 'end-rejected'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'resolve-requester' },
  });
}

async function ensureDefinition(model: WorkflowModel) {
  const existing = await listWorkflowDefinitions('global');
  const already = existing.find((d) => d.key === DEFINITION_KEY);
  if (already) {
    const fresh = await updateWorkflowDefinitionDraft(already.id, already.draftVersion, {
      draftDefinitionJson: JSON.stringify(model),
    });
    const { revision } = await publishWorkflowDefinition(fresh.id, fresh.draftVersion);
    console.log(`[seed] updated+published "${DEFINITION_KEY}" (id=${fresh.id}, rev #${revision.revisionNumber}).`);
    return (await getWorkflowDefinitionById(fresh.id))!;
  }
  const definition = await createWorkflowDefinition({
    scopeKey: 'global',
    key: DEFINITION_KEY,
    draftDefinitionJson: JSON.stringify(model),
    creationMode: 'NEW',
  });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  console.log(`[seed] published "${DEFINITION_KEY}" (id=${definition.id}, rev #${revision.revisionNumber}).`);
  return (await getWorkflowDefinitionById(definition.id))!;
}

async function pickRequester() {
  const row = await prisma().baseUser.findFirst({
    where: { locked: 0 },
    orderBy: { id: 'asc' },
    select: { id: true, username: true },
  });
  return row ? { userId: fromUserId(row.id), username: row.username } : null;
}

async function pickActor(roleName: string, preferNotUserId?: number) {
  const rows = await prisma().baseUser.findMany({
    where: {
      locked: 0,
      userRoles: { some: { roleName } },
      ...(preferNotUserId ? { NOT: { id: BigInt(preferNotUserId) } } : {}),
    },
    orderBy: { id: 'asc' },
    select: { id: true, username: true },
    take: 5,
  });
  if (rows.length === 0) {
    const fallback = await prisma().baseUser.findFirst({
      where: { locked: 0, userRoles: { some: { roleName } } },
      orderBy: { id: 'asc' },
      select: { id: true, username: true },
    });
    return fallback ? { userId: fromUserId(fallback.id), username: fallback.username } : null;
  }
  return { userId: fromUserId(rows[0]!.id), username: rows[0]!.username };
}

async function dispatchUntilKey(instanceId: number, semanticNodeKey: string, leaseOwnerId: string, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const waiting = nodes.find((n) => n.semanticNodeKey === semanticNodeKey && n.status === 'WAITING_HUMAN');
    if (waiting) return waiting;
    const ended = nodes.find(
      (n) =>
        (n.semanticNodeKey === 'end-approved' || n.semanticNodeKey === 'end-auto' || n.semanticNodeKey === 'end-rejected') &&
        n.status === 'SUCCEEDED',
    );
    if (ended) return null;
    const ready = nodes.find((n) => n.status === 'READY');
    if (ready) {
      await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
      continue;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

async function drainAutomated(instanceId: number, leaseOwnerId: string, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const ready = nodes.find((n) => n.status === 'READY');
    if (!ready) return;
    await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
  }
}

async function completeWi(nodeInstanceId: number, actorUserId: number, outcome: 'APPROVE' | 'REJECT') {
  const item = await getWorkItemByNodeInstance(nodeInstanceId);
  if (!item) throw new Error(`No work item for nodeInstance ${nodeInstanceId}`);
  await claimWorkItem({ workItemId: item.id, actorUserId });
  await completeWorkItem({ workItemId: item.id, actorUserId, outcome, output: null });
  console.log(`[seed] Work Item #${item.id} ${outcome} by user #${actorUserId}.`);
}

async function runHighAmountLive(definitionId: number) {
  const definition = (await getWorkflowDefinitionById(definitionId))!;
  if (!definition.currentPublishedRevisionId) throw new Error('No published revision');

  const requester = await pickRequester();
  const manager = await pickActor('ADMIN');
  const director = await pickActor('DEVELOPER', manager?.userId);
  if (!requester || !manager || !director) {
    console.log('[seed] missing requester/ADMIN/DEVELOPER user — publish only.');
    return;
  }

  console.log(
    `[seed] live high-amount path (15000 → ADMIN then DEVELOPER) requester=#${requester.userId} manager=#${manager.userId} director=#${director.userId}…`,
  );
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: definition.currentPublishedRevisionId,
    input: {
      requesterUserId: requester.userId,
      title: 'Laptop refresh batch',
      amount: 15000,
      currency: 'USD',
      costCenter: 'IT-OPS',
    },
    startedByType: 'USER',
    startedById: manager.userId,
  });
  console.log(`[seed] instance #${instance.id} started.`);

  const mgrNode = await dispatchUntilKey(instance.id, 'manager-approval', 'seed-wfm-02');
  if (!mgrNode) {
    console.log('[seed] manager-approval not waiting — abort.');
    return;
  }
  await completeWi(mgrNode.id, manager.userId, 'APPROVE');

  const dirNode = await dispatchUntilKey(instance.id, 'director-approval', 'seed-wfm-02');
  if (!dirNode) {
    console.log('[seed] director-approval not waiting after manager approve — abort.');
    return;
  }
  await completeWi(dirNode.id, director.userId, 'APPROVE');

  await drainAutomated(instance.id, 'seed-wfm-02');
  const finalNodes = await listNodeInstancesForInstance(instance.id);
  const end = finalNodes.find((n) => n.semanticNodeKey === 'end-approved' && n.status === 'SUCCEEDED');
  console.log(
    end
      ? '[seed] reached end-approved — two real Work Item stages complete.'
      : `[seed] statuses: ${finalNodes.map((n) => `${n.semanticNodeKey}:${n.status}`).join(', ')}`,
  );
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const definition = await ensureDefinition(buildModel());
  await runHighAmountLive(definition.id);
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exitCode = 1;
});
