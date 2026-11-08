/**
 * Seeds two permanent, real example Workflow definitions into the live app database — a product
 * "tour" showcasing the durable execution engine's capabilities end to end, requested directly by
 * the platform owner alongside the UI/engine remediation work (see project memory).
 *
 * 1. `employee-leave-request` (simple): ACTION, DECISION, WORK_ITEM, END. Published AND started as
 *    a real live instance (every Action used is deterministic/offline — no live AI/SMTP/HTTP
 *    dependency — so the background engine worker can carry it all the way to a real outcome).
 * 2. `process-refund-payment` (child) + `ai-assisted-refund-review` (parent, complex): every one of
 *    the 11 AWM node kinds — ACTION, DECISION, SWITCH, PARALLEL_SPLIT, PARALLEL_JOIN, WORK_ITEM,
 *    WAIT_EVENT, SUBFLOW, DELAY, FAIL, END. Published (proving the full authoring/validation path
 *    for every kind) but deliberately NOT auto-started live: it references `ai.classify`/
 *    `ai.summarize`, and this environment has no live AI model provider configured (documented,
 *    pre-existing gap — EV-3 in prior session decision logs), so a live dispatch would just fail on
 *    that Action and sit stuck. The intended way to see it run end-to-end is the Designer's own
 *    Simulate tab (FULL mode with fixtures for the Action/WAIT_EVENT/WORK_ITEM nodes) — exactly the
 *    scenario Simulation exists for (doc 08 section 8 / doc 09 section 5).
 *
 * Run: `npx tsx scripts/seed-example-workflows.ts` (idempotent — skips any definition whose key
 * already exists, so re-running after a partial failure is safe).
 */
import { initPrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { registerCoreActionPack } from '../src/server/domain/workflow/actions/corePack';
import { createWorkflowDefinition, listWorkflowDefinitions, getWorkflowDefinitionById } from '../src/server/domain/workflow/workflowDefinitionRepository';
import { prisma } from '../src/server/domain/workflow/prismaHelpers';
import { publishWorkflowDefinition } from '../src/server/domain/workflow/publication/workflowPublicationService';
import { startWorkflowInstance } from '../src/server/domain/workflow/engine/startService';
import { dispatchNode } from '../src/server/domain/workflow/engine/dispatchService';
import { listNodeInstancesForInstance } from '../src/server/domain/workflow/workflowNodeInstanceRepository';
import { claimWorkItem, completeWorkItem } from '../src/server/domain/workflow/engine/workItemService';
import { getWorkItemByNodeInstance } from '../src/server/domain/workflow/workItemRepository';
import type { WorkflowModel, CanonicalMapping, CanonicalExpression } from '../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, failNode, decisionNode, decisionEdge, decisionDefaultEdge, actionNode,
  unconditionalEdge, delayNode, waitEventNode, waitTimeoutEdge, parallelSplitNode, parallelJoinNode,
  workItemNode, workItemOutcomeEdge, subflowNode, lit, workflowInputPath, workflowVariable, nodeOutput,
} from '../src/server/domain/workflow/engine/__tests__/fixtures';

const ACTION = (actionKey: string) => ({ type: 'EXACT_PROVIDER' as const, action: { actionKey, actionVersion: '1' }, providerId: 'core', providerVersion: '1' });
const NO_RETRY = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };

const templateInput = (template: string, variables: Record<string, CanonicalExpression>): CanonicalMapping => ({
  type: 'OBJECT',
  fields: {
    template: { type: 'EXPRESSION', expression: lit(template) },
    variables: { type: 'OBJECT', fields: Object.fromEntries(Object.entries(variables).map(([k, expression]) => [k, { type: 'EXPRESSION' as const, expression }])) },
  },
});

async function ensureDefinition(key: string, model: WorkflowModel, scopeKey = 'global') {
  const existing = await listWorkflowDefinitions(scopeKey);
  const already = existing.find((d) => d.key === key);
  if (already) {
    console.log(`[seed] "${key}" already exists (id=${already.id}) — skipping create/publish.`);
    return already;
  }
  const definition = await createWorkflowDefinition({ scopeKey, key, draftDefinitionJson: JSON.stringify(model), creationMode: 'NEW' });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  console.log(`[seed] published "${key}" (definitionId=${definition.id}, revision #${revision.revisionNumber}, status=${revision.publicationStatus}).`);
  return definition;
}

function buildLeaveRequestModel(): WorkflowModel {
  return baseModel({
    variables: [
      { key: 'diffMs', schema: { type: 'INLINE', schema: {} } },
      { key: 'diffDays', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('compute-days', {
        actionRef: ACTION('date.diff'),
        input: { type: 'OBJECT', fields: { fromIso: { type: 'EXPRESSION', expression: workflowInputPath(['startDate']) }, toIso: { type: 'EXPRESSION', expression: workflowInputPath(['endDate']) } } },
        outputAssignments: [
          { targetVariableKey: 'diffMs', value: nodeOutput('compute-days', ['diffMs']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-auto-or-manager', 'EXACT_ONE'),
      actionNode('notify-auto-approved', {
        actionRef: ACTION('text.template'),
        input: templateInput('Your {{days}}-day leave request was auto-approved.', { days: workflowVariable('diffMs') }),
        retryPolicy: NO_RETRY,
      }),
      endNode('end-auto-approved', { type: 'OBJECT', fields: { outcome: { type: 'EXPRESSION', expression: lit('AUTO_APPROVED') } } }),
      workItemNode('manager-approval', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve employee leave request'),
        input: { type: 'OBJECT', fields: { startDate: { type: 'EXPRESSION', expression: workflowInputPath(['startDate']) }, endDate: { type: 'EXPRESSION', expression: workflowInputPath(['endDate']) } } },
      }),
      actionNode('notify-manager-approved', { actionRef: ACTION('text.template'), input: templateInput('Your leave request was approved by your manager.', {}) , retryPolicy: NO_RETRY }),
      actionNode('notify-manager-rejected', { actionRef: ACTION('text.template'), input: templateInput('Your leave request was rejected.', {}) , retryPolicy: NO_RETRY }),
      endNode('end-approved', { type: 'OBJECT', fields: { outcome: { type: 'EXPRESSION', expression: lit('APPROVED') } } }),
      endNode('end-rejected', { type: 'OBJECT', fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } } }),
    ],
    edges: [
      unconditionalEdge('e-compute-decision', 'compute-days', 'd-auto-or-manager'),
      decisionEdge('e-auto', 'd-auto-or-manager', 'notify-auto-approved', { op: 'LTE', left: workflowVariable('diffMs'), right: lit(2 * 86_400_000) }),
      decisionDefaultEdge('e-manager', 'd-auto-or-manager', 'manager-approval'),
      unconditionalEdge('e-auto-end', 'notify-auto-approved', 'end-auto-approved'),
      workItemOutcomeEdge('e-approve', 'manager-approval', 'notify-manager-approved', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'manager-approval', 'notify-manager-rejected', 'REJECT'),
      unconditionalEdge('e-approved-end', 'notify-manager-approved', 'end-approved'),
      unconditionalEdge('e-rejected-end', 'notify-manager-rejected', 'end-rejected'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'compute-days' },
  });
}

function buildRefundChildModel(): WorkflowModel {
  // A retry-exhausted ACTION failure propagates to instance-level unhandled failure automatically
  // (doc 05 section 29) — no author-level DECISION/FAIL branch is needed to express "the gateway
  // call failed". `maxAttempts=1` here is not a missed opportunity to demo retries — it is the
  // *correct*, engine-enforced choice: `integration.http-request`'s idempotency guarantee is
  // `NONE` (doc04 §5 real registry data), and the doc04 §5 idempotency-compatibility validator
  // rejects any non-PURE, multi-attempt Action whose guarantee doesn't cover automatic replay
  // (confirmed live: publishing this with `maxAttempts:3` was rejected with
  // `WF_ACTION_IDEMPOTENCY_INCOMPATIBLE`). A real payment-gateway call is exactly the kind of
  // write-external, non-idempotent effect that engine safety rule exists to protect against.
  return baseModel({
    nodes: [
      actionNode('call-payment-gateway', {
        actionRef: ACTION('integration.http-request'),
        input: { type: 'OBJECT', fields: { url: { type: 'EXPRESSION', expression: lit('https://example-payment-gateway.invalid/refund') }, method: { type: 'EXPRESSION', expression: lit('POST') } } },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-refund-succeeded', { type: 'OBJECT', fields: { status: { type: 'EXPRESSION', expression: lit('SETTLED') } } }),
    ],
    edges: [
      unconditionalEdge('e-gateway-ok', 'call-payment-gateway', 'end-refund-succeeded'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'call-payment-gateway' },
  });
}

function buildRefundReviewModel(): WorkflowModel {
  const switchCaseEdge = (key: string, from: string, to: string, value: string) => ({ key, fromNodeKey: from, toNodeKey: to, selector: { type: 'SWITCH_CASE' as const, value } });
  const switchDefaultEdge = (key: string, from: string, to: string) => ({ key, fromNodeKey: from, toNodeKey: to, selector: { type: 'SWITCH_DEFAULT' as const } });

  return baseModel({
    nodes: [
      actionNode('classify-risk', {
        actionRef: ACTION('ai.classify'),
        input: { type: 'OBJECT', fields: { text: { type: 'EXPRESSION', expression: workflowInputPath(['reason']) }, labels: { type: 'ARRAY', items: [{ type: 'EXPRESSION', expression: lit('LOW') }, { type: 'EXPRESSION', expression: lit('MEDIUM') }, { type: 'EXPRESSION', expression: lit('HIGH') }] } } },
        outputAssignments: [{ targetVariableKey: 'riskLevel', value: nodeOutput('classify-risk', ['label']) }],
        retryPolicy: NO_RETRY,
      }),
      { kind: 'SWITCH', key: 'sw-risk', value: workflowVariable('riskLevel') } as never,
      parallelSplitNode('ps-verify'),
      actionNode('check-payment-history', { actionRef: ACTION('integration.http-request'), input: { type: 'OBJECT', fields: { url: { type: 'EXPRESSION', expression: lit('https://example-payment-gateway.invalid/history') } } } , retryPolicy: NO_RETRY }),
      actionNode('summarize-notes', { actionRef: ACTION('ai.summarize'), input: { type: 'OBJECT', fields: { text: { type: 'EXPRESSION', expression: workflowInputPath(['supportNotes']) } } } , retryPolicy: NO_RETRY }),
      parallelJoinNode('pj-verify', 'ALL'),
      decisionNode('d-amount', 'EXACT_ONE'),
      workItemNode('manager-review', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'FINANCE_MANAGER' },
        allowedOutcomes: ['APPROVE', 'REJECT', 'ESCALATE'],
        title: lit('Review high-risk / high-value refund request'),
        input: { type: 'OBJECT', fields: { amount: { type: 'EXPRESSION', expression: workflowInputPath(['amount']) }, riskLevel: { type: 'EXPRESSION', expression: workflowVariable('riskLevel') } } },
        escalationPolicy: {
          steps: [
            { key: 'raise-priority', trigger: { type: 'AFTER_OPEN_MS', afterMs: 4 * 60 * 60 * 1000 }, action: { type: 'RAISE_PRIORITY', priority: 5 }, maxExecutions: 1 },
            { key: 'reassign-senior', trigger: { type: 'AFTER_OPEN_MS', afterMs: 24 * 60 * 60 * 1000 }, action: { type: 'REASSIGN_ROLE', roleId: 'SENIOR_FINANCE_MANAGER' }, maxExecutions: 1 },
          ],
        },
      }),
      waitEventNode('we-escalation', {
        eventName: 'finance.manager.decision',
        correlation: workflowInputPath(['requestId']),
        timeout: { afterMs: lit(3 * 24 * 60 * 60 * 1000), outcomeKey: 'timedOut' },
      }),
      decisionNode('d-escalation-approved', 'EXACT_ONE'),
      subflowNode('sf-process-refund', { workflowDefinitionRef: { workflowDefinitionKey: 'process-refund-payment' }, input: { type: 'OBJECT', fields: { amount: { type: 'EXPRESSION', expression: workflowInputPath(['amount']) } } } }),
      delayNode('delay-settlement', { type: 'DURATION_MS', value: lit(60_000) }),
      actionNode('notify-approved', { actionRef: ACTION('text.template'), input: templateInput('Your refund of {{amount}} has been approved and is settling.', { amount: workflowInputPath(['amount']) }) , retryPolicy: NO_RETRY }),
      actionNode('notify-rejected', { actionRef: ACTION('text.template'), input: templateInput('Your refund request was rejected.', {}) , retryPolicy: NO_RETRY }),
      endNode('end-approved', { type: 'OBJECT', fields: { outcome: { type: 'EXPRESSION', expression: lit('REFUND_SETTLING') } } }),
      endNode('end-rejected', { type: 'OBJECT', fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } } }),
      failNode('fail-sla-breach', lit('WF_ESCALATION_SLA_BREACHED'), lit('Finance manager did not respond within the 3-day SLA.')),
    ],
    edges: [
      unconditionalEdge('e-classify-switch', 'classify-risk', 'sw-risk'),
      switchCaseEdge('e-sw-low', 'sw-risk', 'ps-verify', 'LOW'),
      switchCaseEdge('e-sw-medium', 'sw-risk', 'ps-verify', 'MEDIUM'),
      switchDefaultEdge('e-sw-high', 'sw-risk', 'manager-review'),
      unconditionalEdge('e-split-history', 'ps-verify', 'check-payment-history'),
      unconditionalEdge('e-split-summarize', 'ps-verify', 'summarize-notes'),
      unconditionalEdge('e-history-join', 'check-payment-history', 'pj-verify'),
      unconditionalEdge('e-summarize-join', 'summarize-notes', 'pj-verify'),
      unconditionalEdge('e-join-amount', 'pj-verify', 'd-amount'),
      decisionEdge('e-amount-auto', 'd-amount', 'sf-process-refund', { op: 'LTE', left: workflowInputPath(['amount']), right: lit(1000) }),
      decisionDefaultEdge('e-amount-manual', 'd-amount', 'manager-review'),
      workItemOutcomeEdge('e-review-approve', 'manager-review', 'sf-process-refund', 'APPROVE'),
      workItemOutcomeEdge('e-review-reject', 'manager-review', 'notify-rejected', 'REJECT'),
      workItemOutcomeEdge('e-review-escalate', 'manager-review', 'we-escalation', 'ESCALATE'),
      unconditionalEdge('e-escalation-decision', 'we-escalation', 'd-escalation-approved'),
      waitTimeoutEdge('e-escalation-timeout', 'we-escalation', 'fail-sla-breach', 'timedOut'),
      decisionEdge('e-escalation-approved', 'd-escalation-approved', 'sf-process-refund', { op: 'EQ', left: nodeOutput('we-escalation', ['approved']), right: lit(true) }),
      decisionDefaultEdge('e-escalation-rejected', 'd-escalation-approved', 'notify-rejected'),
      unconditionalEdge('e-subflow-delay', 'sf-process-refund', 'delay-settlement'),
      unconditionalEdge('e-delay-notify', 'delay-settlement', 'notify-approved'),
      unconditionalEdge('e-notify-end', 'notify-approved', 'end-approved'),
      unconditionalEdge('e-rejected-end', 'notify-rejected', 'end-rejected'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'classify-risk' },
    variables: [{ key: 'riskLevel', schema: { type: 'INLINE', schema: {} } }],
    policies: {
      recoveryDetectionBoundMs: 1,
      limits: {
        maxNodes: 100, maxEdges: 100, maxPayloadBytes: 1_000_000, maxJsonDepth: 30, maxExpressionNodes: 500, maxStructuralPathCandidates: 1000,
        maxDelayMs: 86_400_000,
        maxWaitTimeoutMs: 7 * 24 * 60 * 60 * 1000, // escalation waits up to 3 days in this example — above the fixture default's 1-day limit
        maxWorkItemTitleLength: 200,
      },
    },
  });
}

async function runLeaveRequestLiveDemo(definitionId: number) {
  const adminRole = await prisma().baseUserRole.findFirst({ where: { roleName: 'ADMIN' } });
  if (!adminRole) throw new Error('No ADMIN user found to run the demo as.');
  const adminUserId = Number(adminRole.userId);

  const definition = (await getWorkflowDefinitionById(definitionId))!;
  console.log('[seed] starting a real live instance of employee-leave-request (5-day request -> manager approval path)…');
  const { instance, nodeInstances } = await startWorkflowInstance({
    workflowRevisionId: definition.currentPublishedRevisionId!,
    input: { startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-06T00:00:00.000Z' },
    startedByType: 'USER',
    startedById: adminUserId,
  });
  console.log(`[seed] instance #${instance.id} started, status=${instance.status}.`);

  const compute = nodeInstances.find((n) => n.semanticNodeKey === 'compute-days')!;
  await dispatchNode({ nodeInstanceId: compute.id, leaseOwnerId: 'seed-script' });

  const afterCompute = await listNodeInstancesForInstance(instance.id);
  const decision = afterCompute.find((n) => n.semanticNodeKey === 'd-auto-or-manager')!;
  await dispatchNode({ nodeInstanceId: decision.id, leaseOwnerId: 'seed-script' });

  const afterDecision = await listNodeInstancesForInstance(instance.id);
  const workItemNodeInstance = afterDecision.find((n) => n.semanticNodeKey === 'manager-approval');
  if (workItemNodeInstance && workItemNodeInstance.status === 'READY') {
    await dispatchNode({ nodeInstanceId: workItemNodeInstance.id, leaseOwnerId: 'seed-script' });
    const item = await getWorkItemByNodeInstance(workItemNodeInstance.id);
    if (item) {
      await claimWorkItem({ workItemId: item.id, actorUserId: adminUserId });
      await completeWorkItem({ workItemId: item.id, actorUserId: adminUserId, outcome: 'APPROVE', output: null });
      console.log('[seed] manager approved the demo leave request — the background engine worker (or the next manual dispatch) will carry it to end-approved.');
    }
  }
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();

  const child = await ensureDefinition('process-refund-payment', buildRefundChildModel());
  await ensureDefinition('ai-assisted-refund-review', buildRefundReviewModel());
  const leaveRequest = await ensureDefinition('employee-leave-request', buildLeaveRequestModel());

  const existingInstance = await prisma().workflowInstance.findFirst({ where: { revision: { workflowDefinitionId: leaveRequest.id } } });
  if (existingInstance) {
    console.log('[seed] a demo instance already exists for employee-leave-request — skipping (this script is meant to seed one, not one per run).');
  } else {
    try {
      await runLeaveRequestLiveDemo(leaveRequest.id);
    } catch (error) {
      console.log('[seed] live demo instance step skipped/failed (definition itself is still published and usable):', error instanceof Error ? error.message : error);
    }
  }

  console.log('[seed] done. Open Workflows in the app to explore "employee-leave-request" and "ai-assisted-refund-review" (Simulate tab for the latter), then use the 360° view to inspect the live instance.');
  console.log(`[seed] child definition id for reference: ${child.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
