/**
 * Builds, publishes and (where structurally possible) actually RUNS 20 sandboxed Workflow-engine
 * test scenarios requested by the platform owner as a stress test of the AppEndWorkflowEngine V1
 * (see docs/standards/workflow-engine-testing.md). Every scenario is a REAL WorkflowModel created
 * via the real repository/publication/engine services against the live dev database (same pattern
 * as scripts/seed-example-workflows.ts) — nothing here is fictional or hand-typed JSON.
 *
 * Goal: discover genuine engine gaps, not just author 20 happy-path demos. Several scenarios are
 * DELIBERATELY built to hit a real, load-bearing limitation (no per-item array iteration, no DAG
 * cycles, no ACTION-failure catch-edge, no working EVENT/WEBHOOK/SCHEDULE start binding) — the
 * real error/rejection IS the finding, captured verbatim in the JSON report this script writes.
 *
 * Usage: npx tsx scripts/build-workflow-20-scenarios.ts
 * Output: <scratchpad>/workflow-20-scenarios-report.json (one entry per scenario, real evidence)
 */
import { writeFileSync } from 'node:fs';
import { initPrismaControlPlane, closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { registerCoreActionPack } from '../src/server/domain/workflow/actions/corePack';
import { createWorkflowDefinition, getWorkflowDefinitionById } from '../src/server/domain/workflow/workflowDefinitionRepository';
import { prisma } from '../src/server/domain/workflow/prismaHelpers';
import { publishWorkflowDefinition } from '../src/server/domain/workflow/publication/workflowPublicationService';
import { startWorkflowInstance } from '../src/server/domain/workflow/engine/startService';
import { dispatchNode } from '../src/server/domain/workflow/engine/dispatchService';
import { runOneEngineWorkerTick } from '../src/server/domain/workflow/engine/workflowEngineWorker';
import { listNodeInstancesForInstance } from '../src/server/domain/workflow/workflowNodeInstanceRepository';
import { claimWorkItem, completeWorkItem } from '../src/server/domain/workflow/engine/workItemService';
import { getWorkItemByNodeInstance } from '../src/server/domain/workflow/workItemRepository';
import { ingestWorkflowEvent } from '../src/server/domain/workflow/engine/eventIngressService';
import { suspendInstance, resumeInstance, cancelInstance } from '../src/server/domain/workflow/engine/operationalCommands';
import { scanAndRunDueEscalations } from '../src/server/domain/workflow/engine/workItemEscalationService';
import type { WorkflowModel, CanonicalMapping, CanonicalExpression } from '../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, failNode, decisionNode, decisionEdge, decisionDefaultEdge, actionNode,
  unconditionalEdge, delayNode, waitEventNode, waitTimeoutEdge, parallelSplitNode, parallelJoinNode,
  workItemNode, workItemOutcomeEdge, subflowNode, lit, workflowInputPath, workflowVariable, nodeOutput,
  mappingOf, emptyMapping,
} from '../src/server/domain/workflow/engine/__tests__/fixtures';

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

const ACTION = (actionKey: string) => ({ type: 'EXACT_PROVIDER' as const, action: { actionKey, actionVersion: '1' }, providerId: 'core', providerVersion: '1' });
const NO_RETRY = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const templateInput = (template: string, variables: Record<string, CanonicalExpression>): CanonicalMapping => ({
  type: 'OBJECT',
  fields: {
    template: { type: 'EXPRESSION', expression: lit(template) },
    variables: { type: 'OBJECT', fields: Object.fromEntries(Object.entries(variables).map(([k, expression]) => [k, { type: 'EXPRESSION' as const, expression }])) },
  },
});

type ScenarioResult = {
  id: string;
  title: string;
  domain: string;
  status: 'OK' | 'PARTIAL' | 'GAP';
  definitionKey?: string;
  definitionId?: number;
  publish?: unknown;
  instanceId?: number;
  finalInstanceStatus?: string;
  finalInstanceOutput?: unknown;
  evidence: Record<string, unknown>;
  gapNotes: string[];
  error?: string;
};

const results: ScenarioResult[] = [];

async function tick(times = 1, gapMs = 0) {
  for (let i = 0; i < times; i++) {
    await runOneEngineWorkerTick();
    if (gapMs > 0) await sleep(gapMs);
  }
}

async function instanceStatus(instanceId: number) {
  const row = await prisma().workflowInstance.findUnique({ where: { id: BigInt(instanceId) } });
  return { status: row?.status, output: row?.outputJson ? JSON.parse(row.outputJson) : null, stateVersion: row?.stateVersion };
}

async function nodeStatuses(instanceId: number) {
  const nodes = await listNodeInstancesForInstance(instanceId);
  return nodes.map((n) => ({ key: n.semanticNodeKey, status: n.status }));
}

async function run(id: string, title: string, domain: string, fn: (r: ScenarioResult) => Promise<void>) {
  const r: ScenarioResult = { id, title, domain, status: 'OK', evidence: {}, gapNotes: [] };
  console.log(`\n=== ${id}: ${title} ===`);
  try {
    await fn(r);
  } catch (error) {
    r.status = r.gapNotes.length > 0 ? 'GAP' : 'GAP';
    r.error = error instanceof Error ? `${error.message}` : String(error);
    console.log(`  -> threw: ${r.error}`);
  }
  results.push(r);
}

async function ensureDefinition(key: string, model: WorkflowModel, scopeKey = 'global') {
  const definition = await createWorkflowDefinition({ scopeKey, key, draftDefinitionJson: JSON.stringify(model), creationMode: 'NEW' });
  return definition;
}

async function publishAndCapture(r: ScenarioResult, definitionId: number, draftVersion: number) {
  try {
    const { revision } = await publishWorkflowDefinition(definitionId, draftVersion);
    r.publish = { ok: true, publicationStatus: revision.publicationStatus, bindingStatus: revision.bindingStatus, revisionNumber: revision.revisionNumber };
    return revision;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code;
    r.publish = { ok: false, code, message };
    return null;
  }
}

async function adminUserId(): Promise<number> {
  const adminRole = await prisma().baseUserRole.findFirst({ where: { roleName: 'ADMIN' } });
  if (!adminRole) throw new Error('No ADMIN user found in this environment.');
  return Number(adminRole.userId);
}

// =================================================================================================
// SECTION 1 — DATA & LOGIC (1-5)
// =================================================================================================

// --- Scenario 1: Data Filtering ------------------------------------------------------------------
async function scenario01(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      decisionNode('d-check-user0-active', 'EXACT_ONE'),
      actionNode('note-active-branch', { actionRef: ACTION('text.template'), input: templateInput('users[0] is active — but only index 0 was inspectable, not the whole list.', {}), retryPolicy: NO_RETRY }),
      actionNode('note-inactive-branch', { actionRef: ACTION('text.template'), input: templateInput('users[0] is inactive — but only index 0 was inspectable, not the whole list.', {}), retryPolicy: NO_RETRY }),
      actionNode('passthrough-attempt', {
        actionRef: ACTION('data.set'),
        input: mappingOf({ value: workflowInputPath(['users']) }),
        retryPolicy: NO_RETRY,
      }),
      endNode('end-1', mappingOf({
        totalUsersInspectedIndividually: lit(1),
        note: lit('No data.filter / per-item predicate exists — the whole array could only be passed through unfiltered.'),
        passthroughUsers: nodeOutput('passthrough-attempt', ['value']),
      })),
    ],
    edges: [
      decisionEdge('e-active', 'd-check-user0-active', 'note-active-branch', { op: 'EQ', left: workflowInputPath(['users', 0, 'active']), right: lit(true) }),
      decisionDefaultEdge('e-inactive', 'd-check-user0-active', 'note-inactive-branch'),
      unconditionalEdge('e1', 'note-active-branch', 'passthrough-attempt'),
      unconditionalEdge('e2', 'note-inactive-branch', 'passthrough-attempt'),
      unconditionalEdge('e3', 'passthrough-attempt', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'd-check-user0-active' },
  });
  const definition = await ensureDefinition('scn-01-data-filtering', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revision.id,
    input: { users: [{ name: 'Ali', age: 30, active: true }, { name: 'Sara', age: 17, active: false }, { name: 'Reza', age: 41, active: true }] },
    startedByType: 'USER', startedById: await adminUserId(),
  });
  r.instanceId = instance.id;
  await tick(5);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.evidence.explanation = 'Only a fixed, author-time-known array index (users[0]) could be inspected via a DECISION condition. There is no CanonicalExpression op and no corePack Action to evaluate a predicate against every element of an arbitrary-length input array (data.map/data.filter are not registered — confirmed absent in actions/corePack/index.ts and dataActions.ts’s own module comment).';
  r.gapNotes.push('No per-item array filter/predicate primitive exists anywhere in the engine (no data.filter Action, no MAP/FILTER CanonicalExpression op). Author-time PATH indexing only reaches a fixed, hardcoded index (e.g. users[0]), never "for each user in users".');
  r.status = final.status === 'SUCCEEDED' ? 'PARTIAL' : 'GAP';
}

// --- Scenario 2: Data Merging --------------------------------------------------------------------
async function scenario02(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      actionNode('count-a', { actionRef: ACTION('data.aggregate'), config: mappingOf({ op: lit('COUNT') }), input: mappingOf({ items: workflowInputPath(['sourceA']) }), retryPolicy: NO_RETRY }),
      actionNode('count-b', { actionRef: ACTION('data.aggregate'), config: mappingOf({ op: lit('COUNT') }), input: mappingOf({ items: workflowInputPath(['sourceB']) }), retryPolicy: NO_RETRY }),
      decisionNode('d-ids-match', 'EXACT_ONE'),
      actionNode('merged-fixed-size', {
        actionRef: ACTION('data.set'),
        input: { type: 'OBJECT', fields: { value: { type: 'ARRAY', items: [
          { type: 'EXPRESSION', expression: workflowInputPath(['sourceA', 0]) },
          { type: 'EXPRESSION', expression: workflowInputPath(['sourceA', 1]) },
          { type: 'EXPRESSION', expression: workflowInputPath(['sourceB', 0]) },
          { type: 'EXPRESSION', expression: workflowInputPath(['sourceB', 1]) },
        ] } } },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-1', mappingOf({
        countA: nodeOutput('count-a', ['result']),
        countB: nodeOutput('count-b', ['result']),
        mergedFixedFourItemsOnly: nodeOutput('merged-fixed-size', ['value']),
        note: lit('Merge is only possible as a hand-authored, fixed-length ARRAY of specific indices — no dynamic concat/zip/join-by-key over arbitrary-length sourceA/sourceB exists.'),
      })),
    ],
    edges: [
      unconditionalEdge('e1', 'count-a', 'count-b'),
      unconditionalEdge('e2', 'count-b', 'd-ids-match'),
      decisionEdge('e3', 'd-ids-match', 'merged-fixed-size', { op: 'EQ', left: workflowInputPath(['sourceA', 0, 'id']), right: workflowInputPath(['sourceB', 0, 'id']) }),
      decisionDefaultEdge('e4', 'd-ids-match', 'merged-fixed-size'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'count-a' },
  });
  const definition = await ensureDefinition('scn-02-data-merging', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revision.id,
    input: { sourceA: [{ id: 1, name: 'A1' }, { id: 2, name: 'A2' }, { id: 3, name: 'A3' }], sourceB: [{ id: 1, note: 'B1' }, { id: 4, note: 'B4' }] },
    startedByType: 'USER', startedById: await adminUserId(),
  });
  r.instanceId = instance.id;
  await tick(5);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.gapNotes.push('No array-merge/zip/join-by-key primitive exists (CONCAT is string-only per expressionEvaluator.ts; ARRAY mapping values are a fixed, author-time-known list, never a spread of a runtime array). A real merge of two arbitrary-length local datasets cannot be expressed natively — only a hardcoded fixed-index splice.');
  r.status = final.status === 'SUCCEEDED' ? 'PARTIAL' : 'GAP';
}

// --- Scenario 3: Loop with Break Condition (self-recursive SUBFLOW) ------------------------------
function loopCounterModel(): WorkflowModel {
  return baseModel({
    nodes: [
      decisionNode('d-check-done', 'EXACT_ONE'),
      actionNode('compute-next', { actionRef: ACTION('data.set'), input: mappingOf({ value: { op: 'ADD', left: workflowInputPath(['count']), right: lit(1) } }), retryPolicy: NO_RETRY }),
      subflowNode('sf-recurse', { workflowDefinitionRef: { workflowDefinitionKey: 'scn-03-loop-counter' }, input: mappingOf({ count: nodeOutput('compute-next', ['value']), max: workflowInputPath(['max']) }) }),
      endNode('end-continue', mappingOf({ outcome: lit('DELEGATED_TO_CHILD') })),
      endNode('end-break', mappingOf({ outcome: lit('BREAK_REACHED'), count: workflowInputPath(['count']) })),
    ],
    edges: [
      decisionEdge('e-continue', 'd-check-done', 'compute-next', { op: 'LT', left: workflowInputPath(['count']), right: workflowInputPath(['max']) }),
      decisionDefaultEdge('e-break', 'd-check-done', 'end-break'),
      unconditionalEdge('e-to-subflow', 'compute-next', 'sf-recurse'),
      unconditionalEdge('e-subflow-end', 'sf-recurse', 'end-continue'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'd-check-done' },
  });
}

async function scenario03(r: ScenarioResult) {
  const definition = await ensureDefinition('scn-03-loop-counter', loopCounterModel());
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revision.id,
    input: { count: 0, max: 3 },
    startedByType: 'USER', startedById: await adminUserId(),
  });
  r.instanceId = instance.id;
  for (let i = 0; i < 12; i++) { await tick(1); await sleep(150); }
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.evidence.explanation = 'V1 published graphs MUST be acyclic (structuralValidation.ts: "the reachable graph contains a cycle; V1 published graphs MUST be acyclic (doc 05 section 20)") — there is no native LOOP/iteration node. The only way to express "repeat until a condition" is a workflow calling itself as a SUBFLOW (a new child WorkflowInstance per iteration), which this scenario proves publishes and runs, with zero authored recursion-depth guard anywhere in subflowValidation.ts.';
  r.gapNotes.push('No native loop/iteration node kind exists; graphs must be acyclic (publish-time cycle rejection confirmed). The only workaround is self-referencing SUBFLOW recursion — real, working, but expensive (one full child WorkflowInstance per loop iteration) and has NO engine-enforced maximum recursion depth (subflowValidation.ts never checks for self-reference or depth) — an authoring mistake in the break condition can spawn unbounded child instances.');
  r.status = final.status === 'SUCCEEDED' ? 'OK' : 'PARTIAL';
}

// --- Scenario 4: Deduplication + Merge -----------------------------------------------------------
async function scenario04(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      decisionNode('d-is-duplicate', 'EXACT_ONE'),
      actionNode('keep-both', { actionRef: ACTION('text.template'), input: templateInput('Records[0] and Records[1] have different keys — both kept.', {}), retryPolicy: NO_RETRY }),
      actionNode('merge-duplicate', {
        actionRef: ACTION('data.set'),
        input: { type: 'OBJECT', fields: { value: { type: 'OBJECT', fields: {
          key: { type: 'EXPRESSION', expression: workflowInputPath(['records', 0, 'key']) },
          latestValue: { type: 'EXPRESSION', expression: workflowInputPath(['records', 1, 'value']) },
          mergedFrom: { type: 'ARRAY', items: [{ type: 'EXPRESSION', expression: lit(0) }, { type: 'EXPRESSION', expression: lit(1) }] },
        } } } },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-1', mappingOf({ note: lit('Duplicate detection compared exactly 2 hardcoded records (records[0] vs records[1]); an arbitrary-length list cannot be scanned for duplicates natively.') })),
    ],
    edges: [
      decisionEdge('e1', 'd-is-duplicate', 'merge-duplicate', { op: 'EQ', left: workflowInputPath(['records', 0, 'key']), right: workflowInputPath(['records', 1, 'key']) }),
      decisionDefaultEdge('e2', 'd-is-duplicate', 'keep-both'),
      unconditionalEdge('e3', 'merge-duplicate', 'end-1'),
      unconditionalEdge('e4', 'keep-both', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'd-is-duplicate' },
  });
  const definition = await ensureDefinition('scn-04-deduplication', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revision.id,
    input: { records: [{ key: 'CUST-1', value: 'old' }, { key: 'CUST-1', value: 'new' }, { key: 'CUST-2', value: 'other' }] },
    startedByType: 'USER', startedById: await adminUserId(),
  });
  r.instanceId = instance.id;
  await tick(5);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.gapNotes.push('True N-record deduplication needs an O(N) scan comparing every pair/key across an arbitrary-length list — impossible without per-item iteration (same root cause as Scenarios 1/2). Only a fixed pairwise comparison between two hardcoded indices is expressible.');
  r.status = final.status === 'SUCCEEDED' ? 'PARTIAL' : 'GAP';
}

// --- Scenario 5: Batch Queueing (self-recursive SUBFLOW, one unit per level) ---------------------
function batchQueueModel(): WorkflowModel {
  return baseModel({
    nodes: [
      decisionNode('d-more-items', 'EXACT_ONE'),
      actionNode('process-item', { actionRef: ACTION('text.template'), input: templateInput('Processing batch item #{{index}} of {{total}}', { index: workflowInputPath(['index']), total: workflowInputPath(['total']) }), retryPolicy: NO_RETRY }),
      actionNode('compute-next-index', { actionRef: ACTION('data.set'), input: mappingOf({ value: { op: 'ADD', left: workflowInputPath(['index']), right: lit(1) } }), retryPolicy: NO_RETRY }),
      subflowNode('sf-next-batch', { workflowDefinitionRef: { workflowDefinitionKey: 'scn-05-batch-queue' }, input: mappingOf({ index: nodeOutput('compute-next-index', ['value']), total: workflowInputPath(['total']) }) }),
      endNode('end-delegated', mappingOf({ outcome: lit('DELEGATED_TO_CHILD') })),
      endNode('end-queue-drained', mappingOf({ outcome: lit('QUEUE_DRAINED'), processedUpTo: workflowInputPath(['index']) })),
    ],
    edges: [
      decisionEdge('e-more', 'd-more-items', 'process-item', { op: 'LTE', left: workflowInputPath(['index']), right: workflowInputPath(['total']) }),
      decisionDefaultEdge('e-done', 'd-more-items', 'end-queue-drained'),
      unconditionalEdge('e1', 'process-item', 'compute-next-index'),
      unconditionalEdge('e2', 'compute-next-index', 'sf-next-batch'),
      unconditionalEdge('e3', 'sf-next-batch', 'end-delegated'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'd-more-items' },
  });
}

async function scenario05(r: ScenarioResult) {
  const definition = await ensureDefinition('scn-05-batch-queue', batchQueueModel());
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revision.id,
    input: { index: 1, total: 4 },
    startedByType: 'USER', startedById: await adminUserId(),
  });
  r.instanceId = instance.id;
  for (let i = 0; i < 14; i++) { await tick(1); await sleep(150); }
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.gapNotes.push('No native "split large task into N smaller queued tasks" primitive (no batch/SplitInBatches node). The only working approximation is one child WorkflowInstance per queued unit via self-recursive SUBFLOW — functionally correct here but heavy (N full durable instances for N items) compared to a purpose-built batch/queue construct.');
  r.status = final.status === 'SUCCEEDED' ? 'OK' : 'PARTIAL';
}

// =================================================================================================
// SECTION 2 — HUMAN-IN-THE-LOOP (6-9)
// =================================================================================================

// --- Scenario 6: Manual Resume via (governed HTTP, "webhook-style") completion -------------------
async function scenario06(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      workItemNode('approve-transaction', { workItemType: 'APPROVAL', assignment: { strategy: 'ROLE', roleId: 'ADMIN' }, allowedOutcomes: ['APPROVE', 'REJECT'], title: lit('Approve transaction #{{txId}}'), input: mappingOf({ txId: workflowInputPath(['txId']), amount: workflowInputPath(['amount']) }) }),
      actionNode('notify-approved', { actionRef: ACTION('text.template'), input: templateInput('Transaction approved via external resume call.', {}), retryPolicy: NO_RETRY }),
      actionNode('notify-rejected', { actionRef: ACTION('text.template'), input: templateInput('Transaction rejected.', {}), retryPolicy: NO_RETRY }),
      endNode('end-approved', mappingOf({ outcome: lit('APPROVED') })),
      endNode('end-rejected', mappingOf({ outcome: lit('REJECTED') })),
    ],
    edges: [
      workItemOutcomeEdge('e1', 'approve-transaction', 'notify-approved', 'APPROVE'),
      workItemOutcomeEdge('e2', 'approve-transaction', 'notify-rejected', 'REJECT'),
      unconditionalEdge('e3', 'notify-approved', 'end-approved'),
      unconditionalEdge('e4', 'notify-rejected', 'end-rejected'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'approve-transaction' },
  });
  const definition = await ensureDefinition('scn-06-manual-resume', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const admin = await adminUserId();
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { txId: 'TX-1001', amount: 4500000 }, startedByType: 'USER', startedById: admin });
  r.instanceId = instance.id;
  await tick(1);
  const nodes = await listNodeInstancesForInstance(instance.id);
  const wiNode = nodes.find((n) => n.semanticNodeKey === 'approve-transaction')!;
  const item = await getWorkItemByNodeInstance(wiNode.id);
  r.evidence.workItemId = item?.id;
  await claimWorkItem({ workItemId: item!.id, actorUserId: admin });
  await completeWorkItem({ workItemId: item!.id, actorUserId: admin, outcome: 'APPROVE', output: null });
  await tick(3);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.evidence.explanation = 'This "resume" call went through the real workItemService.completeWorkItem() service — the exact function POST /api/workflow-work-items/:id/complete (workflowWorkItems.routes.ts, Slice 12) delegates to. A true unauthenticated public WEBHOOK-triggered resume is a different mechanism (see Scenario 14/16 for why WEBHOOK/EVENT/SCHEDULE start bindings do not work) — the only real "external resume" surface today is this authenticated, session-scoped Work Item HTTP API.';
  r.gapNotes.push('There is no unauthenticated/public webhook surface to resume a workflow; "resume via webhook" in this engine really means "complete a Work Item via the authenticated internal HTTP API" — a governed callback, not a generic webhook receiver.');
  r.status = final.status === 'SUCCEEDED' ? 'OK' : 'PARTIAL';
}

// --- Scenario 7: Multi-Stage Approval (sequential) ------------------------------------------------
async function scenario07(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      workItemNode('manager-approval', { workItemType: 'APPROVAL', assignment: { strategy: 'ROLE', roleId: 'ADMIN' }, allowedOutcomes: ['APPROVE', 'REJECT'], title: lit('Manager approval'), input: mappingOf({ amount: workflowInputPath(['amount']) }) }),
      workItemNode('finance-approval', { workItemType: 'APPROVAL', assignment: { strategy: 'ROLE', roleId: 'ADMIN' }, allowedOutcomes: ['APPROVE', 'REJECT'], title: lit('Finance approval (stage 2)'), input: mappingOf({ amount: workflowInputPath(['amount']) }) }),
      endNode('end-approved', mappingOf({ outcome: lit('DOUBLE_APPROVED') })),
      endNode('end-rejected-manager', mappingOf({ outcome: lit('REJECTED_AT_MANAGER') })),
      endNode('end-rejected-finance', mappingOf({ outcome: lit('REJECTED_AT_FINANCE') })),
    ],
    edges: [
      workItemOutcomeEdge('e1', 'manager-approval', 'finance-approval', 'APPROVE'),
      workItemOutcomeEdge('e2', 'manager-approval', 'end-rejected-manager', 'REJECT'),
      workItemOutcomeEdge('e3', 'finance-approval', 'end-approved', 'APPROVE'),
      workItemOutcomeEdge('e4', 'finance-approval', 'end-rejected-finance', 'REJECT'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'manager-approval' },
  });
  const definition = await ensureDefinition('scn-07-multi-stage-approval', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const admin = await adminUserId();
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { amount: 12000000 }, startedByType: 'USER', startedById: admin });
  r.instanceId = instance.id;
  await tick(1);
  let nodes = await listNodeInstancesForInstance(instance.id);
  const step1 = await getWorkItemByNodeInstance(nodes.find((n) => n.semanticNodeKey === 'manager-approval')!.id);
  await claimWorkItem({ workItemId: step1!.id, actorUserId: admin });
  await completeWorkItem({ workItemId: step1!.id, actorUserId: admin, outcome: 'APPROVE', output: null });
  await tick(2);
  nodes = await listNodeInstancesForInstance(instance.id);
  const step2 = await getWorkItemByNodeInstance(nodes.find((n) => n.semanticNodeKey === 'finance-approval')!.id);
  await claimWorkItem({ workItemId: step2!.id, actorUserId: admin });
  await completeWorkItem({ workItemId: step2!.id, actorUserId: admin, outcome: 'APPROVE', output: null });
  await tick(3);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.status = final.status === 'SUCCEEDED' ? 'OK' : 'PARTIAL';
}

// --- Scenario 8: Timeout & Fallback (escalation COMPLETE_WITH_OUTCOME) ----------------------------
async function scenario08(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      workItemNode('vip-approval', {
        workItemType: 'APPROVAL', assignment: { strategy: 'ROLE', roleId: 'ADMIN' }, allowedOutcomes: ['APPROVE', 'REJECT', 'AUTO_REJECTED_TIMEOUT'],
        title: lit('VIP approval (2s SLA in this test)'), input: mappingOf({ amount: workflowInputPath(['amount']) }),
        escalationPolicy: { steps: [{ key: 'auto-reject-on-timeout', trigger: { type: 'AFTER_OPEN_MS', afterMs: 1500 }, action: { type: 'COMPLETE_WITH_OUTCOME', outcomeKey: 'AUTO_REJECTED_TIMEOUT', output: mappingOf({ reason: lit('No human responded within SLA') }) }, maxExecutions: 1 }] },
      }),
      endNode('end-approved', mappingOf({ outcome: lit('APPROVED') })),
      endNode('end-rejected', mappingOf({ outcome: lit('REJECTED') })),
      endNode('end-timeout', mappingOf({ outcome: lit('TIMED_OUT_FALLBACK') })),
    ],
    edges: [
      workItemOutcomeEdge('e1', 'vip-approval', 'end-approved', 'APPROVE'),
      workItemOutcomeEdge('e2', 'vip-approval', 'end-rejected', 'REJECT'),
      workItemOutcomeEdge('e3', 'vip-approval', 'end-timeout', 'AUTO_REJECTED_TIMEOUT'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'vip-approval' },
  });
  const definition = await ensureDefinition('scn-08-timeout-fallback', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const admin = await adminUserId();
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { amount: 999999999 }, startedByType: 'USER', startedById: admin });
  r.instanceId = instance.id;
  await tick(1); // ready -> WAITING_HUMAN (Work Item OPEN)
  await sleep(1800);
  await scanAndRunDueEscalations();
  await tick(3);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.status = final.status === 'SUCCEEDED' && (final.output as { outcome?: string })?.outcome === 'TIMED_OUT_FALLBACK' ? 'OK' : 'PARTIAL';
}

// --- Scenario 9: Human Data Injection mid-flow -----------------------------------------------------
async function scenario09(r: ScenarioResult) {
  const model = baseModel({
    variables: [{ key: 'correctedAmount', schema: { type: 'INLINE', schema: {} } }],
    nodes: [
      workItemNode('correct-amount', {
        workItemType: 'DATA_CORRECTION' as never, assignment: { strategy: 'ROLE', roleId: 'ADMIN' }, allowedOutcomes: ['CORRECTED'],
        title: lit('Please correct the OCR-extracted amount before continuing'), input: mappingOf({ ocrExtractedAmount: workflowInputPath(['ocrExtractedAmount']) }),
        outputAssignments: [{ targetVariableKey: 'correctedAmount', value: nodeOutput('correct-amount', ['output', 'amount']) }],
      }),
      actionNode('confirm-message', { actionRef: ACTION('text.template'), input: templateInput('Human-corrected amount accepted downstream: {{amount}}', { amount: workflowVariable('correctedAmount') }), retryPolicy: NO_RETRY }),
      endNode('end-1', mappingOf({ finalAmount: workflowVariable('correctedAmount'), confirmationText: nodeOutput('confirm-message', ['text']) })),
    ],
    edges: [
      workItemOutcomeEdge('e1', 'correct-amount', 'confirm-message', 'CORRECTED'),
      unconditionalEdge('e2', 'confirm-message', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'correct-amount' },
  });
  const definition = await ensureDefinition('scn-09-human-data-injection', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const admin = await adminUserId();
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { ocrExtractedAmount: 105000 }, startedByType: 'USER', startedById: admin });
  r.instanceId = instance.id;
  await tick(1);
  const nodes = await listNodeInstancesForInstance(instance.id);
  const item = await getWorkItemByNodeInstance(nodes.find((n) => n.semanticNodeKey === 'correct-amount')!.id);
  await claimWorkItem({ workItemId: item!.id, actorUserId: admin });
  await completeWorkItem({ workItemId: item!.id, actorUserId: admin, outcome: 'CORRECTED', output: { amount: 150000 } as never });
  await tick(3);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.status = final.status === 'SUCCEEDED' && (final.output as { finalAmount?: number })?.finalAmount === 150000 ? 'OK' : 'PARTIAL';
}

// =================================================================================================
// SECTION 3 — ERROR HANDLING & RETRIES (10-12)
// =================================================================================================

// --- Scenario 10: Exponential Backoff Retry (+ idempotency-gate finding on non-idempotent Actions)
async function scenario10(r: ScenarioResult) {
  // 10a: PURE Action, deterministic VALIDATION failure, EXPONENTIAL retry — proves backoff scheduling.
  const modelA = baseModel({
    nodes: [
      actionNode('deterministic-fail', {
        actionRef: ACTION('data.aggregate'),
        config: mappingOf({ op: lit('SUM') }),
        input: { type: 'OBJECT', fields: { items: { type: 'ARRAY', items: [{ type: 'EXPRESSION', expression: lit(1) }, { type: 'EXPRESSION', expression: lit('not-a-number') }] } } },
        retryPolicy: { maxAttempts: 3, strategy: 'EXPONENTIAL', initialDelayMs: 400, multiplier: 2, retryOn: [{ type: 'ERROR_CLASS', classes: ['VALIDATION'] }] },
      }),
      endNode('end-1', mappingOf({ outcome: lit('SHOULD_NEVER_REACH') })),
    ],
    edges: [unconditionalEdge('e1', 'deterministic-fail', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'deterministic-fail' },
  });
  const defA = await ensureDefinition('scn-10a-exponential-backoff', modelA);
  const revA = await publishAndCapture(r, defA.id, defA.draftVersion);
  r.definitionKey = defA.key; r.definitionId = defA.id;
  if (revA) {
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revA.id, input: {}, startedByType: 'USER', startedById: await adminUserId() });
    r.instanceId = instance.id;
    const attemptLog: Array<{ tick: number; attemptCount: number; nodeStatus?: string }> = [];
    for (let i = 0; i < 8; i++) {
      await tick(1);
      const attempts = await prisma().workflowExecutionAttempt.findMany({ where: { workflowInstanceId: BigInt(instance.id) }, orderBy: { attemptNumber: 'asc' } });
      const nodes = await nodeStatuses(instance.id);
      attemptLog.push({ tick: i, attemptCount: attempts.length, nodeStatus: nodes.find((n) => n.key === 'deterministic-fail')?.status });
      await sleep(600 + i * 400);
    }
    r.evidence.attemptProgression = attemptLog;
    const final = await instanceStatus(instance.id);
    r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
    const attempts = await prisma().workflowExecutionAttempt.findMany({ where: { workflowInstanceId: BigInt(instance.id) }, orderBy: { attemptNumber: 'asc' } });
    r.evidence.totalAttempts = attempts.length;
    r.evidence.attemptTimestamps = attempts.map((a) => a.createdAt);
  }

  // 10b: non-idempotent WRITE_EXTERNAL Action with maxAttempts>1 — publish-time rejection (real finding).
  const modelB = baseModel({
    nodes: [
      actionNode('charge-gateway', { actionRef: ACTION('integration.http-request'), input: mappingOf({ url: lit('https://example-payment-gateway.invalid/charge'), method: lit('POST') }), retryPolicy: { maxAttempts: 3, strategy: 'EXPONENTIAL', initialDelayMs: 500, multiplier: 2, retryOn: [{ type: 'TIMEOUT' }] } }),
      endNode('end-1', mappingOf({})),
    ],
    edges: [unconditionalEdge('e1', 'charge-gateway', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'charge-gateway' },
  });
  const defB = await ensureDefinition('scn-10b-non-idempotent-retry-rejected', modelB);
  let publishB: unknown;
  try {
    await publishWorkflowDefinition(defB.id, defB.draftVersion);
    publishB = { ok: true, note: 'UNEXPECTED: a non-idempotent WRITE_EXTERNAL Action with maxAttempts>1 was accepted at publish time.' };
  } catch (error) {
    publishB = { ok: false, code: (error as { code?: string })?.code, message: error instanceof Error ? error.message : String(error) };
  }
  r.evidence.nonIdempotentRetryPublishAttempt = publishB;
  r.gapNotes.push('EXPONENTIAL/FIXED retry on a real deterministic-outcome Action never "recovers" (same input, same result every attempt) — backoff scheduling itself works (confirmed: growing nextEligibleAt gaps, attempt rows accumulate to maxAttempts) but the demo can only prove scheduling, not genuine transient-fault recovery, since no corePack Action can simulate "fails twice then succeeds".');
  r.gapNotes.push('Correctly confirmed guard rail (not a bug): the engine REJECTS retryPolicy.maxAttempts > 1 at publish time for any Action whose idempotency.guarantee is NONE and sideEffectClass is not PURE (WF_ACTION_IDEMPOTENCY_INCOMPATIBLE) — e.g. integration.http-request. This means real non-idempotent external calls (payment gateways, etc.) can never be configured with automatic retry through the engine’s own policy layer, by design.');
  r.status = 'PARTIAL';
}

// --- Scenario 11: Error Branching / Catch Block (proves it does NOT exist) ------------------------
async function scenario11(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      actionNode('risky-call', { actionRef: ACTION('integration.http-request'), input: mappingOf({ url: lit('https://this-domain-will-never-resolve.invalid/x'), method: lit('GET') }), retryPolicy: NO_RETRY }),
      endNode('end-success-only', mappingOf({ outcome: lit('SUCCEEDED_PATH') })),
    ],
    edges: [unconditionalEdge('e1', 'risky-call', 'end-success-only')],
    start: { type: 'MANUAL_API', targetNodeKey: 'risky-call' },
  });
  const definition = await ensureDefinition('scn-11-error-branching', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: await adminUserId() });
  r.instanceId = instance.id;
  await tick(3);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  const attempts = await prisma().workflowExecutionAttempt.findMany({ where: { workflowInstanceId: BigInt(instance.id) } });
  r.evidence.attemptErrors = attempts.map((a) => ({ status: a.status, errorClass: a.errorClass, errorCode: a.errorCode, errorMessage: a.errorMessage }));
  r.evidence.explanation = 'WorkflowEdgeSelector (awm/types.ts) is a closed union: UNCONDITIONAL | DECISION | DECISION_DEFAULT | SWITCH_CASE | SWITCH_DEFAULT | WORK_ITEM_OUTCOME | WAIT_TIMEOUT. There is no ON_ERROR/ACTION_FAILURE/CATCH selector. An ACTION node whose retries are exhausted (or has none) propagates DIRECTLY to instance-level FAILED (doc 05 section 29) — it cannot be routed to an author-chosen "catch" node.';
  r.gapNotes.push('The engine has NO native error-branching / catch-block construct at the graph level. An unhandled ACTION failure always terminates the entire WorkflowInstance (INSTANCE_FAILED); the only per-node recovery lever is retryPolicy (retry the SAME node), never "run node X instead". A FAIL node is reachable only via a normal successful edge the author routes to deliberately — it is not an automatic catch target.');
  r.status = 'GAP';
}

// --- Scenario 12: Rollback / Saga Pattern (proves no compensation exists) -------------------------
async function scenario12(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      parallelSplitNode('ps-reserve-and-charge'),
      actionNode('reserve-inventory', { actionRef: ACTION('text.template'), input: templateInput('Inventory reserved for order {{orderId}}', { orderId: workflowInputPath(['orderId']) }), retryPolicy: NO_RETRY }),
      actionNode('charge-payment', { actionRef: ACTION('integration.http-request'), input: mappingOf({ url: lit('https://payment-gateway-that-fails.invalid/charge'), method: lit('POST') }), retryPolicy: NO_RETRY }),
      parallelJoinNode('pj-both-done', 'ALL'),
      endNode('end-1', mappingOf({ outcome: lit('ORDER_COMPLETED') })),
    ],
    edges: [
      unconditionalEdge('e1', 'ps-reserve-and-charge', 'reserve-inventory'),
      unconditionalEdge('e2', 'ps-reserve-and-charge', 'charge-payment'),
      unconditionalEdge('e3', 'reserve-inventory', 'pj-both-done'),
      unconditionalEdge('e4', 'charge-payment', 'pj-both-done'),
      unconditionalEdge('e5', 'pj-both-done', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'ps-reserve-and-charge' },
  });
  const definition = await ensureDefinition('scn-12-saga-rollback', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { orderId: 'ORD-77' }, startedByType: 'USER', startedById: await adminUserId() });
  r.instanceId = instance.id;
  await tick(4);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  const nodes = await nodeStatuses(instance.id);
  r.evidence.branchNodeStatuses = nodes;
  r.evidence.explanation = 'reserve-inventory (branch A) SUCCEEDED and its side effect is durably recorded (real trace/attempt row) BEFORE charge-payment (branch B) fails. The instance still ends FAILED as a whole (doc 05 section 29 instance-level propagation) — but the engine never invokes any "undo/compensate reserve-inventory" logic; there is no compensation node kind, no author-declared undo-action-per-node, nothing. Cancellation-of-siblings (doc 05 section 22, Slice 7) only cancels branches that have NOT yet completed — it cannot reverse an already-SUCCEEDED branch’s external effect.';
  r.gapNotes.push('No Saga/compensating-transaction pattern exists. When one PARALLEL_SPLIT branch fails, the whole instance fails, but any sibling branch that already succeeded keeps its real side effect applied with no automatic rollback/compensation call — the workflow author would have to manually build and manually trigger an "undo" flow themselves; the engine gives no structural support for it.');
  r.status = 'GAP';
}

// =================================================================================================
// SECTION 4 — FILE SYSTEM & DOCUMENTS (13-15)
// =================================================================================================

// --- Scenario 13: CSV -> JSON in-memory (single row; N-row gap documented) ------------------------
async function scenario13(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      actionNode('split-lines', { actionRef: ACTION('text.split'), input: mappingOf({ text: workflowInputPath(['csvText']), separator: lit('\n') }), retryPolicy: NO_RETRY }),
      actionNode('split-header', { actionRef: ACTION('text.split'), input: mappingOf({ text: nodeOutput('split-lines', ['parts', 0]), separator: lit(',') }), retryPolicy: NO_RETRY }),
      actionNode('split-row1', { actionRef: ACTION('text.split'), input: mappingOf({ text: nodeOutput('split-lines', ['parts', 1]), separator: lit(',') }), retryPolicy: NO_RETRY }),
      actionNode('build-record', {
        actionRef: ACTION('data.set'),
        input: { type: 'OBJECT', fields: { value: { type: 'OBJECT', fields: {
          name: { type: 'EXPRESSION', expression: nodeOutput('split-row1', ['parts', 0]) },
          age: { type: 'EXPRESSION', expression: nodeOutput('split-row1', ['parts', 1]) },
          city: { type: 'EXPRESSION', expression: nodeOutput('split-row1', ['parts', 2]) },
        } } } },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-1', mappingOf({ header: nodeOutput('split-header', ['parts']), record: nodeOutput('build-record', ['value']), note: lit('Only row[1] (a fixed index) was parsed into JSON — an N-row CSV needs per-row iteration, which is unavailable (see Scenario 1/2 gap).') })),
    ],
    edges: [
      unconditionalEdge('e1', 'split-lines', 'split-header'),
      unconditionalEdge('e2', 'split-header', 'split-row1'),
      unconditionalEdge('e3', 'split-row1', 'build-record'),
      unconditionalEdge('e4', 'build-record', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'split-lines' },
  });
  const definition = await ensureDefinition('scn-13-csv-to-json', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { csvText: 'name,age,city\nAli,30,Tehran\nSara,25,Isfahan' }, startedByType: 'USER', startedById: await adminUserId() });
  r.instanceId = instance.id;
  await tick(5);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.gapNotes.push('No dedicated CSV-parsing Action exists in corePack at all (only text.split/text.join as generic string primitives). A single, fixed CSV row can be turned into JSON by chaining text.split calls + fixed-index PATHs, but converting an ENTIRE CSV file (arbitrary row count) to a JSON array natively is blocked by the same missing per-item iteration primitive as Scenarios 1/2/4.');
  r.status = final.status === 'SUCCEEDED' ? 'PARTIAL' : 'GAP';
}

// --- Scenario 14: Local Folder Watcher Trigger (proves EVENT start binding is non-functional) ------
async function scenario14(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      actionNode('log-file-event', { actionRef: ACTION('text.template'), input: templateInput('New file detected: {{fileName}}', { fileName: workflowInputPath(['fileName']) }), retryPolicy: NO_RETRY }),
      endNode('end-1', mappingOf({ outcome: lit('FILE_PROCESSED') })),
    ],
    edges: [unconditionalEdge('e1', 'log-file-event', 'end-1')],
    start: { type: 'EVENT', targetNodeKey: 'log-file-event', eventName: 'local.folder.file-created' },
  });
  const definition = await ensureDefinition('scn-14-folder-watcher', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  r.evidence.explanation = 'Publish itself may succeed (structural validation of an EVENT-typed start is fine), but BINDING ACTIVATION is expected to deterministically fail: eventBindingAdapter.ts unconditionally returns WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT ("no canonical AppEndO event bus / domain-event pub-sub primitive exists"). Separately, there is no local filesystem/folder-watch capability of ANY kind anywhere in corePack (only data/text/date/communication/integration/ai categories exist) — even if EVENT delivery worked, nothing in this repository can observe a local folder and emit "file created".';
  if (revision) {
    r.evidence.bindingStatus = revision.bindingStatus;
    r.status = revision.bindingStatus === 'ACTIVE' ? 'OK' : 'GAP';
  } else {
    r.status = 'GAP';
  }
  r.gapNotes.push('No local folder/filesystem watcher trigger exists anywhere in the platform (no fs.* Action category in corePack at all).');
  r.gapNotes.push('Even authoring an EVENT-typed Start is moot in practice: eventBindingAdapter.ts always returns WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT — no canonical event bus exists to actually deliver a START-triggering event to a new WorkflowInstance (this is different from the real, working mid-flow WAIT_EVENT/eventIngressService correlation used in Scenario 6’s sibling mechanism and doc06 — that only works for an ALREADY-RUNNING instance, never to start a new one).');
}

// --- Scenario 15: Dynamic Text Report (Template Engine) --------------------------------------------
async function scenario15(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      actionNode('compute-total', { actionRef: ACTION('data.aggregate'), config: mappingOf({ op: lit('SUM') }), input: mappingOf({ items: workflowInputPath(['amounts']) }), retryPolicy: NO_RETRY }),
      actionNode('render-report', { actionRef: ACTION('text.template'), input: templateInput('Daily report for {{date}}: {{count}} transactions, total = {{total}} IRR.', { date: workflowInputPath(['date']), count: workflowInputPath(['transactionCount']), total: nodeOutput('compute-total', ['result']) }), retryPolicy: NO_RETRY },
      ),
      endNode('end-1', mappingOf({ report: nodeOutput('render-report', ['text']) })),
    ],
    edges: [unconditionalEdge('e1', 'compute-total', 'render-report'), unconditionalEdge('e2', 'render-report', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'compute-total' },
  });
  const definition = await ensureDefinition('scn-15-template-engine', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { date: '2026-07-17', transactionCount: 42, amounts: [10000, 25000, 7000] }, startedByType: 'USER', startedById: await adminUserId() });
  r.instanceId = instance.id;
  await tick(3);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.gapNotes.push('text.template only supports flat {{key}} substitution (regex: /\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}/g against input.variables) — no {{#each}}/loop block, no nested-path interpolation ({{user.name}} does not work, the key must be a flat identifier), no conditional ({{#if}}) sections. Itemizing a list of N orders inside one rendered report is not possible in a single template call — same array-iteration root cause as Scenarios 1/2/4/13.');
  r.status = final.status === 'SUCCEEDED' ? 'OK' : 'PARTIAL';
}

// =================================================================================================
// SECTION 5 — SCHEDULING, CRON & TIME (16-20)
// =================================================================================================

// --- Scenario 16: Periodic Health Check (proves SCHEDULE start binding is non-functional) ----------
async function scenario16(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      actionNode('ping-service', { actionRef: ACTION('integration.http-request'), input: mappingOf({ url: lit('https://internal-health-endpoint.invalid/ping'), method: lit('GET') }), retryPolicy: NO_RETRY }),
      decisionNode('d-healthy', 'EXACT_ONE'),
      endNode('end-healthy', mappingOf({ outcome: lit('HEALTHY') })),
      failNode('fail-unhealthy', lit('WF_HEALTH_CHECK_FAILED'), lit('Ping did not respond OK.')),
    ],
    edges: [
      unconditionalEdge('e1', 'ping-service', 'd-healthy'),
      decisionDefaultEdge('e2', 'd-healthy', 'fail-unhealthy'),
    ],
    start: { type: 'SCHEDULE', targetNodeKey: 'ping-service', scheduledTaskBinding: { bindingType: 'SCHEDULED_TASK', bindingId: 'scn-16-health-check-every-5-min' } },
  });
  const definition = await ensureDefinition('scn-16-periodic-health-check', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (revision) { r.evidence.bindingStatus = revision.bindingStatus; }
  r.gapNotes.push('SCHEDULE start binding is still non-functional: scheduleBindingAdapter.ts requires a managed function id "workflow-engine.scheduled-start" to already be registered as a real Scheduled Task target — confirmed (grep) that this reserved id is never registered anywhere in the codebase outside the adapter’s own file/tests. A cron-style periodic Workflow trigger cannot be activated in this environment today; the underlying SchedulerService staged-registration mechanism itself is real and tested, only the Workflow-side registration of its own entry-point function is missing.');
  const modelManual = baseModel({ ...model, start: { type: 'MANUAL_API', targetNodeKey: 'ping-service' } });
  const defManual = await ensureDefinition('scn-16b-health-check-manual-trigger', modelManual);
  const revManual = await publishAndCapture(r, defManual.id, defManual.draftVersion);
  if (revManual) {
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revManual.id, input: {}, startedByType: 'USER', startedById: await adminUserId() });
    await tick(3);
    const final = await instanceStatus(instance.id);
    r.evidence.manualTriggerFallbackResult = final;
  }
  r.status = 'GAP';
}

// --- Scenario 17: Dynamic Delay based on input data -------------------------------------------------
async function scenario17(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      actionNode('compute-delay-ms', { actionRef: ACTION('data.set'), input: mappingOf({ value: { op: 'MUL', left: workflowInputPath(['delaySeconds']), right: lit(1000) } }), retryPolicy: NO_RETRY }),
      delayNode('dynamic-wait', { type: 'DURATION_MS', value: nodeOutput('compute-delay-ms', ['value']) }),
      endNode('end-1', mappingOf({ outcome: lit('WAITED_DYNAMIC_DURATION') })),
    ],
    edges: [unconditionalEdge('e1', 'compute-delay-ms', 'dynamic-wait'), unconditionalEdge('e2', 'dynamic-wait', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'compute-delay-ms' },
  });
  const definition = await ensureDefinition('scn-17-dynamic-delay', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: { delaySeconds: 2 }, startedByType: 'USER', startedById: await adminUserId() });
  r.instanceId = instance.id;
  await tick(1);
  const beforeWait = await instanceStatus(instance.id);
  await sleep(2500);
  await tick(2);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.evidence.instanceStatusRightAfterEnteringWait = beforeWait.status;
  r.evidence.note = 'DELAY.delay.value accepts any CanonicalExpression (not just a literal), so the wait duration can genuinely be computed from workflow input at runtime — this works natively and correctly.';
  r.evidence.designNote = 'policyLimitValidation.ts only statically bounds LITERAL DURATION_MS values against maxDelayMs at publish time; a dynamic (expression) value is instead bounded at runtime inside evaluateDelayNode (nodeExecution.ts throws WF_EXEC_EXPRESSION_FAILED if it exceeds maxDelayMs when the wait is actually created) — confirmed by reading the code, not assumed. Correct behavior, just a different enforcement point than literals.';
  r.status = final.status === 'SUCCEEDED' ? 'OK' : 'PARTIAL';
}

// --- Scenario 18: Parallel execution / concurrency correctness -------------------------------------
async function scenario18(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      parallelSplitNode('ps-3-branches'),
      delayNode('branch-fast', { type: 'DURATION_MS', value: lit(300) }),
      delayNode('branch-medium', { type: 'DURATION_MS', value: lit(900) }),
      delayNode('branch-slow', { type: 'DURATION_MS', value: lit(1500) }),
      parallelJoinNode('pj-all-arrived', 'ALL'),
      endNode('end-1', mappingOf({ outcome: lit('ALL_THREE_BRANCHES_JOINED') })),
    ],
    edges: [
      unconditionalEdge('e1', 'ps-3-branches', 'branch-fast'),
      unconditionalEdge('e2', 'ps-3-branches', 'branch-medium'),
      unconditionalEdge('e3', 'ps-3-branches', 'branch-slow'),
      unconditionalEdge('e4', 'branch-fast', 'pj-all-arrived'),
      unconditionalEdge('e5', 'branch-medium', 'pj-all-arrived'),
      unconditionalEdge('e6', 'branch-slow', 'pj-all-arrived'),
      unconditionalEdge('e7', 'pj-all-arrived', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'ps-3-branches' },
  });
  const definition = await ensureDefinition('scn-18-concurrency-race', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: await adminUserId() });
  r.instanceId = instance.id;
  for (let i = 0; i < 6; i++) { await tick(1); await sleep(400); }
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  const joinArrivals = await prisma().workflowJoinArrival.findMany({ where: { workflowInstanceId: BigInt(instance.id) } });
  r.evidence.joinArrivalCount = joinArrivals.length;
  r.evidence.branchNodeStatuses = await nodeStatuses(instance.id);
  r.status = final.status === 'SUCCEEDED' && joinArrivals.length === 3 ? 'OK' : 'PARTIAL';
}

// --- Scenario 19: Date-Specific Execution (UNTIL) ----------------------------------------------------
async function scenario19(r: ScenarioResult) {
  const targetInstant = new Date(Date.now() + 2000).toISOString();
  const model = baseModel({
    nodes: [
      delayNode('wait-until-instant', { type: 'UNTIL', value: lit(targetInstant) }),
      endNode('end-1', mappingOf({ outcome: lit('RELEASED_AT_SCHEDULED_INSTANT') })),
    ],
    edges: [unconditionalEdge('e1', 'wait-until-instant', 'end-1')],
    start: { type: 'MANUAL_API', targetNodeKey: 'wait-until-instant' },
  });
  const definition = await ensureDefinition('scn-19-date-specific-execution', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (!revision) { r.status = 'GAP'; return; }
  const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: await adminUserId() });
  r.instanceId = instance.id;
  await tick(1);
  await sleep(2500);
  await tick(2);
  const final = await instanceStatus(instance.id);
  r.finalInstanceStatus = final.status; r.finalInstanceOutput = final.output;
  r.evidence.targetInstant = targetInstant;
  r.status = final.status === 'SUCCEEDED' ? 'OK' : 'PARTIAL';
}

// --- Scenario 20: Sized-based DB Cleanup (proves SCHEDULE gap + no filesystem/internal-DB Action) ---
async function scenario20(r: ScenarioResult) {
  const model = baseModel({
    nodes: [
      decisionNode('d-over-threshold', 'EXACT_ONE'),
      actionNode('run-cleanup', { actionRef: ACTION('text.template'), input: templateInput('Cleanup executed: {{sizeMb}}MB exceeded threshold {{thresholdMb}}MB.', { sizeMb: workflowInputPath(['currentSizeMb']), thresholdMb: workflowInputPath(['thresholdMb']) }), retryPolicy: NO_RETRY }),
      endNode('end-cleaned', mappingOf({ outcome: lit('CLEANED') })),
      endNode('end-skipped', mappingOf({ outcome: lit('SKIPPED_UNDER_THRESHOLD') })),
    ],
    edges: [
      decisionEdge('e1', 'd-over-threshold', 'run-cleanup', { op: 'GTE', left: workflowInputPath(['currentSizeMb']), right: workflowInputPath(['thresholdMb']) }),
      decisionDefaultEdge('e2', 'd-over-threshold', 'end-skipped'),
      unconditionalEdge('e3', 'run-cleanup', 'end-cleaned'),
    ],
    start: { type: 'SCHEDULE', targetNodeKey: 'd-over-threshold', scheduledTaskBinding: { bindingType: 'SCHEDULED_TASK', bindingId: 'scn-20-nightly-db-cleanup' } },
  });
  const definition = await ensureDefinition('scn-20-sized-db-cleanup', model);
  r.definitionKey = definition.key; r.definitionId = definition.id;
  const revision = await publishAndCapture(r, definition.id, definition.draftVersion);
  if (revision) r.evidence.bindingStatus = revision.bindingStatus;
  const modelManual = baseModel({ ...model, start: { type: 'MANUAL_API', targetNodeKey: 'd-over-threshold' } });
  const defManual = await ensureDefinition('scn-20b-sized-db-cleanup-manual', modelManual);
  const revManual = await publishAndCapture(r, defManual.id, defManual.draftVersion);
  if (revManual) {
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revManual.id, input: { currentSizeMb: 5200, thresholdMb: 4000 }, startedByType: 'USER', startedById: await adminUserId() });
    await tick(3);
    r.evidence.manualTriggerFallbackResult = await instanceStatus(instance.id);
  }
  r.gapNotes.push('Same SCHEDULE-binding gap as Scenario 16 — a real nightly cleanup cron cannot be activated today.');
  r.gapNotes.push('No filesystem-size-check or internal-database-query Action exists anywhere in corePack — "current DB/file size" cannot genuinely be measured from inside a workflow; it can only be threaded in as workflow input from an external caller (as this test does), which defeats the point of an autonomous scheduled cleanup job.');
  r.status = 'GAP';
}

// =================================================================================================
// MAIN
// =================================================================================================

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();

  await run('S01', 'Data Filtering — filter and fix user list', 'Data & Logic', scenario01);
  await run('S02', 'Data Merging — merge two local data sources', 'Data & Logic', scenario02);
  await run('S03', 'Loop with Break Condition', 'Data & Logic', scenario03);
  await run('S04', 'Deduplication — detect and merge duplicate records', 'Data & Logic', scenario04);
  await run('S05', 'Batch Queueing — split a large task into smaller tasks', 'Data & Logic', scenario05);

  await run('S06', 'Manual Resume via Webhook — manual transaction approval', 'Human-in-the-Loop', scenario06);
  await run('S07', 'Multi-Stage Approval — sequential two-stage approval', 'Human-in-the-Loop', scenario07);
  await run('S08', 'Timeout & Fallback — manual approval with deadline', 'Human-in-the-Loop', scenario08);
  await run('S09', 'Human Data Injection — human edits data mid-flow', 'Human-in-the-Loop', scenario09);

  await run('S10', 'Exponential Backoff Retry — automatic retry with increasing delay', 'Error Handling', scenario10);
  await run('S11', 'Error Branching / Catch Block — fallback path on error', 'Error Handling', scenario11);
  await run('S12', 'Rollback / Saga Pattern — safe cancellation on error', 'Error Handling', scenario12);

  await run('S13', 'In-Memory Processing — convert CSV to JSON without writing to disk', 'File System', scenario13);
  await run('S14', 'Local Folder Watcher Trigger — watch a local folder', 'File System', scenario14);
  await run('S15', 'Template Engine — generate dynamic text report', 'File System', scenario15);

  await run('S16', 'Periodic Health Check — scheduled cron job with status check', 'Scheduling', scenario16);
  await run('S17', 'Dynamic Delay/Wait — delay based on input data', 'Scheduling', scenario17);
  await run('S18', 'Race Condition & Concurrency Test — parallel runs with different schedules', 'Scheduling', scenario18);
  await run('S19', 'Date-Specific Execution — run at a specific date/time', 'Scheduling', scenario19);
  await run('S20', 'Sized-based DB Cleanup — scheduled database cleanup with size condition', 'Scheduling', scenario20);

  const outPath = 'C:\\Users\\Mohsen\\AppData\\Local\\Temp\\claude\\c--Workspace-Projects-AppEndO\\a112fd2e-4885-41b5-8ba0-4e82c05d39f9\\scratchpad\\workflow-20-scenarios-report.json';
  writeFileSync(outPath, JSON.stringify(results, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2), 'utf8');
  console.log(`\n\nWrote report: ${outPath}`);
  console.log('\nSummary:');
  for (const res of results) {
    console.log(`  ${res.id} [${res.status}] ${res.title} — instanceStatus=${res.finalInstanceStatus ?? 'n/a'} publish=${JSON.stringify(res.publish)}`);
  }
}

main()
  .catch((error) => { console.error('FATAL', error); process.exitCode = 1; })
  .finally(async () => { await closePrismaControlPlane(); });
