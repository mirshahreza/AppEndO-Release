/**
 * p-89 WFM-28 — `scheduled-user-count-digest`
 * identity.user-count → template → FOR_EACH email to ADMIN (MANUAL seed; schedule-ready).
 * Run: `npx tsx scripts/seed-workflow-machines/scheduled-user-count-digest.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { listNodeInstancesForInstance } from '../../src/server/domain/workflow/workflowNodeInstanceRepository';
import {
  baseModel, endNode, actionNode, unconditionalEdge, forEachNode,
  decisionNode, decisionEdge, decisionDefaultEdge,
  lit, workflowInputPath, nodeOutput, currentItem, errorEdge, workflowVariable,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, drainAutomated, assertEnd,
  bootWorkflowMachineSeed, templateInput,
} from './_seedHelpers';

const KEY = 'scheduled-user-count-digest';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'Scheduled user count digest',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: { roleName: { type: 'string' } },
        required: ['roleName'],
      },
    },
    variables: [
      { key: 'userCount', schema: { type: 'INLINE', schema: {} } },
      { key: 'body', schema: { type: 'INLINE', schema: {} } },
      { key: 'emails', schema: { type: 'INLINE', schema: {} } },
      { key: 'memberCount', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('count-users', {
        actionRef: ACTION('identity.user-count'),
        input: { type: 'OBJECT', fields: {} },
        outputAssignments: [
          { targetVariableKey: 'userCount', value: nodeOutput('count-users', ['count']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('build-body', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          'User count digest: {{userCount}} registered user(s).',
          { userCount: workflowVariable('userCount') },
        ),
        outputAssignments: [
          { targetVariableKey: 'body', value: nodeOutput('build-body', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('load-members', {
        actionRef: ACTION('identity.role-members'),
        input: {
          type: 'OBJECT',
          fields: { roleName: { type: 'EXPRESSION', expression: workflowInputPath(['roleName']) } },
        },
        outputAssignments: [
          { targetVariableKey: 'emails', value: nodeOutput('load-members', ['emails']) },
          { targetVariableKey: 'memberCount', value: nodeOutput('load-members', ['count']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-has-emails', 'EXACT_ONE'),
      forEachNode('send-each', {
        items: nodeOutput('load-members', ['emails']),
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: currentItem() },
            subject: { type: 'EXPRESSION', expression: lit('Scheduled user count digest') },
            text: { type: 'EXPRESSION', expression: workflowVariable('body') },
          },
        },
        maxConcurrency: 2,
        joinMode: 'ALL',
        retryPolicy: NO_RETRY,
      }),
      endNode('end-sent', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('SENT') },
          userCount: { type: 'EXPRESSION', expression: workflowVariable('userCount') },
          memberCount: { type: 'EXPRESSION', expression: workflowVariable('memberCount') },
        },
      }),
      endNode('end-no-emails', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('NO_EMAILS') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
      endNode('end-send-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('SEND_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-count-err', 'count-users', 'end-failed'),
      unconditionalEdge('e-count-body', 'count-users', 'build-body'),
      errorEdge('e-body-err', 'build-body', 'end-failed'),
      unconditionalEdge('e-body-members', 'build-body', 'load-members'),
      errorEdge('e-members-err', 'load-members', 'end-failed'),
      unconditionalEdge('e-members-dec', 'load-members', 'd-has-emails'),
      decisionEdge('e-has-emails', 'd-has-emails', 'send-each', {
        op: 'GT',
        left: workflowVariable('memberCount'),
        right: lit(0),
      }),
      decisionDefaultEdge('e-no-emails', 'd-has-emails', 'end-no-emails'),
      errorEdge('e-send-err', 'send-each', 'end-send-failed'),
      unconditionalEdge('e-send-done', 'send-each', 'end-sent'),
    ],
    // MANUAL seed path; authors can switch start to SCHEDULE without changing Actions.
    start: { type: 'MANUAL_API', targetNodeKey: 'count-users' },
  });
}

async function main() {
  await bootWorkflowMachineSeed();
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { roleName: 'ADMIN' },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-28');
  const nodes = await listNodeInstancesForInstance(instance.id);
  if (nodes.some((n) => n.semanticNodeKey === 'end-sent' && n.status === 'SUCCEEDED')) {
    console.log('[seed] user count digest emailed.');
    return;
  }
  if (nodes.some((n) => n.semanticNodeKey === 'end-send-failed' && n.status === 'SUCCEEDED')) {
    console.log('[seed] user count + FOR_EACH ran; SMTP timed out — machine published (env gap).');
    process.exitCode = 2;
    return;
  }
  await assertEnd(instance.id, 'end-sent');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
