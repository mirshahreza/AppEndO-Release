import { randomUUID } from 'node:crypto';
import { logger } from '../../../../core/logging/Logger';
import { listClaimableNodeInstanceIds } from '../workflowNodeInstanceRepository';
import { dispatchNode } from './dispatchService';
import { scanAndRecoverExpiredLeases } from './recoveryService';
import { scanAndCompleteDueTimers } from './dueTimerScannerService';
import { scanAndApplySubflowResults } from './subflowContinuationService';
import { scanAndRunDueEscalations } from './workItemEscalationService';
import { scanAndRecheckUnmatchedEvents } from './eventCorrelationService';
import { scanAndSendDueNotificationDigests } from '../../../services/notifications/notificationDigestScanner';

/**
 * Background Engine Worker (Slice 12) — the one piece the Engine Independence Gate (doc 11 section
 * 2, "recovery/operations... MUST work") needs that no prior slice built: something that actually
 * *calls* the dispatch/recovery/scanner functions on a recurring basis in the running server.
 * Slices 5-10 built and fully tested every one of those functions against real Postgres, but every
 * test drives them directly with an already-known id — nothing in `bootstrapFullRuntime.ts` ever
 * invoked them before this file existed, so a Workflow instance started through the live server
 * would durably sit `READY` forever with no error and no evidence of why.
 *
 * Repository Reality Audit: the canonical AppEndO background-worker primitive is
 * `services/jobs/jobWorker.service.ts`'s `setInterval` + re-entrancy-guard pattern (already wired
 * into `bootstrapFullRuntime.ts` as `startJobWorker`) — this reuses that exact shape rather than
 * inventing a second one.
 *
 * Horizontal scaling posture (re-audited p-60, benchmark-report follow-up): each process runs its
 * own in-memory poller, but `claimReadyOrRetryingNode`'s CAS (id + stateVersion + status +
 * lease-window, all in one `WHERE`) is exactly what makes running this poller in MORE THAN ONE
 * process at once safe — only one racing claim can ever win, the loser gets a clean
 * `WF_EXEC_STALE_STATE_VERSION` instead of double-dispatching (this is not theoretical: the
 * 2026-07-17 20-scenario challenge's F-1 finding was reproduced BY two independent dev-server
 * processes polling the same DB, and F-1's 2026-07-18 fix specifically hardens the one step that
 * CAS alone didn't already cover — wait/work-item/subflow *creation*, not the claim itself). So a
 * dedicated pool of worker-only instances is already possible today, no new flag needed: set
 * `bootstrapFullRuntime.ts`'s `runtime.capabilities` to exclude `'worker'` on request-serving
 * instances and include it only on however many dedicated instances the deployment wants — every
 * one of them polling the same DB concurrently is safe by construction. `startWorkflowEngineWorker`
 * jitters its own tick interval (see below) specifically so that N such instances don't all wake up
 * in lockstep and contend for the same claim query at the exact same moment.
 */

let workerTimer: ReturnType<typeof setTimeout> | null = null;
let tickRunning = false;
const leaseOwnerId = `workflow-engine-worker:${randomUUID()}`;

/** Jitter fraction applied to each scheduled tick — see the module doc's horizontal-scaling note: this alone is what keeps N worker-enabled instances from all polling in lockstep. */
const TICK_JITTER_FRACTION = 0.2;
const jitteredDelay = (pollIntervalMs: number): number => {
  const jitter = pollIntervalMs * TICK_JITTER_FRACTION;
  return Math.round(pollIntervalMs - jitter + Math.random() * jitter * 2);
};

export type EngineWorkerTickSummary = {
  nodesClaimed: number;
  nodeDispatchErrors: number;
  recovery: Awaited<ReturnType<typeof scanAndRecoverExpiredLeases>>;
  dueTimers: Awaited<ReturnType<typeof scanAndCompleteDueTimers>>;
  subflows: Awaited<ReturnType<typeof scanAndApplySubflowResults>>;
  escalations: Awaited<ReturnType<typeof scanAndRunDueEscalations>>;
  eventRecheck: Awaited<ReturnType<typeof scanAndRecheckUnmatchedEvents>>;
  notificationDigests: Awaited<ReturnType<typeof scanAndSendDueNotificationDigests>>;
};

/**
 * One full pass: dispatch every currently-claimable node, then run every doc06 section 10 scanner.
 * Exported (not just the interval starter) so tests and transport/ops tooling can drive an exact,
 * awaitable tick instead of racing a timer — the interval loop below just calls this repeatedly.
 */
export async function runOneEngineWorkerTick(nodeBatchSize = 25): Promise<EngineWorkerTickSummary> {
  const claimableIds = await listClaimableNodeInstanceIds(nodeBatchSize);
  let nodesClaimed = 0;
  let nodeDispatchErrors = 0;
  for (const nodeInstanceId of claimableIds) {
    try {
      const outcome = await dispatchNode({ nodeInstanceId, leaseOwnerId });
      if (outcome.status === 'DISPATCHED') nodesClaimed += 1;
    } catch (error) {
      nodeDispatchErrors += 1;
      logger.error('WorkflowEngineWorker', `dispatchNode failed for node #${nodeInstanceId}: ${error instanceof Error ? error.message : String(error)}`, { nodeInstanceId });
    }
  }

  const recovery = await scanAndRecoverExpiredLeases(leaseOwnerId);
  const dueTimers = await scanAndCompleteDueTimers();
  const subflows = await scanAndApplySubflowResults();
  const escalations = await scanAndRunDueEscalations();
  const eventRecheck = await scanAndRecheckUnmatchedEvents(leaseOwnerId);
  const notificationDigests = await scanAndSendDueNotificationDigests();

  return { nodesClaimed, nodeDispatchErrors, recovery, dueTimers, subflows, escalations, eventRecheck, notificationDigests };
}

const tick = async (pollIntervalMs: number): Promise<void> => {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const summary = await runOneEngineWorkerTick();
    if (summary.nodesClaimed > 0 || summary.nodeDispatchErrors > 0) {
      logger.info('WorkflowEngineWorker', 'Engine tick dispatched work.', { nodesClaimed: summary.nodesClaimed, nodeDispatchErrors: summary.nodeDispatchErrors });
    }
  } catch (error) {
    logger.error('WorkflowEngineWorker', `Engine tick failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    tickRunning = false;
    if (workerTimer !== null) {
      workerTimer = setTimeout(() => { void tick(pollIntervalMs); }, jitteredDelay(pollIntervalMs));
    }
  }
};

export const startWorkflowEngineWorker = (pollIntervalMs = 1000): void => {
  if (workerTimer) return;
  workerTimer = setTimeout(() => { void tick(pollIntervalMs); }, 0);
  logger.info('WorkflowEngineWorker', 'Background Workflow engine worker started.', { pollIntervalMs, jitterFraction: TICK_JITTER_FRACTION, leaseOwnerId });
};

export const stopWorkflowEngineWorker = (): void => {
  if (!workerTimer) return;
  clearTimeout(workerTimer);
  workerTimer = null;
};
