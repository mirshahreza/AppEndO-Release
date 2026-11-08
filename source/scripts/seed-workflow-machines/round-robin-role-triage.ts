/**
 * p-89 WFM-04 — `round-robin-role-triage`
 *
 * Real entities: base_users / base_user_roles (identity.role-members + ROUND_ROBIN among
 * live DEVELOPER members), base_work_items, optional email to requester.
 *
 * ROUND_ROBIN requires an author-declared userIds list — seed loads current DEVELOPER members
 * from DB and publishes them into the assignment (re-publish refreshes the roster).
 *
 * Run: `npx tsx scripts/seed-workflow-machines/round-robin-role-triage.ts`
 */
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import {
  createWorkflowDefinition,
  listWorkflowDefinitions,
  getWorkflowDefinitionById,
  updateWorkflowDefinitionDraft,
} from '../../src/server/domain/workflow/workflowDefinitionRepository';
import { prisma } from '../../src/server/domain/workflow/prismaHelpers';
import { publishWorkflowDefinition } from '../../src/server/domain/workflow/publication/workflowPublicationService';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import { dispatchNode } from '../../src/server/domain/workflow/engine/dispatchService';
import { listNodeInstancesForInstance } from '../../src/server/domain/workflow/workflowNodeInstanceRepository';
import { claimWorkItem, completeWorkItem } from '../../src/server/domain/workflow/engine/workItemService';
import { getWorkItemByNodeInstance } from '../../src/server/domain/workflow/workItemRepository';
import type { WorkflowModel, CanonicalMapping, CanonicalExpression } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel,
  endNode,
  decisionNode,
  decisionEdge,
  decisionDefaultEdge,
  actionNode,
  unconditionalEdge,
  workItemNode,
  workItemOutcomeEdge,
  lit,
  workflowInputPath,
  workflowVariable,
  nodeOutput,
  errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import { fromUserId } from '../../src/server/domain/users/prismaHelpers';
import { listRoleMemberSummaries } from '../../src/server/domain/users/userRoleRepository';

const DEFINITION_KEY = 'round-robin-role-triage';
const TRIAGE_ROLE = 'DEVELOPER';
const ACTION = (actionKey: string) => ({
  type: 'EXACT_PROVIDER' as const,
  action: { actionKey, actionVersion: '1' },
  providerId: 'core',
  providerVersion: '1',
});
const NO_RETRY = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

const templateInput = (template: string, variables: Record<string, CanonicalExpression>): CanonicalMapping => ({
  type: 'OBJECT',
  fields: {
    template: { type: 'EXPRESSION', expression: lit(template) },
    variables: {
      type: 'OBJECT',
      fields: Object.fromEntries(
        Object.entries(variables).map(([k, expression]) => [k, { type: 'EXPRESSION' as const, expression }]),
      ),
    },
  },
});

const hasEmailCondition: CanonicalExpression = {
  op: 'AND',
  values: [
    { op: 'IS_NOT_NULL', value: workflowVariable('requesterEmail') },
    { op: 'NE', left: workflowVariable('requesterEmail'), right: lit('') },
  ],
};

function buildModel(roundRobinUserIds: string[]): WorkflowModel {
  return baseModel({
    key: DEFINITION_KEY,
    name: 'Round-robin role triage',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          requesterUserId: { type: 'integer' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['requesterUserId', 'subject', 'body'],
      },
    },
    variables: [
      { key: 'requesterUserId', schema: { type: 'INLINE', schema: {} } },
      { key: 'requesterEmail', schema: { type: 'INLINE', schema: {} } },
      { key: 'requesterDisplayName', schema: { type: 'INLINE', schema: {} } },
      { key: 'triageRoleName', schema: { type: 'INLINE', schema: {} } },
      { key: 'triageMemberCount', schema: { type: 'INLINE', schema: {} } },
      { key: 'notifyText', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('resolve-requester', {
        actionRef: ACTION('identity.user-get'),
        input: {
          type: 'OBJECT',
          fields: { userId: { type: 'EXPRESSION', expression: workflowInputPath(['requesterUserId']) } },
        },
        outputAssignments: [
          { targetVariableKey: 'requesterUserId', value: nodeOutput('resolve-requester', ['userId']) },
          { targetVariableKey: 'requesterEmail', value: nodeOutput('resolve-requester', ['email']) },
          { targetVariableKey: 'requesterDisplayName', value: nodeOutput('resolve-requester', ['displayName']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('load-triage-roster', {
        actionRef: ACTION('identity.role-members'),
        input: {
          type: 'OBJECT',
          fields: { roleName: { type: 'EXPRESSION', expression: lit(TRIAGE_ROLE) } },
        },
        outputAssignments: [
          { targetVariableKey: 'triageRoleName', value: nodeOutput('load-triage-roster', ['roleName']) },
          { targetVariableKey: 'triageMemberCount', value: nodeOutput('load-triage-roster', ['count']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      workItemNode('triage-queue', {
        workItemType: 'REVIEW',
        assignment: { strategy: 'ROUND_ROBIN', userIds: roundRobinUserIds },
        allowedOutcomes: ['DONE', 'REJECT'],
        title: lit('Triage inbound request'),
        input: {
          type: 'OBJECT',
          fields: {
            requesterUserId: { type: 'EXPRESSION', expression: workflowVariable('requesterUserId') },
            requesterDisplayName: { type: 'EXPRESSION', expression: workflowVariable('requesterDisplayName') },
            subject: { type: 'EXPRESSION', expression: workflowInputPath(['subject']) },
            body: { type: 'EXPRESSION', expression: workflowInputPath(['body']) },
            triageRoleName: { type: 'EXPRESSION', expression: workflowVariable('triageRoleName') },
            triageMemberCount: { type: 'EXPRESSION', expression: workflowVariable('triageMemberCount') },
          },
        },
      }),
      actionNode('msg-done', {
        actionRef: ACTION('text.template'),
        input: templateInput('Hi {{name}}, your request "{{subject}}" was triaged.', {
          name: workflowVariable('requesterDisplayName'),
          subject: workflowInputPath(['subject']),
        }),
        outputAssignments: [{ targetVariableKey: 'notifyText', value: nodeOutput('msg-done', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-email-done', 'EXACT_ONE'),
      actionNode('email-done', {
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: workflowVariable('requesterEmail') },
            subject: { type: 'EXPRESSION', expression: lit('Request triaged') },
            text: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-done', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('DONE') } },
      }),
      actionNode('msg-rejected', {
        actionRef: ACTION('text.template'),
        input: templateInput('Hi {{name}}, your request "{{subject}}" was rejected at triage.', {
          name: workflowVariable('requesterDisplayName'),
          subject: workflowInputPath(['subject']),
        }),
        outputAssignments: [{ targetVariableKey: 'notifyText', value: nodeOutput('msg-rejected', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-email-rejected', 'EXACT_ONE'),
      actionNode('email-rejected', {
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: workflowVariable('requesterEmail') },
            subject: { type: 'EXPRESSION', expression: lit('Request rejected at triage') },
            text: { type: 'EXPRESSION', expression: workflowVariable('notifyText') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
    ],
    edges: [
      unconditionalEdge('e-resolve-roster', 'resolve-requester', 'load-triage-roster'),
      unconditionalEdge('e-roster-queue', 'load-triage-roster', 'triage-queue'),
      workItemOutcomeEdge('e-done', 'triage-queue', 'msg-done', 'DONE'),
      workItemOutcomeEdge('e-reject', 'triage-queue', 'msg-rejected', 'REJECT'),

      unconditionalEdge('e-msg-done-dec', 'msg-done', 'd-email-done'),
      decisionEdge('e-email-done', 'd-email-done', 'email-done', hasEmailCondition),
      decisionDefaultEdge('e-skip-email-done', 'd-email-done', 'end-done'),
      unconditionalEdge('e-email-done-end', 'email-done', 'end-done'),
      errorEdge('e-email-done-err', 'email-done', 'end-done'),

      unconditionalEdge('e-msg-rej-dec', 'msg-rejected', 'd-email-rejected'),
      decisionEdge('e-email-rej', 'd-email-rejected', 'email-rejected', hasEmailCondition),
      decisionDefaultEdge('e-skip-email-rej', 'd-email-rejected', 'end-rejected'),
      unconditionalEdge('e-email-rej-end', 'email-rejected', 'end-rejected'),
      errorEdge('e-email-rej-err', 'email-rejected', 'end-rejected'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'resolve-requester' },
  });
}

async function loadDeveloperIds(): Promise<string[]> {
  const result = await listRoleMemberSummaries(TRIAGE_ROLE);
  if ('roleMissing' in result) throw new Error(`Role ${TRIAGE_ROLE} missing`);
  const ids = result.members.map((m) => String(m.userId));
  if (ids.length < 2) {
    throw new Error(`Need at least 2 unlocked ${TRIAGE_ROLE} members for round-robin demo; found ${ids.length}.`);
  }
  return ids;
}

async function ensureDefinition(model: WorkflowModel): Promise<{ definitionId: number; revisionId: number }> {
  const existing = await listWorkflowDefinitions('global');
  const already = existing.find((d) => d.key === DEFINITION_KEY);
  if (already) {
    const fresh = await updateWorkflowDefinitionDraft(already.id, already.draftVersion, {
      draftDefinitionJson: JSON.stringify(model),
    });
    const { revision } = await publishWorkflowDefinition(fresh.id, fresh.draftVersion);
    if (revision.publicationStatus !== 'PUBLISHED') {
      throw new Error(`Publish rejected: ${revision.publicationStatus} ${revision.validationIssuesJson ?? ''}`);
    }
    console.log(`[seed] updated+published "${DEFINITION_KEY}" (id=${fresh.id}, rev #${revision.revisionNumber}).`);
    return { definitionId: fresh.id, revisionId: revision.id };
  }
  const definition = await createWorkflowDefinition({
    scopeKey: 'global',
    key: DEFINITION_KEY,
    draftDefinitionJson: JSON.stringify(model),
    creationMode: 'NEW',
  });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  if (revision.publicationStatus !== 'PUBLISHED') {
    throw new Error(`Publish rejected: ${revision.publicationStatus} ${revision.validationIssuesJson ?? ''}`);
  }
  console.log(`[seed] published "${DEFINITION_KEY}" (id=${definition.id}, rev #${revision.revisionNumber}).`);
  return { definitionId: definition.id, revisionId: revision.id };
}

async function dispatchUntilKey(instanceId: number, semanticNodeKey: string, leaseOwnerId: string, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const waiting = nodes.find((n) => n.semanticNodeKey === semanticNodeKey && n.status === 'WAITING_HUMAN');
    if (waiting) return waiting;
    const ready = nodes.find((n) => n.status === 'READY');
    if (ready) {
      await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
      continue;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

async function drainAutomated(instanceId: number, leaseOwnerId: string, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const nodes = await listNodeInstancesForInstance(instanceId);
    const ready = nodes.find((n) => n.status === 'READY');
    if (!ready) return;
    await dispatchNode({ nodeInstanceId: ready.id, leaseOwnerId });
  }
}

function assignedUserIdFromEvidence(evidenceJson: string | null): number | null {
  if (!evidenceJson) return null;
  try {
    const evidence = JSON.parse(evidenceJson) as { resolvedUserId?: number };
    return typeof evidence.resolvedUserId === 'number' ? evidence.resolvedUserId : null;
  } catch {
    return null;
  }
}

async function runOneTriage(definitionId: number, revisionId: number, requesterUserId: number, index: number) {
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      requesterUserId,
      subject: `Triage case ${index + 1}`,
      body: `Round-robin live case #${index + 1}`,
    },
    startedByType: 'USER',
    startedById: requesterUserId,
  });
  const triageNode = await dispatchUntilKey(instance.id, 'triage-queue', `seed-wfm-04-${index}`);
  if (!triageNode) throw new Error(`triage-queue not waiting for instance ${instance.id}`);
  const item = await getWorkItemByNodeInstance(triageNode.id);
  if (!item) throw new Error('work item missing');
  const assignedUserId = assignedUserIdFromEvidence(item.assignmentEvidenceJson);
  if (assignedUserId === null) throw new Error('ROUND_ROBIN did not resolve a USER');
  await claimWorkItem({ workItemId: item.id, actorUserId: assignedUserId });
  await completeWorkItem({ workItemId: item.id, actorUserId: assignedUserId, outcome: 'DONE', output: null });
  await drainAutomated(instance.id, `seed-wfm-04-${index}`);
  console.log(`[seed] instance #${instance.id} Work Item #${item.id} assigned+done by user #${assignedUserId}.`);
  return assignedUserId;
}

async function runLive(definitionId: number, revisionId: number, rosterIds: string[]) {
  const requester = await prisma().baseUser.findFirst({
    where: { locked: 0 },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!requester) {
    console.log('[seed] no requester user — publish only.');
    return;
  }
  const requesterUserId = fromUserId(requester.id);
  const sampleCount = Math.min(3, rosterIds.length);
  console.log(`[seed] live round-robin over ${rosterIds.length} DEVELOPER ids; starting ${sampleCount} instances…`);
  const assigned: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    assigned.push(await runOneTriage(definitionId, revisionId, requesterUserId, i));
  }
  const unique = new Set(assigned);
  if (sampleCount >= 2 && unique.size < 2) {
    console.log(`[seed] WARN: expected rotation across users; got ${assigned.join(',')}`);
  } else {
    console.log(`[seed] round-robin assignments: ${assigned.join(' → ')} — OK.`);
  }
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const rosterIds = await loadDeveloperIds();
  console.log(`[seed] DEVELOPER roster for ROUND_ROBIN: ${rosterIds.join(', ')}`);
  const { definitionId, revisionId } = await ensureDefinition(buildModel(rosterIds));
  await runLive(definitionId, revisionId, rosterIds);
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exitCode = 1;
});
