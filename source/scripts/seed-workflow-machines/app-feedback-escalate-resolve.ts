/**
 * p-89 WFM-20 — `app-feedback-escalate-resolve`
 * feedback.get → ADMIN WI → feedback.post-message + feedback.update-status(RESOLVED).
 * Run: `npx tsx scripts/seed-workflow-machines/app-feedback-escalate-resolve.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { prisma, fromUserId } from '../../src/server/domain/users/prismaHelpers';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'app-feedback-escalate-resolve';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'App feedback escalate resolve',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          feedbackId: { type: 'integer' },
          actorUserId: { type: 'integer' },
          replyBody: { type: 'string' },
        },
        required: ['feedbackId', 'actorUserId', 'replyBody'],
      },
    },
    variables: [
      { key: 'title', schema: { type: 'INLINE', schema: {} } },
      { key: 'status', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('load-feedback', {
        actionRef: ACTION('feedback.get'),
        input: {
          type: 'OBJECT',
          fields: { feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) } },
        },
        outputAssignments: [
          { targetVariableKey: 'title', value: nodeOutput('load-feedback', ['title']) },
          { targetVariableKey: 'status', value: nodeOutput('load-feedback', ['status']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      workItemNode('escalate-review', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Escalate and resolve feedback'),
        input: {
          type: 'OBJECT',
          fields: {
            feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
            title: { type: 'EXPRESSION', expression: workflowVariable('title') },
            status: { type: 'EXPRESSION', expression: workflowVariable('status') },
          },
        },
      }),
      actionNode('post-reply', {
        actionRef: ACTION('feedback.post-message'),
        input: {
          type: 'OBJECT',
          fields: {
            feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
            body: { type: 'EXPRESSION', expression: workflowInputPath(['replyBody']) },
            kind: { type: 'EXPRESSION', expression: lit('STAFF') },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      actionNode('resolve-status', {
        actionRef: ACTION('feedback.update-status'),
        input: {
          type: 'OBJECT',
          fields: {
            feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
            status: { type: 'EXPRESSION', expression: lit('RESOLVED') },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-resolved', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('RESOLVED') },
          feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
          status: { type: 'EXPRESSION', expression: nodeOutput('resolve-status', ['status']) },
        },
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-feedback', 'end-failed'),
      unconditionalEdge('e-load-wi', 'load-feedback', 'escalate-review'),
      workItemOutcomeEdge('e-approve', 'escalate-review', 'post-reply', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'escalate-review', 'end-rejected', 'REJECT'),
      errorEdge('e-post-err', 'post-reply', 'end-failed'),
      unconditionalEdge('e-post-resolve', 'post-reply', 'resolve-status'),
      errorEdge('e-resolve-err', 'resolve-status', 'end-failed'),
      unconditionalEdge('e-resolve-done', 'resolve-status', 'end-resolved'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-feedback' },
  });
}

async function pickFeedbackId(submitterUserId: number): Promise<number> {
  const open = await prisma().baseAppFeedback.findFirst({
    where: { status: { in: ['NEW', 'TRIAGED', 'IN_PROGRESS'] } },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  if (open) {
    await prisma().baseAppFeedback.update({
      where: { id: open.id },
      data: { status: 'IN_PROGRESS', resolvedAt: null, resolvedByUserId: null },
    });
    return fromUserId(open.id);
  }
  const subject = await prisma().baseInfo.findFirst({
    where: { id: { startsWith: '100.3.' } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  const created = await prisma().baseAppFeedback.create({
    data: {
      type: subject?.id ?? 'workflow-seed',
      title: 'WFM-20 escalate seed',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      submitterUserId: BigInt(submitterUserId),
      assigneeRoleName: 'ADMIN',
      messageCount: 1,
      lastMessageAt: new Date(),
      messages: {
        create: {
          kind: 'SUBMITTER',
          body: 'Please escalate and resolve this seeded ticket.',
          authorUserId: BigInt(submitterUserId),
        },
      },
    },
    select: { id: true },
  });
  return fromUserId(created.id);
}

async function main() {
  await bootWorkflowMachineSeed();
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const feedbackId = await pickFeedbackId(user.userId);
  console.log(`[seed] escalate+resolve feedback#${feedbackId}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      feedbackId,
      actorUserId: admin.userId,
      replyBody: 'Escalation reviewed. Closing as resolved (WFM-20).',
    },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-20');
  const wi = await dispatchUntilKey(instance.id, 'escalate-review', 'seed-wfm-20');
  if (!wi) throw new Error('escalate-review missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-20');
  await assertEnd(instance.id, 'end-resolved');
  console.log(`[seed] feedback#${feedbackId} resolved.`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
