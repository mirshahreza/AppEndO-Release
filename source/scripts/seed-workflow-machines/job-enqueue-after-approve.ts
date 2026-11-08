/**
 * p-89 WFM-26 — `job-enqueue-after-approve`
 * ADMIN WI → jobs.enqueue a real managed Server Function into base_jobs.
 * Run: `npx tsx scripts/seed-workflow-machines/job-enqueue-after-approve.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { listManagedFunctions } from '../../src/server/domain/functions/functionRepository';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'job-enqueue-after-approve';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'Job enqueue after approve',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          functionId: { type: 'string' },
          actorUserId: { type: 'integer' },
          title: { type: 'string' },
        },
        required: ['functionId', 'actorUserId'],
      },
    },
    nodes: [
      workItemNode('approve-enqueue', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve background job enqueue'),
        input: {
          type: 'OBJECT',
          fields: {
            functionId: { type: 'EXPRESSION', expression: workflowInputPath(['functionId']) },
            title: { type: 'EXPRESSION', expression: workflowInputPath(['title']) },
          },
        },
      }),
      actionNode('enqueue-job', {
        actionRef: ACTION('jobs.enqueue'),
        input: {
          type: 'OBJECT',
          fields: {
            functionId: { type: 'EXPRESSION', expression: workflowInputPath(['functionId']) },
            title: { type: 'EXPRESSION', expression: workflowInputPath(['title']) },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
            payload: {
              type: 'OBJECT',
              fields: {
                source: { type: 'EXPRESSION', expression: lit('wfm-26') },
              },
            },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-enqueued', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('ENQUEUED') },
          jobId: { type: 'EXPRESSION', expression: nodeOutput('enqueue-job', ['jobId']) },
          functionId: { type: 'EXPRESSION', expression: nodeOutput('enqueue-job', ['functionId']) },
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
      workItemOutcomeEdge('e-approve', 'approve-enqueue', 'enqueue-job', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'approve-enqueue', 'end-rejected', 'REJECT'),
      errorEdge('e-enq-err', 'enqueue-job', 'end-failed'),
      unconditionalEdge('e-enq-done', 'enqueue-job', 'end-enqueued'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'approve-enqueue' },
  });
}

async function main() {
  await bootWorkflowMachineSeed();
  const fns = await listManagedFunctions();
  const preferred = fns.find((f) => String((f as { id?: string }).id ?? '').endsWith('-list'))
    ?? fns[0];
  const functionId = (preferred as { id?: string } | undefined)?.id;
  if (!functionId) throw new Error('No managed Server Function available to enqueue.');
  console.log(`[seed] will enqueue functionId=${functionId}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      functionId,
      actorUserId: admin.userId,
      title: `WFM-26 enqueue ${functionId}`,
    },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-26');
  const wi = await dispatchUntilKey(instance.id, 'approve-enqueue', 'seed-wfm-26');
  if (!wi) throw new Error('approve-enqueue missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-26');
  await assertEnd(instance.id, 'end-enqueued');
  console.log('[seed] job enqueued via workflow.');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
