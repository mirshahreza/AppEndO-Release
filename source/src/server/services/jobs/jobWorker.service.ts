import { logger } from '../../../core/logging/Logger';
import {
  claimNextPendingJob,
  completeJob,
  failJob,
  isJobCancelRequested,
  markJobCancelled,
  parseAgentTaskJobPayload,
  parseDbEnrichmentJobPayload,
  parseServerFunctionJobPayload,
  updateJobProgress,
} from '../../domain/jobs/jobRepository';
import { failRun as failEnrichmentRun, appendRunLog as appendEnrichmentRunLog } from '../../domain/db-enrichment/dbEnrichmentRepository';
import type { JobRecord } from '../../domain/jobs/jobTypes';
import type { EdgeDbQueryFn } from '../server-function.service';
import type { DataSourcesService } from '../data-sources.service';
import { executeManagedFunctionForJob } from './jobServerFunctionExecutor';
import { executeAgentTaskForJob, type AgentTaskJobResult } from './agentTaskJobExecutor';
import { runEnrichment } from '../db-enrichment/dbEnrichmentService';
import { findChatSessionForUser, updateChatSession } from '../../domain/ai/chatHistoryRepository';
import { dispatchNotification } from '../notifications/notificationDispatch';
import type { AgentTaskJobEnvelope } from '../../domain/jobs/jobTypes';

export type JobWorkerDeps = {
  edgeDbQuery: EdgeDbQueryFn;
  dataSourcesService: DataSourcesService;
};

let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerRunning = false;

const processEdgeFunctionJob = async (job: JobRecord, deps: JobWorkerDeps) => {
  const envelope = parseServerFunctionJobPayload(job.payload_json);
  if (!envelope?.functionId) {
    await failJob(job.id, 'Job payload is missing server function reference.');
    return;
  }

  const functionId = envelope.functionId;
  const payload = envelope.userPayload;

  await updateJobProgress(job.id, 25, `Running ${functionId}…`);
  if (await isJobCancelRequested(job.id)) {
    await markJobCancelled(job.id);
    return;
  }

  try {
    const result = await executeManagedFunctionForJob(functionId, payload, deps.edgeDbQuery);

    if (await isJobCancelRequested(job.id)) {
      await markJobCancelled(job.id);
      return;
    }

    await updateJobProgress(job.id, 90);
    await completeJob(job.id, result.body);
    logger.info('JobWorker', `Job #${job.id} completed (${functionId}).`, {
      jobId: job.id,
      functionId,
      statusCode: result.statusCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job execution failed.';
    await failJob(job.id, message);
    logger.error('JobWorker', `Job #${job.id} failed: ${message}`, { jobId: job.id, functionId });
  }
};

const AGENT_TASK_NOTIFICATION_BODY_MAX = 500;

/**
 * p-102 — best-effort write-back of a background run's result into the chat session it was
 * launched from, so the user finds the answer already there next time they open it. Deliberately
 * swallows its own errors: a write-back failure must never flip a completed job to failed, and
 * `updateChatSession` does a full `messages` replace (no append primitive exists), so this always
 * re-reads the session immediately before writing — accepted "last write wins" if the user was
 * also chatting live in the same session concurrently (documented limitation, not solved in V1).
 */
const writeAgentTaskResultBackToSession = async (
  envelope: AgentTaskJobEnvelope,
  content: string,
): Promise<void> => {
  if (!envelope.sessionId) return;
  try {
    const session = await findChatSessionForUser(envelope.sessionId, envelope.actorUserId);
    if (!session) return;
    await updateChatSession({
      sessionId: envelope.sessionId,
      userId: envelope.actorUserId,
      actorId: envelope.actorUserId,
      messages: [...session.messages, { role: 'assistant', content }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      'JobWorker',
      `Failed to write background agent task result back to session ${envelope.sessionId}: ${message}`,
      { taskId: envelope.taskId },
    );
  }
};

/** p-102 — no dedicated background-tasks dashboard in V1; the notification is the result surface. */
const notifyAgentTaskOutcome = async (
  envelope: AgentTaskJobEnvelope,
  outcome: 'completed' | 'failed',
  body: string,
): Promise<void> => {
  try {
    await dispatchNotification({
      userId: envelope.actorUserId,
      title: outcome === 'completed'
        ? (envelope.title ?? 'Background agent task completed')
        : `Background agent task failed: ${envelope.title ?? envelope.taskId}`,
      body: body.slice(0, AGENT_TASK_NOTIFICATION_BODY_MAX),
      severity: outcome === 'completed' ? 'info' : 'error',
      eventType: 'agent_task',
      metadata: { taskId: envelope.taskId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('JobWorker', `Failed to notify user of agent task outcome: ${message}`, {
      taskId: envelope.taskId,
    });
  }
};

/** V5 Phase P11 § V5-21 — background agent-task job dispatch. */
const processAgentTaskJob = async (job: JobRecord) => {
  const envelope = parseAgentTaskJobPayload(job.payload_json);
  if (!envelope) {
    await failJob(job.id, 'Job payload is missing a valid agent task envelope.');
    return;
  }

  await updateJobProgress(job.id, 10, 'Running agent task…');
  if (await isJobCancelRequested(job.id)) {
    await markJobCancelled(job.id);
    return;
  }

  let result: AgentTaskJobResult | undefined;
  try {
    result = await executeAgentTaskForJob(envelope);

    if (await isJobCancelRequested(job.id)) {
      await markJobCancelled(job.id);
      return;
    }

    await updateJobProgress(job.id, 90);
    await completeJob(job.id, result);
    logger.info('JobWorker', `Job #${job.id} completed (agent task ${envelope.taskId}).`, {
      jobId: job.id,
      taskId: envelope.taskId,
      attemptId: envelope.attemptId,
    });

    await writeAgentTaskResultBackToSession(envelope, result.text);
    await notifyAgentTaskOutcome(envelope, 'completed', result.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent task job execution failed.';
    // Not reconciled here — the durable event log (AgentEventStore, P09 § V5-13) already
    // captures exactly how far the run got before failing; a caller resuming with the SAME
    // taskId/attemptId is what reconciles it, not this catch block.
    await failJob(job.id, message);
    logger.error('JobWorker', `Job #${job.id} failed: ${message}`, {
      jobId: job.id,
      taskId: envelope.taskId,
      attemptId: envelope.attemptId,
    });

    await notifyAgentTaskOutcome(envelope, 'failed', message);
  }
};

/** DB Enricher — background schema/data understanding pass, one job per DbEnrichmentRun row. */
const processDbEnrichmentJob = async (job: JobRecord, deps: JobWorkerDeps) => {
  const envelope = parseDbEnrichmentJobPayload(job.payload_json);
  if (!envelope) {
    await failJob(job.id, 'Job payload is missing a valid DB enrichment envelope.');
    return;
  }

  await updateJobProgress(job.id, 5, 'Starting DB enrichment…');
  if (await isJobCancelRequested(job.id)) {
    await markJobCancelled(job.id);
    return;
  }

  try {
    await runEnrichment(envelope, deps.dataSourcesService, async (processed, total, message) => {
      const progress = total > 0 ? Math.round((processed / total) * 90) + 5 : 50;
      await updateJobProgress(job.id, progress, message);
    });

    await updateJobProgress(job.id, 100, 'Completed');
    await completeJob(job.id, { runId: envelope.runId, dataSourceId: envelope.dataSourceId });
    logger.info('JobWorker', `Job #${job.id} completed (db enrichment run ${envelope.runId}).`, {
      jobId: job.id,
      runId: envelope.runId,
      dataSourceId: envelope.dataSourceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DB enrichment job execution failed.';
    await failEnrichmentRun(envelope.runId, message).catch(() => undefined);
    await appendEnrichmentRunLog(envelope.runId, `Failed: ${message}`).catch(() => undefined);
    await failJob(job.id, message);
    logger.error('JobWorker', `Job #${job.id} failed: ${message}`, {
      jobId: job.id,
      runId: envelope.runId,
      dataSourceId: envelope.dataSourceId,
    });
  }
};

const processRetentionJob = async (job: JobRecord) => {
  const { executeRetention } = await import('../../domain/retention/retentionExecutor');
  const dryRun = (() => {
    try {
      const parsed = job.payload_json ? JSON.parse(job.payload_json) as { dryRun?: boolean } : {};
      return Boolean(parsed.dryRun);
    } catch {
      return false;
    }
  })();
  const scope = job.job_type === 'log_retention' ? 'logs' as const : 'recordEvents';
  try {
    const result = await executeRetention({
      scope,
      dryRun,
      jobId: job.id,
    });
    await completeJob(job.id, result);
    logger.info('JobWorker', `Job #${job.id} completed (${job.job_type}).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Retention job failed.';
    await failJob(job.id, message);
  }
};

const processRecordEventPurgeJob = async (job: JobRecord) => {
  await processRetentionJob({ ...job, job_type: 'record_event_retention' });
};

const processRecordEventIntegrityJob = async (job: JobRecord) => {
  const { runRecordEventIntegrity, RECORD_EVENT_INTEGRITY_JOB_TYPE } = await import(
    '../../domain/record-events/recordEventJobs'
  );
  try {
    const result = await runRecordEventIntegrity();
    await completeJob(job.id, result);
    logger.info('JobWorker', `Job #${job.id} completed (${RECORD_EVENT_INTEGRITY_JOB_TYPE}).`, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Record event integrity check failed.';
    await failJob(job.id, message);
  }
};

const processNextJob = async (deps: JobWorkerDeps) => {
  if (workerRunning) return;
  workerRunning = true;

  try {
    const job = await claimNextPendingJob();
    if (!job) return;

    if (await isJobCancelRequested(job.id)) {
      await markJobCancelled(job.id);
      return;
    }

    if (job.job_type === 'edge_function') {
      await processEdgeFunctionJob(job, deps);
    } else if (job.job_type === 'agent_task') {
      await processAgentTaskJob(job);
    } else if (job.job_type === 'db_enrichment') {
      await processDbEnrichmentJob(job, deps);
    } else if (job.job_type === 'record_event_purge') {
      await processRecordEventPurgeJob(job);
    } else if (job.job_type === 'record_event_retention' || job.job_type === 'log_retention') {
      await processRetentionJob(job);
    } else if (job.job_type === 'record_event_integrity') {
      await processRecordEventIntegrityJob(job);
    } else {
      await failJob(job.id, `Unsupported job type "${job.job_type}".`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job worker tick failed.';
    logger.error('JobWorker', message);
  } finally {
    workerRunning = false;
  }
};

export const startJobWorker = (deps: JobWorkerDeps, pollIntervalMs = 2000): void => {
  if (workerTimer) return;

  void processNextJob(deps);
  workerTimer = setInterval(() => {
    void processNextJob(deps);
  }, pollIntervalMs);

  logger.info('JobWorker', 'Background job worker started.', { pollIntervalMs });
};

export const stopJobWorker = (): void => {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
};
