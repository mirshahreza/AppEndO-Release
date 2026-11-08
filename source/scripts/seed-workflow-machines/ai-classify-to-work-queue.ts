/**
 * p-89 WFM-10 — `ai-classify-to-work-queue`
 * ai.classify on real subject text → DECISION → ADMIN Work Item.
 * Requires live AI provider; if classify fails, seed exits non-zero (tool env gap).
 * Run: `npx tsx scripts/seed-workflow-machines/ai-classify-to-work-queue.ts`
 */
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, decisionNode, decisionEdge, decisionDefaultEdge, actionNode,
  unconditionalEdge, workItemNode, workItemOutcomeEdge, lit, workflowInputPath,
  nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd,
} from './_seedHelpers';
import { listNodeInstancesForInstance as listNodes } from '../../src/server/domain/workflow/workflowNodeInstanceRepository';

const KEY = 'ai-classify-to-work-queue';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'AI classify to work queue',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          requesterUserId: { type: 'integer' },
          text: { type: 'string' },
        },
        required: ['requesterUserId', 'text'],
      },
    },
    variables: [
      { key: 'requesterDisplayName', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('resolve-requester', {
        actionRef: ACTION('identity.user-get'),
        input: { type: 'OBJECT', fields: { userId: { type: 'EXPRESSION', expression: workflowInputPath(['requesterUserId']) } } },
        outputAssignments: [
          { targetVariableKey: 'requesterDisplayName', value: nodeOutput('resolve-requester', ['displayName']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('classify', {
        actionRef: ACTION('ai.classify'),
        input: {
          type: 'OBJECT',
          fields: {
            text: { type: 'EXPRESSION', expression: workflowInputPath(['text']) },
            labels: {
              type: 'ARRAY',
              items: [
                { type: 'EXPRESSION', expression: lit('LOW') },
                { type: 'EXPRESSION', expression: lit('MEDIUM') },
                { type: 'EXPRESSION', expression: lit('HIGH') },
              ],
            },
          },
        },
        // No outputAssignments: ON_ERROR path would otherwise fail looking for `label` on the error object.
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-urgency', 'EXACT_ONE'),
      workItemNode('queue-high', {
        workItemType: 'REVIEW',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['DONE'],
        title: lit('High urgency triage'),
        input: {
          type: 'OBJECT',
          fields: {
            text: { type: 'EXPRESSION', expression: workflowInputPath(['text']) },
            label: { type: 'EXPRESSION', expression: nodeOutput('classify', ['label']) },
          },
        },
      }),
      workItemNode('queue-normal', {
        workItemType: 'REVIEW',
        assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' },
        allowedOutcomes: ['DONE'],
        title: lit('Normal urgency triage'),
        input: {
          type: 'OBJECT',
          fields: {
            text: { type: 'EXPRESSION', expression: workflowInputPath(['text']) },
            label: { type: 'EXPRESSION', expression: nodeOutput('classify', ['label']) },
          },
        },
      }),
      endNode('end-done', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('DONE') },
          label: { type: 'EXPRESSION', expression: nodeOutput('classify', ['label']) },
        },
      }),
      endNode('end-classify-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('CLASSIFY_FAILED') } },
      }),
    ],
    edges: [
      unconditionalEdge('e-resolve-cls', 'resolve-requester', 'classify'),
      errorEdge('e-cls-err', 'classify', 'end-classify-failed'),
      unconditionalEdge('e-cls-dec', 'classify', 'd-urgency'),
      decisionEdge('e-high', 'd-urgency', 'queue-high', {
        op: 'EQ',
        left: nodeOutput('classify', ['label']),
        right: lit('HIGH'),
      }),
      decisionDefaultEdge('e-normal', 'd-urgency', 'queue-normal'),
      workItemOutcomeEdge('e-high-done', 'queue-high', 'end-done', 'DONE'),
      workItemOutcomeEdge('e-normal-done', 'queue-normal', 'end-done', 'DONE'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'resolve-requester' },
  });
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const user = await pickUnlockedUser();
  const admin = (await pickRoleMembers('ADMIN', 1))[0]!;
  const developer = (await pickRoleMembers('DEVELOPER', 1))[0]!;
  if (!user) throw new Error('no user');

  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      requesterUserId: user.userId,
      text: 'Production database is down and customers cannot check out. Urgent.',
    },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-10');

  const nodes = await listNodes(instance.id);
  const failed = nodes.find((n) => n.semanticNodeKey === 'end-classify-failed' && n.status === 'SUCCEEDED');
  if (failed) {
    console.log('[seed] ai.classify unavailable in this environment — machine published; live AI path blocked.');
    process.exitCode = 2;
    return;
  }
  const classifyFailed = nodes.find((n) => n.semanticNodeKey === 'classify' && n.status === 'FAILED');
  if (classifyFailed) {
    console.log('[seed] classify node FAILED — publish OK, live AI blocked.');
    process.exitCode = 2;
    return;
  }

  const high = await dispatchUntilKey(instance.id, 'queue-high', 'seed-wfm-10');
  const normal = high ? null : await dispatchUntilKey(instance.id, 'queue-normal', 'seed-wfm-10');
  const wi = high ?? normal;
  if (!wi) throw new Error('no triage queue waiting');
  const actor = high ? admin.userId : developer.userId;
  await completeWi(wi.id, actor, 'DONE');
  await drainAutomated(instance.id, 'seed-wfm-10');
  await assertEnd(instance.id, 'end-done');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
