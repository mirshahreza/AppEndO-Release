/**
 * p-89 WFM-24 — `base-info-vocab-propose`
 * ADMIN approve → base-info.create under CMS Content Tags category.
 * Run: `npx tsx scripts/seed-workflow-machines/base-info-vocab-propose.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'base-info-vocab-propose';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'Base Info vocab propose',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          parentId: { type: 'string' },
          title: { type: 'string' },
          titleEn: { type: 'string' },
          shortName: { type: 'string' },
          actorUserId: { type: 'integer' },
        },
        required: ['parentId', 'title', 'actorUserId'],
      },
    },
    variables: [
      { key: 'createdId', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      workItemNode('vocab-approve', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve Base Info vocabulary proposal'),
        input: {
          type: 'OBJECT',
          fields: {
            parentId: { type: 'EXPRESSION', expression: workflowInputPath(['parentId']) },
            title: { type: 'EXPRESSION', expression: workflowInputPath(['title']) },
          },
        },
      }),
      actionNode('create-node', {
        actionRef: ACTION('base-info.create'),
        input: {
          type: 'OBJECT',
          fields: {
            parentId: { type: 'EXPRESSION', expression: workflowInputPath(['parentId']) },
            title: { type: 'EXPRESSION', expression: workflowInputPath(['title']) },
            titleEn: { type: 'EXPRESSION', expression: workflowInputPath(['titleEn']) },
            shortName: { type: 'EXPRESSION', expression: workflowInputPath(['shortName']) },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'createdId', value: nodeOutput('create-node', ['id']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      endNode('end-created', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('CREATED') },
          id: { type: 'EXPRESSION', expression: workflowVariable('createdId') },
        },
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
      endNode('end-create-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('CREATE_FAILED') } },
      }),
    ],
    edges: [
      workItemOutcomeEdge('e-approve', 'vocab-approve', 'create-node', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'vocab-approve', 'end-rejected', 'REJECT'),
      errorEdge('e-create-err', 'create-node', 'end-create-failed'),
      unconditionalEdge('e-create-done', 'create-node', 'end-created'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'vocab-approve' },
  });
}

async function resolveContentTagsParent(): Promise<string> {
  const root = await prisma().baseInfo.findFirst({ where: { parentId: null, titleEn: 'CMS' } });
  if (!root) throw new Error('CMS base_info root missing — run CMS Phase 1');
  const tags = await prisma().baseInfo.findFirst({
    where: { parentId: root.id, titleEn: 'Content Tags' },
  });
  if (!tags) throw new Error('CMS Content Tags category missing');
  return tags.id;
}

async function main() {
  await bootWorkflowMachineSeed();
  const parentId = await resolveContentTagsParent();
  const stamp = Date.now().toString(36);
  const title = `WFM Tag ${stamp}`;
  const shortName = `wfm_tag_${stamp}`;
  console.log(`[seed] propose vocab under ${parentId}: ${title}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      parentId,
      title,
      titleEn: title,
      shortName,
      actorUserId: admin.userId,
    },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-24');
  const wi = await dispatchUntilKey(instance.id, 'vocab-approve', 'seed-wfm-24');
  if (!wi) throw new Error('vocab-approve missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-24');
  await assertEnd(instance.id, 'end-created');
  const created = await prisma().baseInfo.findFirst({ where: { parentId, titleEn: title } });
  if (!created) throw new Error(`base_info child not found under ${parentId}`);
  console.log(`[seed] created base_info#${created.id}`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
