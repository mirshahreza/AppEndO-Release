/**
 * p-89 WFM-19 — `app-feedback-triage`
 * feedback.get → ADMIN Work Item → feedback.update-status (TRIAGED/IN_PROGRESS).
 * Run: `npx tsx scripts/seed-workflow-machines/app-feedback-triage.ts`
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

const KEY = 'app-feedback-triage';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'App feedback triage',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          feedbackId: { type: 'integer' },
          actorUserId: { type: 'integer' },
          targetStatus: { type: 'string' },
        },
        required: ['feedbackId', 'actorUserId', 'targetStatus'],
      },
    },
    variables: [
      { key: 'subject', schema: { type: 'INLINE', schema: {} } },
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
          { targetVariableKey: 'subject', value: nodeOutput('load-feedback', ['subject']) },
          { targetVariableKey: 'title', value: nodeOutput('load-feedback', ['title']) },
          { targetVariableKey: 'status', value: nodeOutput('load-feedback', ['status']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      workItemNode('triage-review', {
        workItemType: 'REVIEW',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Triage app feedback'),
        input: {
          type: 'OBJECT',
          fields: {
            feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
            subject: { type: 'EXPRESSION', expression: workflowVariable('subject') },
            title: { type: 'EXPRESSION', expression: workflowVariable('title') },
            status: { type: 'EXPRESSION', expression: workflowVariable('status') },
          },
        },
      }),
      actionNode('apply-status', {
        actionRef: ACTION('feedback.update-status'),
        input: {
          type: 'OBJECT',
          fields: {
            feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
            status: { type: 'EXPRESSION', expression: workflowInputPath(['targetStatus']) },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-triaged', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('TRIAGED') },
          feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
          status: { type: 'EXPRESSION', expression: nodeOutput('apply-status', ['status']) },
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
      endNode('end-update-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('UPDATE_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-feedback', 'end-load-failed'),
      unconditionalEdge('e-load-wi', 'load-feedback', 'triage-review'),
      workItemOutcomeEdge('e-approve', 'triage-review', 'apply-status', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'triage-review', 'end-rejected', 'REJECT'),
      errorEdge('e-upd-err', 'apply-status', 'end-update-failed'),
      unconditionalEdge('e-upd-done', 'apply-status', 'end-triaged'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-feedback' },
  });
}

async function pickOpenFeedbackId(submitterUserId: number): Promise<number> {
  const open = await prisma().baseAppFeedback.findFirst({
    where: { status: { in: ['NEW', 'TRIAGED', 'IN_PROGRESS'] } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (open) return fromUserId(open.id);

  const subject = await prisma().baseInfo.findFirst({
    where: {
      OR: [
        { id: { startsWith: '100.3.' } },
        { shortName: { in: ['bug', 'feature', 'question', 'other'] } },
      ],
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  const typeCode = subject?.id ?? 'workflow-seed';
  const created = await prisma().baseAppFeedback.create({
    data: {
      type: typeCode,
      title: 'WFM-19 triage seed ticket',
      status: 'NEW',
      priority: 'NORMAL',
      submitterUserId: BigInt(submitterUserId),
      assigneeRoleName: 'ADMIN',
      messageCount: 1,
      lastMessageAt: new Date(),
      messages: {
        create: {
          kind: 'SUBMITTER',
          body: 'Seeded feedback for workflow triage machine.',
          authorUserId: BigInt(submitterUserId),
        },
      },
    },
    select: { id: true },
  });
  console.log(`[seed] created feedback#${fromUserId(created.id)} for triage.`);
  return fromUserId(created.id);
}

async function main() {
  await bootWorkflowMachineSeed();
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const feedbackId = await pickOpenFeedbackId(user.userId);
  console.log(`[seed] triaging feedback#${feedbackId}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { feedbackId, actorUserId: admin.userId, targetStatus: 'TRIAGED' },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-19');
  const wi = await dispatchUntilKey(instance.id, 'triage-review', 'seed-wfm-19');
  if (!wi) throw new Error('triage-review missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-19');
  await assertEnd(instance.id, 'end-triaged');
  console.log(`[seed] feedback#${feedbackId} status updated via workflow.`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
