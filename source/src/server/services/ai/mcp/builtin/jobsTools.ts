import type { NativeToolDefinition } from '../../../../../core/ai/tools/ToolRegistry';
import type { ToolExecutionContext } from '../../../../../core/ai/agent/types';
import type { JobStatus } from '../../../../domain/jobs/jobTypes';
import { enqueueServerFunctionJob, getJobById, listRecentJobs } from '../../../../domain/jobs/jobRepository';
import { findManagedFunctionById } from '../../../../domain/functions/functionRepository';

export const LIST_JOBS_TOOL_NAME = 'list_jobs';
export const GET_JOB_TOOL_NAME = 'get_job';
export const RUN_JOB_TOOL_NAME = 'run_job';

const parseStatusFilter = (raw: unknown): JobStatus[] | undefined => {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const allowed: JobStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];
  const values = raw.split(',').map((item) => item.trim()).filter(Boolean) as JobStatus[];
  const filtered = values.filter((item) => allowed.includes(item));
  return filtered.length > 0 ? filtered : undefined;
};

const resolveActorId = (_context?: ToolExecutionContext): number | null => null;

export const executeListJobs = async (args: Record<string, unknown>) => {
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
  const status = parseStatusFilter(args.status);
  const items = await listRecentJobs(limit, status);

  return {
    ok: true as const,
    summary: status?.length
      ? `Listed ${items.length} job(s) with status filter.`
      : `Listed ${items.length} recent job(s).`,
    data: {
      items: items.map((item) => ({
        id: item.id,
        jobType: item.job_type,
        status: item.status,
        progress: item.progress,
        progressMessage: item.progress_message,
        queuedAt: item.queued_at,
        startedAt: item.started_at,
        finishedAt: item.finished_at,
        createdAt: item.created_at,
      })),
      totalCount: items.length,
    },
  };
};

export const executeGetJob = async (args: Record<string, unknown>) => {
  const jobId = Number(args.jobId);
  if (!Number.isFinite(jobId) || jobId < 1) {
    return {
      ok: false as const,
      summary: 'jobId must be a positive number.',
      error: 'invalid_job_id',
    };
  }

  const item = await getJobById(jobId);
  if (!item) {
    return {
      ok: false as const,
      summary: `Job #${jobId} was not found.`,
      error: 'job_not_found',
    };
  }

  return {
    ok: true as const,
    summary: `Loaded job #${jobId} (${item.status}).`,
    data: { item },
  };
};

export const executeRunJob = async (
  args: Record<string, unknown>,
  context?: ToolExecutionContext,
) => {
  const functionId = typeof args.functionId === 'string' ? args.functionId.trim() : '';
  if (!functionId) {
    return {
      ok: false as const,
      summary: 'functionId is required to enqueue an edge-function job.',
      error: 'missing_function_id',
    };
  }

  const managed = await findManagedFunctionById(functionId);
  if (!managed) {
    return {
      ok: false as const,
      summary: `Function "${functionId}" was not found.`,
      error: 'function_not_found',
    };
  }

  let payload: Record<string, unknown> = {};
  if (args.payload !== undefined) {
    if (!args.payload || typeof args.payload !== 'object' || Array.isArray(args.payload)) {
      return {
        ok: false as const,
        summary: 'payload must be a JSON object when provided.',
        error: 'invalid_payload',
      };
    }
    payload = args.payload as Record<string, unknown>;
  }

  const title = typeof args.title === 'string' && args.title.trim()
    ? args.title.trim()
    : managed.name;

  const id = await enqueueServerFunctionJob({
    functionId,
    title,
    payload,
    metadata: {
      source: 'manual',
      trigger: 'manual',
      triggeredAt: new Date().toISOString(),
    },
    createdBy: resolveActorId(context),
  });

  return {
    ok: true as const,
    summary: `Enqueued job #${id} for function "${functionId}".`,
    data: { jobId: id, functionId, title },
  };
};

export const createJobsTools = (): NativeToolDefinition[] => [
  {
    name: LIST_JOBS_TOOL_NAME,
    description: 'List recent background jobs with optional status filter (pending,running,completed,failed,cancelled).',
    group: 'jobs',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows to return (1–200, default 50).' },
        status: { type: 'string', description: 'Comma-separated status filter.' },
      },
    },
    execute: async (args) => executeListJobs(args),
  },
  {
    name: GET_JOB_TOOL_NAME,
    description: 'Load a single job record by numeric id.',
    group: 'jobs',
    parameters: {
      type: 'object',
      properties: {
        jobId: { type: 'number', description: 'Job id from list_jobs.' },
      },
      required: ['jobId'],
    },
    execute: async (args) => executeGetJob(args),
  },
  {
    name: RUN_JOB_TOOL_NAME,
    description: 'Enqueue an edge-function job for a managed function (manual trigger).',
    group: 'jobs',
    parameters: {
      type: 'object',
      properties: {
        functionId: { type: 'string', description: 'Managed server function id.' },
        title: { type: 'string', description: 'Optional job title.' },
        payload: { type: 'object', description: 'Optional JSON payload passed to the function.' },
      },
      required: ['functionId'],
    },
    execute: async (args, context) => executeRunJob(args, context),
  },
];
