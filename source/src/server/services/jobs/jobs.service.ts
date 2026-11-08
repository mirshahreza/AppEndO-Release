import { randomUUID } from 'node:crypto';
import { findManagedFunctionById } from '../../domain/functions/functionRepository';
import {
  countJobsByStatus,
  enqueueAgentTaskJob,
  enqueueServerFunctionJob,
  getJobById,
  listActiveJobs,
  listRecentJobs,
  parseAgentTaskJobPayload,
  requestJobCancel,
  retryFailedJob,
} from '../../domain/jobs/jobRepository';
import type { EnqueueServerFunctionJobInput, JobStatus } from '../../domain/jobs/jobTypes';
import { normalizeAgentRunRequest } from '../../../shared/api/contracts/ai/agentValidators';
import { AiValidationError } from '../../../shared/api/contracts/ai/errors';

const parseStatusFilter = (raw: unknown): JobStatus[] | undefined => {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const allowed: JobStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];
  const values = raw.split(',').map((item) => item.trim()).filter(Boolean) as JobStatus[];
  const filtered = values.filter((item) => allowed.includes(item));
  return filtered.length > 0 ? filtered : undefined;
};

export class JobsService {
  async list(limit = 100, statusFilter?: JobStatus[]) {
    const items = await listRecentJobs(limit, statusFilter);
    const pendingCount = await countJobsByStatus('pending');
    const runningCount = await countJobsByStatus('running');

    return {
      body: {
        success: true as const,
        items,
        stats: {
          pending: pendingCount,
          running: runningCount,
        },
      },
    };
  }

  async getById(jobId: number) {
    const item = await getJobById(jobId);
    if (!item) {
      return {
        statusCode: 404,
        body: { success: false as const, error: 'Job not found.' },
      };
    }

    return {
      body: {
        success: true as const,
        item,
      },
    };
  }

  async enqueue(input: EnqueueServerFunctionJobInput) {
    const managed = await findManagedFunctionById(input.functionId);
    if (!managed) {
      return {
        statusCode: 400,
        body: { success: false as const, error: `Function "${input.functionId}" was not found.` },
      };
    }

    const id = await enqueueServerFunctionJob({
      ...input,
      metadata: {
        source: 'manual',
        trigger: 'manual',
        triggeredAt: new Date().toISOString(),
        ...input.metadata,
      },
    });

    return {
      statusCode: 201,
      body: {
        success: true as const,
        id,
      },
    };
  }

  async cancel(jobId: number) {
    const existing = await getJobById(jobId);
    if (!existing) {
      return {
        statusCode: 404,
        body: { success: false as const, error: 'Job not found.' },
      };
    }

    if (existing.status === 'completed' || existing.status === 'failed' || existing.status === 'cancelled') {
      return {
        statusCode: 400,
        body: { success: false as const, error: `Cannot cancel job with status "${existing.status}".` },
      };
    }

    const item = await requestJobCancel(jobId);
    return {
      body: {
        success: true as const,
        item,
      },
    };
  }

  /**
   * p-102 — non-admin enqueue of a background agent task, scoped to the caller. Reuses
   * `normalizeAgentRunRequest` (the same validator the synchronous `/api/ai/agent/run` route
   * uses) so a background request is validated identically to a live one, not by a separate,
   * looser ad-hoc check. Capability-pack/MCP scope is snapshotted here but re-resolved fresh
   * against current grants when the job actually executes (`resolveAgentRunContext`, called from
   * `agentTaskJobExecutor.ts`) — never trusted as-is from enqueue time.
   */
  async enqueueOwnAgentTask(body: unknown, actorUserId: number) {
    let request;
    try {
      request = normalizeAgentRunRequest(body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        return { statusCode: 400, body: { success: false as const, error: error.message } };
      }
      throw error;
    }

    if (request.mode !== 'agent') {
      return {
        statusCode: 400,
        body: { success: false as const, error: 'Running in the background is only available in Agent mode.' },
      };
    }

    const title = typeof (body as { title?: unknown })?.title === 'string'
      ? (body as { title: string }).title.trim() || undefined
      : undefined;

    const taskId = randomUUID();
    const attemptId = randomUUID();

    try {
      const jobId = await enqueueAgentTaskJob({
        taskId,
        attemptId,
        actorUserId,
        sessionId: request.sessionId,
        mode: request.mode,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
          toolCallId: message.toolCallId,
          name: message.name,
        })),
        executionProfile: 'agent_implement',
        modelId: request.modelId,
        pageContext: request.pageContext as Record<string, unknown> | undefined,
        enabledCapabilityPackIds: request.enabledCapabilityPackIds,
        enabledMcpServerIds: request.enabledMcpServerIds,
        title,
        createdBy: actorUserId,
      });

      return {
        statusCode: 201,
        body: { success: true as const, jobId, taskId, attemptId },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start background task.';
      return {
        statusCode: 429,
        body: { success: false as const, error: message },
      };
    }
  }

  /**
   * p-102 — non-admin cancel, scoped to the caller's own background agent task. The `/api/jobs`
   * router is entirely `requireRole('ADMIN')`-gated at the mount level (see `jobs.routes.ts`), so
   * an ordinary user has no way to cancel a job they themselves started; this reuses the exact
   * same `cancel_requested` mechanism `cancel()` above uses, just with an ownership check instead
   * of an admin-role check.
   */
  async cancelOwnAgentTask(jobId: number, actorUserId: number) {
    const existing = await getJobById(jobId);
    if (!existing) {
      return {
        statusCode: 404,
        body: { success: false as const, error: 'Job not found.' },
      };
    }

    if (existing.job_type !== 'agent_task') {
      return {
        statusCode: 404,
        body: { success: false as const, error: 'Job not found.' },
      };
    }

    const envelope = parseAgentTaskJobPayload(existing.payload_json);
    if (!envelope || envelope.actorUserId !== actorUserId) {
      return {
        statusCode: 404,
        body: { success: false as const, error: 'Job not found.' },
      };
    }

    if (existing.status === 'completed' || existing.status === 'failed' || existing.status === 'cancelled') {
      return {
        statusCode: 400,
        body: { success: false as const, error: `Cannot cancel job with status "${existing.status}".` },
      };
    }

    const item = await requestJobCancel(jobId);
    return {
      body: {
        success: true as const,
        item,
      },
    };
  }

  async retry(jobId: number, createdBy?: number | null) {
    try {
      const id = await retryFailedJob(jobId, createdBy);
      return {
        statusCode: 201,
        body: {
          success: true as const,
          id,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retry job.';
      const statusCode = message.includes('not found') ? 404 : 400;
      return {
        statusCode,
        body: { success: false as const, error: message },
      };
    }
  }

  async streamSnapshot() {
    const items = await listActiveJobs(100);
    const pendingCount = await countJobsByStatus('pending');
    const runningCount = await countJobsByStatus('running');

    return {
      items,
      stats: {
        pending: pendingCount,
        running: runningCount,
      },
    };
  }

  parseStatusFilter(raw: unknown) {
    return parseStatusFilter(raw);
  }
}
