/**
 * p-89 WFM-25 — `scope-membership-grant`
 * ADMIN approve → scope.membership-grant for a real user on org node.
 * Run: `npx tsx scripts/seed-workflow-machines/scope-membership-grant.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import { ORG_BASE_INFO_ROOT_ID } from '../../src/shared/api/contracts/org-geo/constants';
import { findScopeMembershipUnique, deleteScopeMembership } from '../../src/server/domain/scope-memberships/repository';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'scope-membership-grant';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'Scope membership grant',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          dimensionKey: { type: 'string' },
          nodeId: { type: 'string' },
          userId: { type: 'integer' },
          actorUserId: { type: 'integer' },
        },
        required: ['dimensionKey', 'nodeId', 'userId', 'actorUserId'],
      },
    },
    variables: [
      { key: 'membershipId', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      workItemNode('grant-approve', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve org scope membership grant'),
        input: {
          type: 'OBJECT',
          fields: {
            dimensionKey: { type: 'EXPRESSION', expression: workflowInputPath(['dimensionKey']) },
            nodeId: { type: 'EXPRESSION', expression: workflowInputPath(['nodeId']) },
            userId: { type: 'EXPRESSION', expression: workflowInputPath(['userId']) },
          },
        },
      }),
      actionNode('grant-membership', {
        actionRef: ACTION('scope.membership-grant'),
        input: {
          type: 'OBJECT',
          fields: {
            dimensionKey: { type: 'EXPRESSION', expression: workflowInputPath(['dimensionKey']) },
            nodeId: { type: 'EXPRESSION', expression: workflowInputPath(['nodeId']) },
            userId: { type: 'EXPRESSION', expression: workflowInputPath(['userId']) },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'membershipId', value: nodeOutput('grant-membership', ['id']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      endNode('end-granted', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('GRANTED') },
          membershipId: { type: 'EXPRESSION', expression: workflowVariable('membershipId') },
        },
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
      endNode('end-grant-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('GRANT_FAILED') } },
      }),
    ],
    edges: [
      workItemOutcomeEdge('e-approve', 'grant-approve', 'grant-membership', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'grant-approve', 'end-rejected', 'REJECT'),
      errorEdge('e-grant-err', 'grant-membership', 'end-grant-failed'),
      unconditionalEdge('e-grant-done', 'grant-membership', 'end-granted'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'grant-approve' },
  });
}

async function main() {
  await bootWorkflowMachineSeed();
  const node = await prisma().baseInfo.findFirst({
    where: { parentId: ORG_BASE_INFO_ROOT_ID, isActive: true },
    orderBy: { id: 'asc' },
  });
  if (!node) throw new Error(`no org child under base_info ${ORG_BASE_INFO_ROOT_ID}`);
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const developers = await pickRoleMembers('DEVELOPER', 2);
  const subject = developers.find((m) => m.userId !== admin?.userId) ?? developers[0];
  if (!admin || !subject) throw new Error('need ADMIN + DEVELOPER');

  const existing = await findScopeMembershipUnique(subject.userId, 'org', node.id);
  if (existing) {
    await deleteScopeMembership(existing.id);
    console.log(`[seed] cleared prior membership #${existing.id}`);
  }

  console.log(`[seed] grant user#${subject.userId} → org/${node.id} (${node.titleEn})`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      dimensionKey: 'org',
      nodeId: node.id,
      userId: subject.userId,
      actorUserId: admin.userId,
    },
    startedByType: 'USER',
    startedById: admin.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-25');
  const wi = await dispatchUntilKey(instance.id, 'grant-approve', 'seed-wfm-25');
  if (!wi) throw new Error('grant-approve missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-25');
  await assertEnd(instance.id, 'end-granted');
  const row = await findScopeMembershipUnique(subject.userId, 'org', node.id);
  if (!row) throw new Error('membership row missing after grant');
  console.log(`[seed] membership #${row.id} granted`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
