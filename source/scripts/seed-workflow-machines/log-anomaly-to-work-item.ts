/**
 * p-89 WFM-27 — `log-anomaly-to-work-item`
 * ops.app-logs-recent (ERROR) → ADMIN Work Item for triage.
 * Control-plane logs are Prisma (not Edge db-query).
 * Run: `npx tsx scripts/seed-workflow-machines/log-anomaly-to-work-item.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { prisma } from '../../src/server/domain/users/prismaHelpers';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  decisionNode, decisionEdge, decisionDefaultEdge,
  lit, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'log-anomaly-to-work-item';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'Log anomaly to work item',
    inputSchema: {
      type: 'INLINE',
      schema: { type: 'object', properties: {}, additionalProperties: true },
    },
    variables: [
      { key: 'errorCount', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('scan-errors', {
        actionRef: ACTION('ops.app-logs-recent'),
        input: {
          type: 'OBJECT',
          fields: {
            level: { type: 'EXPRESSION', expression: lit('ERROR') },
            limit: { type: 'EXPRESSION', expression: lit(10) },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'errorCount', value: nodeOutput('scan-errors', ['count']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-has-errors', 'EXACT_ONE'),
      workItemNode('triage-anomaly', {
        workItemType: 'REVIEW',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['DONE'],
        title: lit('Triage app log ERROR anomaly'),
        input: {
          type: 'OBJECT',
          fields: {
            errorCount: { type: 'EXPRESSION', expression: workflowVariable('errorCount') },
            topId: { type: 'EXPRESSION', expression: nodeOutput('scan-errors', ['top', 'id']) },
            topContext: { type: 'EXPRESSION', expression: nodeOutput('scan-errors', ['top', 'context']) },
            topMessage: { type: 'EXPRESSION', expression: nodeOutput('scan-errors', ['top', 'message']) },
          },
        },
      }),
      endNode('end-triaged', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('TRIAGED') },
          errorCount: { type: 'EXPRESSION', expression: workflowVariable('errorCount') },
          topId: { type: 'EXPRESSION', expression: nodeOutput('scan-errors', ['top', 'id']) },
        },
      }),
      endNode('end-clean', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('NO_ERRORS') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-scan-err', 'scan-errors', 'end-failed'),
      unconditionalEdge('e-scan-dec', 'scan-errors', 'd-has-errors'),
      decisionEdge('e-has', 'd-has-errors', 'triage-anomaly', {
        op: 'GT',
        left: workflowVariable('errorCount'),
        right: lit(0),
      }),
      decisionDefaultEdge('e-clean', 'd-has-errors', 'end-clean'),
      workItemOutcomeEdge('e-done', 'triage-anomaly', 'end-triaged', 'DONE'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'scan-errors' },
  });
}

async function ensureErrorLog(): Promise<void> {
  const existing = await prisma().baseAppLog.findFirst({
    where: { level: 'ERROR' },
    select: { id: true },
  });
  if (existing) return;
  await prisma().baseAppLog.create({
    data: {
      level: 'ERROR',
      context: 'Wfm27Seed',
      message: 'Seeded ERROR log for WFM-27 log-anomaly-to-work-item.',
      actor: 'SYSTEM',
      messageSize: 64,
    },
  });
  console.log('[seed] inserted a seed ERROR log row.');
}

async function main() {
  await bootWorkflowMachineSeed();
  await ensureErrorLog();
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {},
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-27');
  const wi = await dispatchUntilKey(instance.id, 'triage-anomaly', 'seed-wfm-27');
  if (!wi) {
    // No errors path — still a valid end
    await assertEnd(instance.id, 'end-clean');
    console.log('[seed] no ERROR logs — ended clean.');
    return;
  }
  await completeWi(wi.id, admin.userId, 'DONE');
  await drainAutomated(instance.id, 'seed-wfm-27');
  await assertEnd(instance.id, 'end-triaged');
  console.log('[seed] anomaly triaged via Work Item.');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
