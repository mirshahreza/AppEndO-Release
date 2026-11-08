/**
 * p-89 WFM-22 — `user-lock-after-review`
 * identity.user-get → ADMIN security WI → identity.user-lock.
 * Seed unlocks the target afterward so the env stays usable.
 * Run: `npx tsx scripts/seed-workflow-machines/user-lock-after-review.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { unlockUser } from '../../src/server/domain/users/userRepository';
import { prisma, fromUserId } from '../../src/server/domain/users/prismaHelpers';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'user-lock-after-review';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'User lock after review',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          targetUserId: { type: 'integer' },
          actorUserId: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['targetUserId', 'actorUserId'],
      },
    },
    variables: [
      { key: 'username', schema: { type: 'INLINE', schema: {} } },
      { key: 'displayName', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('load-user', {
        actionRef: ACTION('identity.user-get'),
        input: {
          type: 'OBJECT',
          fields: { userId: { type: 'EXPRESSION', expression: workflowInputPath(['targetUserId']) } },
        },
        outputAssignments: [
          { targetVariableKey: 'username', value: nodeOutput('load-user', ['username']) },
          { targetVariableKey: 'displayName', value: nodeOutput('load-user', ['displayName']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      workItemNode('security-review', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve user lock'),
        input: {
          type: 'OBJECT',
          fields: {
            targetUserId: { type: 'EXPRESSION', expression: workflowInputPath(['targetUserId']) },
            username: { type: 'EXPRESSION', expression: workflowVariable('username') },
            displayName: { type: 'EXPRESSION', expression: workflowVariable('displayName') },
            reason: { type: 'EXPRESSION', expression: workflowInputPath(['reason']) },
          },
        },
      }),
      actionNode('lock-user', {
        actionRef: ACTION('identity.user-lock'),
        input: {
          type: 'OBJECT',
          fields: {
            userId: { type: 'EXPRESSION', expression: workflowInputPath(['targetUserId']) },
            locked: { type: 'EXPRESSION', expression: lit(true) },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-locked', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('LOCKED') },
          userId: { type: 'EXPRESSION', expression: workflowInputPath(['targetUserId']) },
          locked: { type: 'EXPRESSION', expression: nodeOutput('lock-user', ['locked']) },
        },
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
      endNode('end-load-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('LOAD_FAILED') } },
      }),
      endNode('end-lock-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('LOCK_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-user', 'end-load-failed'),
      unconditionalEdge('e-load-wi', 'load-user', 'security-review'),
      workItemOutcomeEdge('e-approve', 'security-review', 'lock-user', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'security-review', 'end-rejected', 'REJECT'),
      errorEdge('e-lock-err', 'lock-user', 'end-lock-failed'),
      unconditionalEdge('e-lock-done', 'lock-user', 'end-locked'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-user' },
  });
}

async function pickLockTarget(adminUserId: number): Promise<number> {
  const row = await prisma().baseUser.findFirst({
    where: {
      locked: 0,
      isBuiltin: false,
      id: { not: BigInt(adminUserId) },
    },
    orderBy: { id: 'asc' },
    select: { id: true, username: true },
  });
  if (!row) throw new Error('No non-builtin unlocked user to lock for WFM-22.');
  console.log(`[seed] lock target user#${fromUserId(row.id)} (${row.username})`);
  return fromUserId(row.id);
}

async function main() {
  await bootWorkflowMachineSeed();
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const targetUserId = await pickLockTarget(admin.userId);
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      targetUserId,
      actorUserId: admin.userId,
      reason: 'WFM-22 live security lock review',
    },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-22');
  const wi = await dispatchUntilKey(instance.id, 'security-review', 'seed-wfm-22');
  if (!wi) throw new Error('security-review missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-22');
  await assertEnd(instance.id, 'end-locked');
  await unlockUser(admin.userId, targetUserId);
  console.log(`[seed] locked then unlocked user#${targetUserId} (env restored).`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
