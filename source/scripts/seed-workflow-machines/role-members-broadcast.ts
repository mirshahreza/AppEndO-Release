/**
 * p-89 WFM-23 — `role-members-broadcast`
 * identity.role-members → FOR_EACH communication.email-send to real member emails.
 * Run: `npx tsx scripts/seed-workflow-machines/role-members-broadcast.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, actionNode, unconditionalEdge, forEachNode,
  decisionNode, decisionEdge, decisionDefaultEdge,
  lit, workflowInputPath, nodeOutput, currentItem, errorEdge, workflowVariable,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, drainAutomated, assertEnd,
  bootWorkflowMachineSeed,
} from './_seedHelpers';
import { listNodeInstancesForInstance } from '../../src/server/domain/workflow/workflowNodeInstanceRepository';

const KEY = 'role-members-broadcast';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'Role members broadcast',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          roleName: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['roleName', 'subject', 'body'],
      },
    },
    variables: [
      { key: 'emails', schema: { type: 'INLINE', schema: {} } },
      { key: 'memberCount', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
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
            subject: { type: 'EXPRESSION', expression: workflowInputPath(['subject']) },
            text: { type: 'EXPRESSION', expression: workflowInputPath(['body']) },
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
          memberCount: { type: 'EXPRESSION', expression: workflowVariable('memberCount') },
        },
      }),
      endNode('end-no-emails', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('NO_EMAILS') } },
      }),
      endNode('end-load-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('LOAD_FAILED') } },
      }),
      endNode('end-send-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('SEND_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-members', 'end-load-failed'),
      unconditionalEdge('e-load-dec', 'load-members', 'd-has-emails'),
      decisionEdge('e-has-emails', 'd-has-emails', 'send-each', {
        op: 'GT',
        left: workflowVariable('memberCount'),
        right: lit(0),
      }),
      decisionDefaultEdge('e-no-emails', 'd-has-emails', 'end-no-emails'),
      errorEdge('e-send-err', 'send-each', 'end-send-failed'),
      unconditionalEdge('e-send-done', 'send-each', 'end-sent'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-members' },
  });
}

async function main() {
  await bootWorkflowMachineSeed();
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      roleName: 'ADMIN',
      subject: 'Workflow role broadcast (WFM-23)',
      body: 'This is a live role-members broadcast from the workflow engine.',
    },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-23');
  const nodes = await listNodeInstancesForInstance(instance.id);
  if (nodes.some((n) => n.semanticNodeKey === 'end-sent' && n.status === 'SUCCEEDED')) {
    console.log('[seed] broadcast complete.');
    return;
  }
  if (nodes.some((n) => n.semanticNodeKey === 'end-send-failed' && n.status === 'SUCCEEDED')) {
    console.log('[seed] role members resolved + FOR_EACH ran; SMTP delivery timed out — machine published (env gap).');
    process.exitCode = 2;
    return;
  }
  await assertEnd(instance.id, 'end-sent');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
