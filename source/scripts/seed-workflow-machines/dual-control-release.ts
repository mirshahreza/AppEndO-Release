/**
 * p-89 WFM-03 — `dual-control-release`
 *
 * Real entities: base_users, base_work_items (two ADMIN ROLE approvals with SoD),
 * optional email to requester. No payment-gateway stub — release outcome is the END payload.
 *
 * Flow: identity.user-get → maker WI → checker WI (excludes maker claimer) → email → END
 *
 * Run: `npx tsx scripts/seed-workflow-machines/dual-control-release.ts`
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

const DEFINITION_KEY = 'dual-control-release';
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

const releaseInput: CanonicalMapping = {
  type: 'OBJECT',
  fields: {
    requesterUserId: { type: 'EXPRESSION', expression: workflowVariable('requesterUserId') },
    requesterDisplayName: { type: 'EXPRESSION', expression: workflowVariable('requesterDisplayName') },
    paymentRef: { type: 'EXPRESSION', expression: workflowInputPath(['paymentRef']) },
    amount: { type: 'EXPRESSION', expression: workflowInputPath(['amount']) },
    beneficiary: { type: 'EXPRESSION', expression: workflowInputPath(['beneficiary']) },
  },
};

function buildModel(): WorkflowModel {
  return baseModel({
    key: DEFINITION_KEY,
    name: 'Dual-control release',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          requesterUserId: { type: 'integer' },
          paymentRef: { type: 'string' },
          amount: { type: 'number' },
          beneficiary: { type: 'string' },
        },
        required: ['requesterUserId', 'paymentRef', 'amount', 'beneficiary'],
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
      workItemNode('maker-release', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Maker: propose release'),
        input: releaseInput,
      }),
      workItemNode('checker-release', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Checker: confirm release (SoD)'),
        input: releaseInput,
        excludeUsersFromWorkItemKeys: ['maker-release'],
      }),
      actionNode('msg-released', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          'Hi {{name}}, dual-control release approved for {{ref}} ({{amount}} to {{beneficiary}}).',
          {
            name: workflowVariable('requesterDisplayName'),
            ref: workflowInputPath(['paymentRef']),
            amount: workflowInputPath(['amount']),
            beneficiary: workflowInputPath(['beneficiary']),
          },
        ),
        outputAssignments: [{ targetVariableKey: 'notifyText', value: nodeOutput('msg-released', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-email-released', 'EXACT_ONE'),
      actionNode('email-released', {
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: workflowVariable('requesterEmail') },
            subject: { type: 'EXPRESSION', expression: lit('Release dual-control approved') },
            text: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-released', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('RELEASED') },
          paymentRef: { type: 'EXPRESSION', expression: workflowInputPath(['paymentRef']) },
        },
      }),
      actionNode('msg-rejected', {
        actionRef: ACTION('text.template'),
        input: templateInput('Hi {{name}}, release {{ref}} was rejected under dual-control.', {
          name: workflowVariable('requesterDisplayName'),
          ref: workflowInputPath(['paymentRef']),
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
            subject: { type: 'EXPRESSION', expression: lit('Release rejected') },
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
      unconditionalEdge('e-resolve-maker', 'resolve-requester', 'maker-release'),
      workItemOutcomeEdge('e-maker-ok', 'maker-release', 'checker-release', 'APPROVE'),
      workItemOutcomeEdge('e-maker-rej', 'maker-release', 'msg-rejected', 'REJECT'),
      workItemOutcomeEdge('e-checker-ok', 'checker-release', 'msg-released', 'APPROVE'),
      workItemOutcomeEdge('e-checker-rej', 'checker-release', 'msg-rejected', 'REJECT'),

      unconditionalEdge('e-msg-rel-dec', 'msg-released', 'd-email-released'),
      decisionEdge('e-email-rel', 'd-email-released', 'email-released', hasEmailCondition),
      decisionDefaultEdge('e-skip-email-rel', 'd-email-released', 'end-released'),
      unconditionalEdge('e-email-rel-end', 'email-released', 'end-released'),
      errorEdge('e-email-rel-err', 'email-released', 'end-released'),

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

async function pickRoleMember(roleName: string, preferNotUserId?: number) {
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
  if (rows[0]) return { userId: fromUserId(rows[0].id), username: rows[0].username };
  return null;
}

async function dispatchUntilKey(instanceId: number, semanticNodeKey: string, leaseOwnerId: string, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const waiting = nodes.find((n) => n.semanticNodeKey === semanticNodeKey && n.status === 'WAITING_HUMAN');
    if (waiting) return waiting;
    const ended = nodes.find(
      (n) =>
        (n.semanticNodeKey === 'end-released' || n.semanticNodeKey === 'end-rejected') && n.status === 'SUCCEEDED',
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
  return item.id;
}

async function runLive(definitionId: number) {
  const definition = (await getWorkflowDefinitionById(definitionId))!;
  if (!definition.currentPublishedRevisionId) throw new Error('No published revision');

  const requester = await pickRequester();
  const maker = await pickRoleMember('ADMIN');
  // Checker is DEVELOPER so SoD can run even when only one unlocked ADMIN exists.
  const checker = await pickRoleMember('DEVELOPER', maker?.userId);
  if (!requester || !maker || !checker) {
    console.log('[seed] need requester + ADMIN maker + distinct DEVELOPER checker — publish only.');
    return;
  }
  if (maker.userId === checker.userId) {
    console.log('[seed] maker and checker resolved to the same user — cannot demo SoD; publish only.');
    return;
  }

  console.log(
    `[seed] dual-control live maker(ADMIN)=#${maker.userId} checker(DEVELOPER)=#${checker.userId} requester=#${requester.userId}…`,
  );
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: definition.currentPublishedRevisionId,
    input: {
      requesterUserId: requester.userId,
      paymentRef: 'REL-2026-001',
      amount: 4200,
      beneficiary: 'Vendor ACME',
    },
    startedByType: 'USER',
    startedById: maker.userId,
  });
  console.log(`[seed] instance #${instance.id} started.`);

  const makerNode = await dispatchUntilKey(instance.id, 'maker-release', 'seed-wfm-03');
  if (!makerNode) {
    console.log('[seed] maker-release not waiting — abort.');
    return;
  }
  await completeWi(makerNode.id, maker.userId, 'APPROVE');

  const checkerNode = await dispatchUntilKey(instance.id, 'checker-release', 'seed-wfm-03');
  if (!checkerNode) {
    console.log('[seed] checker-release not waiting — abort.');
    return;
  }
  const checkerItem = await getWorkItemByNodeInstance(checkerNode.id);
  if (!checkerItem) throw new Error('checker work item missing');
  try {
    await claimWorkItem({ workItemId: checkerItem.id, actorUserId: maker.userId });
    console.log('[seed] ERROR: maker was able to claim checker WI — SoD failed.');
    return;
  } catch (error) {
    console.log(`[seed] SoD OK — maker claim rejected: ${error instanceof Error ? error.message : String(error)}`);
  }

  await completeWi(checkerNode.id, checker.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-03');

  const finalNodes = await listNodeInstancesForInstance(instance.id);
  const end = finalNodes.find((n) => n.semanticNodeKey === 'end-released' && n.status === 'SUCCEEDED');
  console.log(
    end
      ? '[seed] reached end-released — dual-control + SoD verified on real Work Items.'
      : `[seed] statuses: ${finalNodes.map((n) => `${n.semanticNodeKey}:${n.status}`).join(', ')}`,
  );
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const definition = await ensureDefinition(buildModel());
  await runLive(definition.id);
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exitCode = 1;
});
