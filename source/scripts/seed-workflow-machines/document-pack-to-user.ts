/**
 * p-89 WFM-06 — `document-pack-to-user`
 * PDF via document.pdf-generate + email to real user.
 * Run: `npx tsx scripts/seed-workflow-machines/document-pack-to-user.ts`
 */
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, decisionNode, decisionEdge, decisionDefaultEdge, actionNode,
  unconditionalEdge, workItemNode, workItemOutcomeEdge, lit, workflowInputPath,
  workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, templateInput, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd,
} from './_seedHelpers';

const KEY = 'document-pack-to-user';

function buildModel(): WorkflowModel {
  const hasEmail = {
    op: 'AND' as const,
    values: [
      { op: 'IS_NOT_NULL' as const, value: workflowVariable('requesterEmail') },
      { op: 'NE' as const, left: workflowVariable('requesterEmail'), right: lit('') },
    ],
  };
  return baseModel({
    key: KEY,
    name: 'Document pack to user',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          requesterUserId: { type: 'integer' },
          candidateName: { type: 'string' },
          roleTitle: { type: 'string' },
          comp: { type: 'string' },
          startDate: { type: 'string' },
        },
        required: ['requesterUserId', 'candidateName', 'roleTitle', 'comp', 'startDate'],
      },
    },
    variables: [
      { key: 'requesterEmail', schema: { type: 'INLINE', schema: {} } },
      { key: 'requesterDisplayName', schema: { type: 'INLINE', schema: {} } },
      { key: 'pdfPath', schema: { type: 'INLINE', schema: {} } },
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
      workItemNode('approve-pack', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve offer letter pack'),
        input: {
          type: 'OBJECT',
          fields: {
            candidateName: { type: 'EXPRESSION', expression: workflowInputPath(['candidateName']) },
            roleTitle: { type: 'EXPRESSION', expression: workflowInputPath(['roleTitle']) },
            comp: { type: 'EXPRESSION', expression: workflowInputPath(['comp']) },
          },
        },
      }),
      actionNode('build-body', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          'Offer for {{name}}\nRole: {{role}}\nCompensation: {{comp}}\nStart: {{start}}\n\nWelcome aboard.',
          {
            name: workflowInputPath(['candidateName']),
            role: workflowInputPath(['roleTitle']),
            comp: workflowInputPath(['comp']),
            start: workflowInputPath(['startDate']),
          },
        ),
        outputAssignments: [{ targetVariableKey: 'notifyText', value: nodeOutput('build-body', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      actionNode('generate-pdf', {
        actionRef: ACTION('document.pdf-generate'),
        input: {
          type: 'OBJECT',
          fields: {
            path: { type: 'EXPRESSION', expression: lit('workspace/offer-letter.pdf') },
            body: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
            heading: { type: 'EXPRESSION', expression: lit('Offer Letter') },
          },
        },
        outputAssignments: [{ targetVariableKey: 'pdfPath', value: nodeOutput('generate-pdf', ['path']) }],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-email', 'EXACT_ONE'),
      actionNode('email-pack', {
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: workflowVariable('requesterEmail') },
            subject: { type: 'EXPRESSION', expression: lit('Your offer letter is ready') },
            text: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-sent', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('SENT') },
          pdfPath: { type: 'EXPRESSION', expression: workflowVariable('pdfPath') },
        },
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
    ],
    edges: [
      unconditionalEdge('e-resolve-wi', 'resolve-requester', 'approve-pack'),
      workItemOutcomeEdge('e-ok', 'approve-pack', 'build-body', 'APPROVE'),
      workItemOutcomeEdge('e-rej', 'approve-pack', 'end-rejected', 'REJECT'),
      unconditionalEdge('e-body-pdf', 'build-body', 'generate-pdf'),
      unconditionalEdge('e-pdf-dec', 'generate-pdf', 'd-email'),
      errorEdge('e-pdf-err', 'generate-pdf', 'end-sent'),
      decisionEdge('e-email', 'd-email', 'email-pack', hasEmail),
      decisionDefaultEdge('e-skip', 'd-email', 'end-sent'),
      unconditionalEdge('e-email-end', 'email-pack', 'end-sent'),
      errorEdge('e-email-err', 'email-pack', 'end-sent'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'resolve-requester' },
  });
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const requester = await pickUnlockedUser();
  const admin = (await pickRoleMembers('ADMIN', 1))[0]!;
  if (!requester) throw new Error('no requester');

  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      requesterUserId: requester.userId,
      candidateName: 'Ada Lovelace',
      roleTitle: 'Staff Engineer',
      comp: 'USD 160000',
      startDate: '2026-09-01',
    },
    startedByType: 'USER',
    startedById: admin.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  const wi = await dispatchUntilKey(instance.id, 'approve-pack', 'seed-wfm-06');
  if (!wi) throw new Error('approve-pack not waiting');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-06');
  await assertEnd(instance.id, 'end-sent');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
