/**
 * Full reset of every Workflow-domain table (definitions, revisions, instances and their entire
 * durable cascade). Requested by the platform owner to empty the Workflow definition list before
 * seeding a new 20-scenario test suite (see plans/core/todo/p-6x-workflow-20-scenarios-*.md).
 *
 * Unlike scripts/cleanup-workflow-test-debris.ts (which only removes orphaned non-terminal
 * instances), this wipes EVERYTHING in the 16 Workflow/WorkItem tables, including published
 * definitions and terminal (SUCCEEDED/FAILED/CANCELLED) instances. Prints a before/after inventory.
 *
 * Uses initPrismaControlPlane against settings.json (same as scripts/seed-example-workflows.ts).
 * Wipe is a single Postgres TRUNCATE of the Workflow/WorkItem tables (circular FKs are listed
 * together so they do not need CASCADE). Does not touch secret references, business-hours calendar,
 * saved inbox filters, or vector documents.
 *
 * DANGER: only run this against a Workflow test/dev database. Irreversible.
 *
 * Usage:
 *   npx tsx scripts/reset-all-workflows.ts --dry-run   # preview only, no deletes
 *   npx tsx scripts/reset-all-workflows.ts             # actually delete everything
 */
import { initPrismaControlPlane, closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../src/server/config/settingsFile';
import { prisma } from '../src/server/domain/workflow/prismaHelpers';

const WORKFLOW_WIPE_TABLES = [
  'base_work_item_escalations',
  'base_work_item_transitions',
  'base_work_item_attachments',
  'base_work_item_comments',
  'base_workflow_dead_letters',
  'base_workflow_join_arrivals',
  'base_workflow_traces',
  'base_workflow_waits',
  'base_work_items',
  'base_workflow_execution_attempts',
  'base_workflow_node_instances',
  'base_workflow_branch_tokens',
  'base_workflow_instances',
  'base_workflow_simulation_runs',
  'base_workflow_validation_reports',
  'base_workflow_designer_views',
  'base_workflow_webhook_bindings',
  'base_workflow_revisions',
  'base_workflow_definitions',
  'base_workflow_event_inbox',
] as const;

async function inventory() {
  const [definitions, definitionSample, revisions, instances, nodeInstances, workItems, waits, attempts, traces, branchTokens, joinArrivals, simRuns, validationReports, designerViews, eventInbox] = await Promise.all([
    prisma().workflowDefinition.count(),
    prisma().workflowDefinition.findMany({ select: { id: true, key: true, scopeKey: true, lifecycleStatus: true }, take: 12, orderBy: { id: 'desc' } }),
    prisma().workflowRevision.count(),
    prisma().workflowInstance.count(),
    prisma().workflowNodeInstance.count(),
    prisma().workItem.count(),
    prisma().workflowWait.count(),
    prisma().workflowExecutionAttempt.count(),
    prisma().workflowTrace.count(),
    prisma().workflowBranchToken.count(),
    prisma().workflowJoinArrival.count(),
    prisma().workflowSimulationRun.count(),
    prisma().workflowValidationReport.count(),
    prisma().workflowDesignerView.count(),
    prisma().workflowEventInbox.count(),
  ]);
  return { definitions, definitionSample, revisions, instances, nodeInstances, workItems, waits, attempts, traces, branchTokens, joinArrivals, simRuns, validationReports, designerViews, eventInbox };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  await initPrismaControlPlane(SETTINGS_PATH);

  try {
    const before = await inventory();
    const sample = before.definitionSample.map((d) => `${d.key}[${d.scopeKey}]#${d.id}(${d.lifecycleStatus})`).join(', ');
    console.log('[workflow:reset-all] current inventory:');
    console.log(`  definitions=${before.definitions}${sample ? ` (latest: ${sample})` : ''}`);
    console.log(`  revisions=${before.revisions} instances=${before.instances} nodeInstances=${before.nodeInstances} workItems=${before.workItems} waits=${before.waits} attempts=${before.attempts} traces=${before.traces} branchTokens=${before.branchTokens} joinArrivals=${before.joinArrivals} simRuns=${before.simRuns} validationReports=${before.validationReports} designerViews=${before.designerViews} eventInbox=${before.eventInbox}`);

    if (dryRun) {
      console.log('[workflow:reset-all] --dry-run: no rows deleted.');
      return;
    }

    if (before.definitions === 0 && before.instances === 0 && before.traces === 0) {
      console.log('[workflow:reset-all] nothing to delete.');
      return;
    }

    console.log(`[workflow:reset-all] truncating ${WORKFLOW_WIPE_TABLES.length} tables`);
    await prisma().$executeRawUnsafe(`TRUNCATE TABLE ${WORKFLOW_WIPE_TABLES.join(', ')} RESTART IDENTITY`);

    const after = await inventory();
    console.log('[workflow:reset-all] after inventory:');
    console.log(`  definitions=${after.definitions} revisions=${after.revisions} instances=${after.instances} nodeInstances=${after.nodeInstances} workItems=${after.workItems} waits=${after.waits} attempts=${after.attempts} traces=${after.traces} branchTokens=${after.branchTokens} joinArrivals=${after.joinArrivals} simRuns=${after.simRuns} validationReports=${after.validationReports} designerViews=${after.designerViews} eventInbox=${after.eventInbox}`);
    console.log('[workflow:reset-all] done — Workflow tables are empty.');
  } finally {
    await closePrismaControlPlane();
  }
}

main().catch((error) => {
  console.error('[workflow:reset-all] failed:', error);
  process.exit(1);
});
