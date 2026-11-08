import type {
  AgentTaskJobEnvelope,
  DbEnrichmentJobEnvelope,
  EnqueueAgentTaskJobInput,
  EnqueueDbEnrichmentJobInput,
  EnqueueServerFunctionJobInput,
  JobRecord,
  JobStatus,
  ServerFunctionJobEnvelope,
} from './jobTypes';
import { fromUserId, prisma, toUserId } from '../users/prismaHelpers';

export const buildServerFunctionJobPayload = (input: EnqueueServerFunctionJobInput): string => {
  const envelope: ServerFunctionJobEnvelope = {
    functionId: input.functionId,
    userPayload: input.payload ?? {},
    metadata: input.metadata ?? {},
    title: input.title ?? input.functionId,
  };
  return JSON.stringify(envelope);
};

export const parseServerFunctionJobPayload = (raw: string | null): ServerFunctionJobEnvelope | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServerFunctionJobEnvelope>;
    if (!parsed || typeof parsed !== 'object' || !parsed.functionId) {
      return null;
    }
    return {
      functionId: String(parsed.functionId),
      userPayload: parsed.userPayload && typeof parsed.userPayload === 'object' && !Array.isArray(parsed.userPayload)
        ? parsed.userPayload as Record<string, unknown>
        : {},
      metadata: parsed.metadata && typeof parsed.metadata === 'object' && !Array.isArray(parsed.metadata)
        ? parsed.metadata as ServerFunctionJobEnvelope['metadata']
        : {},
      title: parsed.title ? String(parsed.title) : String(parsed.functionId),
    };
  } catch {
    return null;
  }
};

const toIsoString = (value: Date | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : value ? String(value) : null;

const mapJobRecord = (row: {
  id: bigint;
  jobType: string;
  status: string;
  progress: number;
  progressMessage: string | null;
  payloadJson: string | null;
  resultJson: string | null;
  errorMessage: string | null;
  cancelRequested: number;
  attemptCount: number;
  maxAttempts: number;
  queuedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date | null;
  createdBy: bigint | null;
  updatedAt: Date | null;
  updatedBy: bigint | null;
}): JobRecord => ({
  id: fromUserId(row.id),
  job_type: row.jobType,
  status: row.status as JobStatus,
  progress: row.progress,
  progress_message: row.progressMessage,
  payload_json: row.payloadJson,
  result_json: row.resultJson,
  error_message: row.errorMessage,
  cancel_requested: row.cancelRequested,
  attempt_count: row.attemptCount,
  max_attempts: row.maxAttempts,
  queued_at: toIsoString(row.queuedAt),
  started_at: toIsoString(row.startedAt),
  finished_at: toIsoString(row.finishedAt),
  created_at: toIsoString(row.createdAt) ?? '',
  created_by: row.createdBy !== null ? fromUserId(row.createdBy) : null,
  updated_at: toIsoString(row.updatedAt) ?? '',
  updated_by: row.updatedBy !== null ? fromUserId(row.updatedBy) : null,
});

const findJobRowById = async (jobId: number) => {
  const row = await prisma().baseJob.findUnique({ where: { id: toUserId(jobId) } });
  return row ? mapJobRecord(row) : undefined;
};

export const enqueueServerFunctionJob = async (input: EnqueueServerFunctionJobInput): Promise<number> => {
  const payloadJson = buildServerFunctionJobPayload(input);
  const actor = input.createdBy !== undefined && input.createdBy !== null ? toUserId(input.createdBy) : null;

  const row = await prisma().baseJob.create({
    data: {
      jobType: 'edge_function',
      status: 'pending',
      progress: 0,
      payloadJson,
      createdBy: actor,
      updatedBy: actor,
      queuedAt: new Date(),
      attemptCount: 0,
      maxAttempts: 3,
    },
    select: { id: true },
  });

  return fromUserId(row.id);
};

export type EnqueueRetentionJobInput = {
  jobType: 'log_retention' | 'record_event_retention';
  dryRun: boolean;
  createdBy?: number | null;
};

export const enqueueRetentionJob = async (input: EnqueueRetentionJobInput): Promise<number> => {
  const actor = input.createdBy !== undefined && input.createdBy !== null ? toUserId(input.createdBy) : null;
  const row = await prisma().baseJob.create({
    data: {
      jobType: input.jobType,
      status: 'pending',
      progress: 0,
      payloadJson: JSON.stringify({ dryRun: Boolean(input.dryRun) }),
      createdBy: actor,
      updatedBy: actor,
      queuedAt: new Date(),
      attemptCount: 0,
      maxAttempts: 1,
    },
    select: { id: true },
  });
  return fromUserId(row.id);
};

/** V5 Phase P11 § V5-21 — same envelope-build/parse pattern as `buildServerFunctionJobPayload`. */
export const buildAgentTaskJobPayload = (input: EnqueueAgentTaskJobInput): string => {
  const envelope: AgentTaskJobEnvelope = {
    taskId: input.taskId,
    attemptId: input.attemptId,
    actorUserId: input.actorUserId,
    sessionId: input.sessionId,
    mode: input.mode,
    messages: input.messages,
    executionProfile: input.executionProfile,
    useEngineeringPipeline: input.useEngineeringPipeline,
    modelId: input.modelId,
    pageContext: input.pageContext,
    enabledCapabilityPackIds: input.enabledCapabilityPackIds,
    enabledMcpServerIds: input.enabledMcpServerIds,
    title: input.title ?? `Agent task ${input.taskId}`,
  };
  return JSON.stringify(envelope);
};

export const parseAgentTaskJobPayload = (raw: string | null): AgentTaskJobEnvelope | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AgentTaskJobEnvelope>;
    if (!parsed || typeof parsed !== 'object' || !parsed.taskId || !parsed.attemptId || !Array.isArray(parsed.messages)) {
      return null;
    }
    return {
      taskId: String(parsed.taskId),
      attemptId: String(parsed.attemptId),
      actorUserId: Number(parsed.actorUserId) || 0,
      sessionId: parsed.sessionId !== undefined && parsed.sessionId !== null ? Number(parsed.sessionId) : undefined,
      mode: parsed.mode === 'ask' || parsed.mode === 'plan' ? parsed.mode : 'agent',
      messages: parsed.messages,
      executionProfile: String(parsed.executionProfile ?? 'agent_implement'),
      useEngineeringPipeline: Boolean(parsed.useEngineeringPipeline),
      modelId: parsed.modelId ? String(parsed.modelId) : undefined,
      pageContext: parsed.pageContext && typeof parsed.pageContext === 'object' ? parsed.pageContext : undefined,
      enabledCapabilityPackIds: Array.isArray(parsed.enabledCapabilityPackIds)
        ? parsed.enabledCapabilityPackIds.map(String)
        : undefined,
      enabledMcpServerIds: Array.isArray(parsed.enabledMcpServerIds)
        ? parsed.enabledMcpServerIds.map(String)
        : undefined,
      title: parsed.title ? String(parsed.title) : undefined,
    };
  } catch {
    return null;
  }
};

/** p-102 — a background chat turn is cheap to request repeatedly; cap concurrent runs per user. */
const MAX_CONCURRENT_AGENT_TASK_JOBS_PER_USER = 2;

export const countActiveAgentTaskJobsForUser = async (actorUserId: number): Promise<number> => {
  const rows = await prisma().baseJob.findMany({
    where: {
      jobType: 'agent_task',
      status: { in: ['pending', 'running'] },
    },
    select: { payloadJson: true },
    take: 500,
  });
  return rows.filter((row) => parseAgentTaskJobPayload(row.payloadJson)?.actorUserId === actorUserId).length;
};

export const enqueueAgentTaskJob = async (input: EnqueueAgentTaskJobInput): Promise<number> => {
  const activeCount = await countActiveAgentTaskJobsForUser(input.actorUserId);
  if (activeCount >= MAX_CONCURRENT_AGENT_TASK_JOBS_PER_USER) {
    throw new Error(
      `You already have ${activeCount} background agent task(s) in progress (limit ${MAX_CONCURRENT_AGENT_TASK_JOBS_PER_USER}). Wait for one to finish before starting another.`,
    );
  }

  const payloadJson = buildAgentTaskJobPayload(input);
  const actor = input.createdBy !== undefined && input.createdBy !== null ? toUserId(input.createdBy) : null;

  const row = await prisma().baseJob.create({
    data: {
      jobType: 'agent_task',
      status: 'pending',
      progress: 0,
      payloadJson,
      createdBy: actor,
      updatedBy: actor,
      queuedAt: new Date(),
      attemptCount: 0,
      maxAttempts: 1, // V5-13's idempotency gate is target/tool-scoped, not job-retry-scoped — see agentTaskJobExecutor.ts doc comment.
    },
    select: { id: true },
  });

  return fromUserId(row.id);
};

export const buildDbEnrichmentJobPayload = (input: EnqueueDbEnrichmentJobInput): string => {
  const envelope: DbEnrichmentJobEnvelope = {
    runId: input.runId,
    dataSourceId: input.dataSourceId,
    scope: input.scope,
    tables: input.tables,
    modelId: input.modelId,
    title: input.title ?? `DB enrichment for ${input.dataSourceId}`,
  };
  return JSON.stringify(envelope);
};

export const parseDbEnrichmentJobPayload = (raw: string | null): DbEnrichmentJobEnvelope | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DbEnrichmentJobEnvelope>;
    if (!parsed || typeof parsed !== 'object' || !parsed.runId || !parsed.dataSourceId) {
      return null;
    }
    return {
      runId: Number(parsed.runId),
      dataSourceId: String(parsed.dataSourceId),
      scope: parsed.scope === 'TABLES' ? 'TABLES' : 'FULL',
      tables: Array.isArray(parsed.tables) ? parsed.tables.map(String) : undefined,
      modelId: parsed.modelId ? String(parsed.modelId) : undefined,
      title: parsed.title ? String(parsed.title) : undefined,
    };
  } catch {
    return null;
  }
};

export const enqueueDbEnrichmentJob = async (input: EnqueueDbEnrichmentJobInput): Promise<number> => {
  const payloadJson = buildDbEnrichmentJobPayload(input);
  const actor = input.createdBy !== undefined && input.createdBy !== null ? toUserId(input.createdBy) : null;

  const row = await prisma().baseJob.create({
    data: {
      jobType: 'db_enrichment',
      status: 'pending',
      progress: 0,
      payloadJson,
      createdBy: actor,
      updatedBy: actor,
      queuedAt: new Date(),
      attemptCount: 0,
      maxAttempts: 1, // a half-finished enrichment isn't safely retryable without dedup logic — a fresh manual run is the retry path.
    },
    select: { id: true },
  });

  return fromUserId(row.id);
};

export const findActiveJobByCronSlot = async (
  scheduledTaskId: string,
  cronSlot: string,
): Promise<JobRecord | undefined> => {
  const rows = await prisma().baseJob.findMany({
    where: {
      jobType: 'edge_function',
      status: { in: ['pending', 'running'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return rows
    .map(mapJobRecord)
    .find((row) => {
      const envelope = parseServerFunctionJobPayload(row.payload_json);
      return envelope?.metadata.scheduledTaskId === scheduledTaskId
        && envelope?.metadata.cronSlot === cronSlot;
    });
};

export const claimNextPendingJob = async (): Promise<JobRecord | undefined> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = await prisma().baseJob.findFirst({
      where: { status: 'pending' },
      orderBy: [
        { queuedAt: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    if (!candidate) return undefined;

    const updated = await prisma().baseJob.updateMany({
      where: { id: candidate.id, status: 'pending' },
      data: {
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
        progress: 5,
        attemptCount: { increment: 1 },
      },
    });

    if (updated.count === 1) {
      const row = await prisma().baseJob.findUnique({ where: { id: candidate.id } });
      return row ? mapJobRecord(row) : undefined;
    }
  }

  return undefined;
};

export const updateJobProgress = async (jobId: number, progress: number, message?: string): Promise<void> => {
  await prisma().baseJob.update({
    where: { id: toUserId(jobId) },
    data: {
      progress: Math.max(0, Math.min(100, Math.floor(progress))),
      ...(message !== undefined ? { progressMessage: message } : {}),
      updatedAt: new Date(),
    },
  });
};

export const completeJob = async (
  jobId: number,
  result: unknown,
): Promise<void> => {
  await prisma().baseJob.update({
    where: { id: toUserId(jobId) },
    data: {
      status: 'completed',
      progress: 100,
      progressMessage: 'Completed',
      resultJson: JSON.stringify(result ?? null),
      finishedAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

export const failJob = async (jobId: number, errorMessage: string): Promise<void> => {
  await prisma().baseJob.update({
    where: { id: toUserId(jobId) },
    data: {
      status: 'failed',
      errorMessage: errorMessage.slice(0, 4000),
      finishedAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

const JOB_LIST_SELECT = {
  id: true,
  jobType: true,
  status: true,
  progress: true,
  progressMessage: true,
  payloadJson: true,
  errorMessage: true,
  cancelRequested: true,
  attemptCount: true,
  maxAttempts: true,
  queuedAt: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
} as const;

/** Drop chat messages / result blobs from list payloads; keep title + functionId + metadata for the grid. */
export const slimJobListPayloadJson = (raw: string | null): string | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const slim: Record<string, unknown> = {};
    if (typeof parsed.functionId === 'string') slim.functionId = parsed.functionId;
    if (typeof parsed.title === 'string') slim.title = parsed.title;
    if (typeof parsed.taskId === 'string') slim.taskId = parsed.taskId;
    if (parsed.metadata && typeof parsed.metadata === 'object' && !Array.isArray(parsed.metadata)) {
      slim.metadata = parsed.metadata;
    }
    return Object.keys(slim).length > 0 ? JSON.stringify(slim) : null;
  } catch {
    return null;
  }
};

const slimJobListRecord = (job: JobRecord): JobRecord => ({
  ...job,
  payload_json: slimJobListPayloadJson(job.payload_json),
  result_json: null,
});

export const listRecentJobs = async (limit = 100, statusFilter?: JobStatus[]): Promise<JobRecord[]> => {
  const rows = await prisma().baseJob.findMany({
    where: statusFilter && statusFilter.length > 0 ? { status: { in: statusFilter } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: JOB_LIST_SELECT,
  });
  return rows.map((row) => slimJobListRecord(mapJobRecord({ ...row, resultJson: null })));
};

export const listActiveJobs = async (limit = 50): Promise<JobRecord[]> => (
  listRecentJobs(limit, ['pending', 'running'])
);

export const isJobCancelRequested = async (jobId: number): Promise<boolean> => {
  const row = await prisma().baseJob.findUnique({
    where: { id: toUserId(jobId) },
    select: { cancelRequested: true },
  });
  return Number(row?.cancelRequested ?? 0) === 1;
};

export const markJobCancelled = async (jobId: number, message = 'Cancelled'): Promise<void> => {
  await prisma().baseJob.update({
    where: { id: toUserId(jobId) },
    data: {
      status: 'cancelled',
      cancelRequested: 1,
      progressMessage: message,
      finishedAt: new Date(),
      updatedAt: new Date(),
    },
  });
};

export const requestJobCancel = async (jobId: number): Promise<JobRecord | undefined> => {
  const job = await findJobRowById(jobId);
  if (!job) return undefined;

  if (job.status === 'pending') {
    await markJobCancelled(jobId);
    return findJobRowById(jobId);
  }

  if (job.status === 'running') {
    await prisma().baseJob.update({
      where: { id: toUserId(jobId) },
      data: {
        cancelRequested: 1,
        progressMessage: job.progress_message ?? 'Cancel requested',
        updatedAt: new Date(),
      },
    });
    return findJobRowById(jobId);
  }

  return undefined;
};

export const retryFailedJob = async (jobId: number, createdBy?: number | null): Promise<number> => {
  const job = await findJobRowById(jobId);
  if (!job) {
    throw new Error('Job not found.');
  }

  if (job.status !== 'failed' && job.status !== 'cancelled') {
    throw new Error(`Cannot retry job with status "${job.status}".`);
  }

  const envelope = parseServerFunctionJobPayload(job.payload_json);
  if (!envelope?.functionId) {
    throw new Error('Job payload is missing server function reference.');
  }

  return enqueueServerFunctionJob({
    functionId: envelope.functionId,
    title: envelope.title,
    payload: envelope.userPayload,
    metadata: {
      ...envelope.metadata,
      trigger: 'manual',
      retriedFromJobId: jobId,
    },
    createdBy: createdBy ?? null,
  });
};

export const getJobById = async (jobId: number): Promise<JobRecord | undefined> => (
  findJobRowById(jobId)
);

export const findLastJobForScheduledTask = async (scheduledTaskId: string): Promise<JobRecord | undefined> => {
  const rows = await prisma().baseJob.findMany({
    where: { jobType: 'edge_function' },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return rows
    .map(mapJobRecord)
    .find((row) => {
      const envelope = parseServerFunctionJobPayload(row.payload_json);
      return envelope?.metadata.scheduledTaskId === scheduledTaskId;
    });
};

export const countJobsByStatus = async (status: JobStatus): Promise<number> => (
  prisma().baseJob.count({ where: { status } })
);
