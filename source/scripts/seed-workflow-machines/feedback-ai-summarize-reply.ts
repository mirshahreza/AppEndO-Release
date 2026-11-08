/**
 * p-89 WFM-21 — `feedback-ai-summarize-reply`
 * feedback.get → ai.summarize → ADMIN approve → feedback.post-message.
 * Run: `npx tsx scripts/seed-workflow-machines/feedback-ai-summarize-reply.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { prisma, fromUserId } from '../../src/server/domain/users/prismaHelpers';
import { listNodeInstancesForInstance } from '../../src/server/domain/workflow/workflowNodeInstanceRepository';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
  templateInput,
} from './_seedHelpers';

const KEY = 'feedback-ai-summarize-reply';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'Feedback AI summarize reply',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          feedbackId: { type: 'integer' },
          actorUserId: { type: 'integer' },
        },
        required: ['feedbackId', 'actorUserId'],
      },
    },
    variables: [
      { key: 'subject', schema: { type: 'INLINE', schema: {} } },
      { key: 'title', schema: { type: 'INLINE', schema: {} } },
      { key: 'summary', schema: { type: 'INLINE', schema: {} } },
      { key: 'replyBody', schema: { type: 'INLINE', schema: {} } },
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
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('build-prompt', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          'Summarize this feedback ticket in 2 short sentences for an operator reply draft. Subject: {{subject}}. Title: {{title}}.',
          {
            subject: workflowVariable('subject'),
            title: workflowVariable('title'),
          },
        ),
        retryPolicy: NO_RETRY,
      }),
      actionNode('summarize', {
        actionRef: ACTION('ai.summarize'),
        input: {
          type: 'OBJECT',
          fields: {
            prompt: { type: 'EXPRESSION', expression: nodeOutput('build-prompt', ['text']) },
          },
        },
        // No outputAssignments — ON_ERROR must not evaluate success-path fields.
        retryPolicy: NO_RETRY,
      }),
      actionNode('build-reply', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          'AI draft reply based on summary:\n{{summary}}',
          { summary: nodeOutput('summarize', ['text']) },
        ),
        outputAssignments: [
          { targetVariableKey: 'replyBody', value: nodeOutput('build-reply', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      workItemNode('approve-reply', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve AI draft feedback reply'),
        input: {
          type: 'OBJECT',
          fields: {
            feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
            replyBody: { type: 'EXPRESSION', expression: workflowVariable('replyBody') },
          },
        },
      }),
      actionNode('post-reply', {
        actionRef: ACTION('feedback.post-message'),
        input: {
          type: 'OBJECT',
          fields: {
            feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
            body: { type: 'EXPRESSION', expression: workflowVariable('replyBody') },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-replied', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('REPLIED') },
          feedbackId: { type: 'EXPRESSION', expression: workflowInputPath(['feedbackId']) },
        },
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
      endNode('end-ai-blocked', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('AI_BLOCKED') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
      endNode('end-post-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('POST_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-feedback', 'end-failed'),
      unconditionalEdge('e-load-prompt', 'load-feedback', 'build-prompt'),
      errorEdge('e-prompt-err', 'build-prompt', 'end-failed'),
      unconditionalEdge('e-prompt-sum', 'build-prompt', 'summarize'),
      errorEdge('e-sum-err', 'summarize', 'end-ai-blocked'),
      unconditionalEdge('e-sum-reply', 'summarize', 'build-reply'),
      errorEdge('e-reply-err', 'build-reply', 'end-failed'),
      unconditionalEdge('e-reply-wi', 'build-reply', 'approve-reply'),
      workItemOutcomeEdge('e-approve', 'approve-reply', 'post-reply', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'approve-reply', 'end-rejected', 'REJECT'),
      errorEdge('e-post-err', 'post-reply', 'end-post-failed'),
      unconditionalEdge('e-post-done', 'post-reply', 'end-replied'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-feedback' },
  });
}

async function pickFeedbackId(): Promise<number> {
  const row = await prisma().baseAppFeedback.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!row) throw new Error('no base_app_feedback rows');
  return fromUserId(row.id);
}

async function main() {
  await bootWorkflowMachineSeed();
  const feedbackId = await pickFeedbackId();
  console.log(`[seed] AI summarize reply for feedback#${feedbackId}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { feedbackId, actorUserId: admin.userId },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-21');
  const nodes = await listNodeInstancesForInstance(instance.id);
  if (nodes.some((n) => n.semanticNodeKey === 'end-ai-blocked' && n.status === 'SUCCEEDED')) {
    console.log('[seed] published; live AI blocked/disabled — env gap (same as WFM-10).');
    process.exitCode = 2;
    return;
  }
  const wi = await dispatchUntilKey(instance.id, 'approve-reply', 'seed-wfm-21');
  if (!wi) throw new Error('approve-reply missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-21');
  await assertEnd(instance.id, 'end-replied');
  console.log(`[seed] AI reply posted on feedback#${feedbackId}`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
