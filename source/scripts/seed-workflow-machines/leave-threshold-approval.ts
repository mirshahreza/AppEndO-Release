/**
 * p-89 WFM-01 — `leave-threshold-approval`
 *
 * Real entities: base_users (identity.user-get), base_work_items (manager ROLE queue),
 * communication.email-send when the requester has an email.
 *
 * Run: `npx tsx scripts/seed-workflow-machines/leave-threshold-approval.ts`
 * Idempotent on definition key.
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

const DEFINITION_KEY = 'leave-threshold-approval';
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

function buildModel(): WorkflowModel {
  return baseModel({
    key: DEFINITION_KEY,
    name: 'Leave threshold approval',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          requesterUserId: { type: 'integer' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          leaveType: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['requesterUserId', 'startDate', 'endDate'],
      },
    },
    variables: [
      { key: 'requesterUserId', schema: { type: 'INLINE', schema: {} } },
      { key: 'requesterEmail', schema: { type: 'INLINE', schema: {} } },
      { key: 'requesterDisplayName', schema: { type: 'INLINE', schema: {} } },
      { key: 'diffMs', schema: { type: 'INLINE', schema: {} } },
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
      actionNode('compute-days', {
        actionRef: ACTION('date.diff'),
        input: {
          type: 'OBJECT',
          fields: {
            fromIso: { type: 'EXPRESSION', expression: workflowInputPath(['startDate']) },
            toIso: { type: 'EXPRESSION', expression: workflowInputPath(['endDate']) },
          },
        },
        outputAssignments: [{ targetVariableKey: 'diffMs', value: nodeOutput('compute-days', ['diffMs']) }],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-auto-or-manager', 'EXACT_ONE'),

      actionNode('msg-auto', {
        actionRef: ACTION('text.template'),
        input: templateInput('Hi {{name}}, your leave request was auto-approved (under 2 days).', {
          name: workflowVariable('requesterDisplayName'),
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
            subject: { type: 'EXPRESSION', expression: lit('Leave request auto-approved') },
            text: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-auto-approved', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('AUTO_APPROVED') },
          requesterUserId: { type: 'EXPRESSION', expression: workflowVariable('requesterUserId') },
        },
      }),

      workItemNode('manager-approval', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve leave request'),
        input: {
          type: 'OBJECT',
          fields: {
            requesterUserId: { type: 'EXPRESSION', expression: workflowVariable('requesterUserId') },
            requesterDisplayName: { type: 'EXPRESSION', expression: workflowVariable('requesterDisplayName') },
            startDate: { type: 'EXPRESSION', expression: workflowInputPath(['startDate']) },
            endDate: { type: 'EXPRESSION', expression: workflowInputPath(['endDate']) },
            leaveType: { type: 'EXPRESSION', expression: workflowInputPath(['leaveType']) },
            reason: { type: 'EXPRESSION', expression: workflowInputPath(['reason']) },
            diffMs: { type: 'EXPRESSION', expression: workflowVariable('diffMs') },
          },
        },
      }),

      actionNode('msg-approved', {
        actionRef: ACTION('text.template'),
        input: templateInput('Hi {{name}}, your leave request was approved by a manager.', {
          name: workflowVariable('requesterDisplayName'),
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
            subject: { type: 'EXPRESSION', expression: lit('Leave request approved') },
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
        input: templateInput('Hi {{name}}, your leave request was rejected.', {
          name: workflowVariable('requesterDisplayName'),
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
            subject: { type: 'EXPRESSION', expression: lit('Leave request rejected') },
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
      unconditionalEdge('e-resolve-compute', 'resolve-requester', 'compute-days'),
      unconditionalEdge('e-compute-decision', 'compute-days', 'd-auto-or-manager'),
      decisionEdge('e-auto', 'd-auto-or-manager', 'msg-auto', {
        op: 'LTE',
        left: workflowVariable('diffMs'),
        right: lit(2 * 86_400_000),
      }),
      decisionDefaultEdge('e-manager', 'd-auto-or-manager', 'manager-approval'),

      unconditionalEdge('e-msg-auto-dec', 'msg-auto', 'd-email-auto'),
      decisionEdge('e-email-auto', 'd-email-auto', 'email-auto', hasEmailCondition),
      decisionDefaultEdge('e-skip-email-auto', 'd-email-auto', 'end-auto-approved'),
      unconditionalEdge('e-email-auto-end', 'email-auto', 'end-auto-approved'),
      errorEdge('e-email-auto-err', 'email-auto', 'end-auto-approved'),

      workItemOutcomeEdge('e-approve', 'manager-approval', 'msg-approved', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'manager-approval', 'msg-rejected', 'REJECT'),

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
    console.log(
      `[seed] updated+published "${DEFINITION_KEY}" (definitionId=${fresh.id}, revision #${revision.revisionNumber}).`,
    );
    return fresh;
  }
  const definition = await createWorkflowDefinition({
    scopeKey: 'global',
    key: DEFINITION_KEY,
    draftDefinitionJson: JSON.stringify(model),
    creationMode: 'NEW',
  });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  console.log(
    `[seed] published "${DEFINITION_KEY}" (definitionId=${definition.id}, revision #${revision.revisionNumber}, status=${revision.publicationStatus}).`,
  );
  return definition;
}

async function pickRequester() {
  const withEmail = await prisma().baseUser.findFirst({
    where: {
      locked: 0,
      email: { not: null },
      AND: [{ NOT: { email: '' } }],
    },
    orderBy: { id: 'asc' },
    select: { id: true, username: true, email: true },
  });
  if (withEmail) {
    return {
      userId: fromUserId(withEmail.id),
      username: withEmail.username,
      email: withEmail.email,
    };
  }
  const any = await prisma().baseUser.findFirst({
    where: { locked: 0 },
    orderBy: { id: 'asc' },
    select: { id: true, username: true, email: true },
  });
  if (!any) return null;
  return { userId: fromUserId(any.id), username: any.username, email: any.email };
}

async function dispatchUntilWorkItem(instanceId: number, leaseOwnerId: string, maxSteps = 30) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    // Node instance rows have no `kind` column — match the authored WORK_ITEM key.
    const waitingHuman = nodes.find(
      (n) => n.semanticNodeKey === 'manager-approval' && n.status === 'WAITING_HUMAN',
    );
    if (waitingHuman) return waitingHuman;

    const ready = nodes.find((n) => n.status === 'READY');
    if (ready) {
      await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
      continue;
    }
    // Worker may be mid-flight; brief wait then retry.
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

async function drainAutomated(instanceId: number, leaseOwnerId: string, maxSteps = 30) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const ready = nodes.find((n) => n.status === 'READY');
    if (!ready) return;
    await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
  }
}

async function runManagerPathLive(definitionId: number) {
  const requester = await pickRequester();
  if (!requester) {
    console.log('[seed] no unlocked user found — publish only.');
    return;
  }
  const adminRole = await prisma().baseUserRole.findFirst({ where: { roleName: 'ADMIN' } });
  if (!adminRole) {
    console.log('[seed] no ADMIN membership — cannot claim work item; publish only.');
    return;
  }
  const adminUserId = fromUserId(adminRole.userId);
  const definition = (await getWorkflowDefinitionById(definitionId))!;
  if (!definition.currentPublishedRevisionId) {
    throw new Error('Definition has no published revision.');
  }

  console.log(
    `[seed] starting live instance (5-day leave → manager Work Item) requester=#${requester.userId} ${requester.username}…`,
  );
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: definition.currentPublishedRevisionId,
    input: {
      requesterUserId: requester.userId,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-06T00:00:00.000Z',
      leaveType: 'ANNUAL',
      reason: 'Family travel',
    },
    startedByType: 'USER',
    startedById: adminUserId,
  });
  console.log(`[seed] instance #${instance.id} started, status=${instance.status}.`);

  const workItemNode = await dispatchUntilWorkItem(instance.id, 'seed-wfm-01');
  if (!workItemNode) {
    console.log('[seed] no WORK_ITEM waiting — check instance nodes.');
    return;
  }
  const item = await getWorkItemByNodeInstance(workItemNode.id);
  if (!item) {
    console.log('[seed] work item row missing after create dispatch.');
    return;
  }
  await claimWorkItem({ workItemId: item.id, actorUserId: adminUserId });
  await completeWorkItem({ workItemId: item.id, actorUserId: adminUserId, outcome: 'APPROVE', output: null });
  console.log(`[seed] Work Item #${item.id} claimed+approved by ADMIN user #${adminUserId}.`);

  await drainAutomated(instance.id, 'seed-wfm-01');
  const finalNodes = await listNodeInstancesForInstance(instance.id);
  const end = finalNodes.find((n) => n.semanticNodeKey === 'end-approved' && n.status === 'SUCCEEDED');
  console.log(
    end
      ? '[seed] reached end-approved — real user resolve + Work Item + optional email path complete.'
      : `[seed] post-approve dispatch done; node statuses: ${finalNodes.map((n) => `${n.semanticNodeKey}:${n.status}`).join(', ')}`,
  );
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const model = buildModel();
  const definition = await ensureDefinition(model);
  await runManagerPathLive(definition.id);
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exitCode = 1;
});
