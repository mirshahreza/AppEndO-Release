/**
 * p-89 WFM-09 — `sla-work-item-escalate`
 * ADMIN WI with AFTER_OPEN_MS=0 COMPLETE_WITH_OUTCOME → auto escalate path.
 * Run: `npx tsx scripts/seed-workflow-machines/sla-work-item-escalate.ts`
 */
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import { scanAndRunDueEscalations } from '../../src/server/domain/workflow/engine/workItemEscalationService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, mappingOf,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, templateInput, ensurePublished, pickUnlockedUser,
  dispatchUntilKey, drainAutomated, assertEnd,
} from './_seedHelpers';

const KEY = 'sla-work-item-escalate';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'SLA work item escalate',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          requesterUserId: { type: 'integer' },
          subject: { type: 'string' },
        },
        required: ['requesterUserId', 'subject'],
      },
    },
    variables: [
      { key: 'requesterEmail', schema: { type: 'INLINE', schema: {} } },
      { key: 'requesterDisplayName', schema: { type: 'INLINE', schema: {} } },
      { key: 'notifyText', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('resolve-requester', {
        actionRef: ACTION('identity.user-get'),
        input: { type: 'OBJECT', fields: { userId: { type: 'EXPRESSION', expression: workflowInputPath(['requesterUserId']) } } },
        outputAssignments: [
          { targetVariableKey: 'requesterEmail', value: nodeOutput('resolve-requester', ['email']) },
          { targetVariableKey: 'requesterDisplayName', value: nodeOutput('resolve-requester', ['displayName']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      workItemNode('l1-queue', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT', 'AUTO_ESCALATED'],
        title: lit('L1 handle request (SLA)'),
        input: {
          type: 'OBJECT',
          fields: {
            subject: { type: 'EXPRESSION', expression: workflowInputPath(['subject']) },
            requesterDisplayName: { type: 'EXPRESSION', expression: workflowVariable('requesterDisplayName') },
          },
        },
        escalationPolicy: {
          steps: [
            {
              key: 'sla-auto',
              trigger: { type: 'AFTER_OPEN_MS', afterMs: 0 },
              action: {
                type: 'COMPLETE_WITH_OUTCOME',
                outcomeKey: 'AUTO_ESCALATED',
                output: mappingOf({ escalated: lit(true) }),
              },
              maxExecutions: 1,
            },
          ],
        },
      }),
      actionNode('msg-escalated', {
        actionRef: ACTION('text.template'),
        input: templateInput('SLA fired for "{{subject}}" — auto-escalated without L1 claim.', {
          subject: workflowInputPath(['subject']),
        }),
        outputAssignments: [{ targetVariableKey: 'notifyText', value: nodeOutput('msg-escalated', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      endNode('end-escalated', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('AUTO_ESCALATED') } },
      }),
      endNode('end-approved', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('APPROVED') } },
      }),
    ],
    edges: [
      unconditionalEdge('e-resolve-l1', 'resolve-requester', 'l1-queue'),
      workItemOutcomeEdge('e-auto', 'l1-queue', 'msg-escalated', 'AUTO_ESCALATED'),
      workItemOutcomeEdge('e-ok', 'l1-queue', 'end-approved', 'APPROVE'),
      workItemOutcomeEdge('e-rej', 'l1-queue', 'end-approved', 'REJECT'),
      unconditionalEdge('e-msg-end', 'msg-escalated', 'end-escalated'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'resolve-requester' },
  });
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { requesterUserId: user.userId, subject: 'VPN access stuck' },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  const wi = await dispatchUntilKey(instance.id, 'l1-queue', 'seed-wfm-09');
  if (!wi) throw new Error('l1-queue not waiting');
  // Do not claim — let SLA escalation fire
  const esc = await scanAndRunDueEscalations();
  console.log(`[seed] escalation scan: scanned=${esc.workItemsScanned} executed=${esc.stepsExecuted}`);
  await drainAutomated(instance.id, 'seed-wfm-09');
  await assertEnd(instance.id, 'end-escalated');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
