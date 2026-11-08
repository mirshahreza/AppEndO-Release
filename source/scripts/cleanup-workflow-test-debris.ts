/**
 * Cleans up orphaned non-terminal WorkflowInstance rows (CREATED/RUNNING/SUSPENDED) and their full
 * durable cascade (attempts, waits, Work Items, branch tokens, join arrivals, trace) from a
 * Workflow test/dev database.
 *
 * Why this exists: `src/server/domain/workflow`'s real-DB test suite runs against a shared,
 * non-ephemeral Postgres database (no per-CI-run ephemeral DB exists yet — see
 * `docs/standards/workflow-engine-testing.md` (Slice 12 / test hygiene).
 * `scanAndRecoverExpiredLeases`/`scanAndCompleteDueTimers` (doc06 section 2) are intentionally
 * GLOBAL scans with no per-run filter, so orphaned non-terminal instances left behind by past test
 * runs (or interrupted `npm run dev` sessions) accumulate and get swept into every subsequent
 * scan, occasionally throwing on a long-gone test-only Action key. This script removes that debris
 * safely — SUCCEEDED/FAILED/CANCELLED (terminal) instances are never touched, only genuinely
 * unfinished ones.
 *
 * DANGER: only run this against a Workflow test/dev database. It deletes real in-flight
 * WorkflowInstance rows and everything under them — never run it against a production database
 * with real running workflow instances.
 *
 * Usage:
 *   DATABASE_URL=... npm run workflow:cleanup-debris -- --dry-run   # preview only, no deletes
 *   DATABASE_URL=... npm run workflow:cleanup-debris                # actually delete
 */
import { Pool } from 'pg';
import { toPgPoolConfig } from '../src/server/config/env';
import { initControlPlanePool, closeControlPlanePool } from '../src/server/db/controlPlane';
import { bindPrismaToPgPool, closePrismaControlPlane } from '../src/server/db/prismaControlPlane';
import { prisma } from '../src/server/domain/users/prismaHelpers';

const NON_TERMINAL_STATUSES = ['CREATED', 'RUNNING', 'SUSPENDED'] as const;

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const pool = new Pool(toPgPoolConfig());
  initControlPlanePool(pool);
  await pool.query('SELECT 1');
  await bindPrismaToPgPool(pool);

  try {
    const nonTerminalIds = (
      await prisma().workflowInstance.findMany({ where: { status: { in: [...NON_TERMINAL_STATUSES] } }, select: { id: true } })
    ).map((r) => r.id);

    console.log(`[workflow:cleanup-debris] non-terminal WorkflowInstance rows found: ${nonTerminalIds.length}`);
    if (nonTerminalIds.length === 0) {
      console.log('[workflow:cleanup-debris] nothing to clean up.');
      return;
    }
    if (dryRun) {
      console.log('[workflow:cleanup-debris] --dry-run: no rows deleted. Re-run without --dry-run to actually clean up.');
      return;
    }

    const nodeIds = (await prisma().workflowNodeInstance.findMany({ where: { workflowInstanceId: { in: nonTerminalIds } }, select: { id: true } })).map((r) => r.id);

    // Ordered deletes respecting FKs (no ON DELETE CASCADE on these Workflow tables).
    await prisma().workItemEscalation.deleteMany({ where: { workItem: { nodeInstanceId: { in: nodeIds } } } });
    await prisma().workItemTransition.deleteMany({ where: { workItem: { nodeInstanceId: { in: nodeIds } } } });
    await prisma().workflowWait.deleteMany({ where: { workflowInstanceId: { in: nonTerminalIds } } });
    await prisma().workItem.deleteMany({ where: { nodeInstanceId: { in: nodeIds } } });
    await prisma().workflowExecutionAttempt.deleteMany({ where: { nodeInstanceId: { in: nodeIds } } });
    await prisma().workflowTrace.deleteMany({ where: { workflowInstanceId: { in: nonTerminalIds } } });
    await prisma().workflowJoinArrival.deleteMany({ where: { workflowInstanceId: { in: nonTerminalIds } } });
    await prisma().workflowNodeInstance.deleteMany({ where: { workflowInstanceId: { in: nonTerminalIds } } });
    await prisma().workflowBranchToken.deleteMany({ where: { workflowInstanceId: { in: nonTerminalIds } } });
    const result = await prisma().workflowInstance.deleteMany({ where: { id: { in: nonTerminalIds } } });

    console.log(`[workflow:cleanup-debris] deleted ${result.count} WorkflowInstance rows and their full cascade.`);

    const remainingStale = await prisma().workflowNodeInstance.count({ where: { status: 'RUNNING', leaseExpiresAt: { lte: new Date() } } });
    console.log(`[workflow:cleanup-debris] remaining stale RUNNING nodes with expired lease: ${remainingStale}`);
  } finally {
    await closePrismaControlPlane();
    await closeControlPlanePool(pool);
  }
}

main().catch((error) => {
  console.error('[workflow:cleanup-debris] failed:', error);
  process.exit(1);
});
