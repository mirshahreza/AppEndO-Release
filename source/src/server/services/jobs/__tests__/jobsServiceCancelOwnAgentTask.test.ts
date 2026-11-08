import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../domain/functions/functionRepository', () => ({
  findManagedFunctionById: vi.fn(),
}));

vi.mock('../../../domain/jobs/jobRepository', () => ({
  countJobsByStatus: vi.fn(),
  enqueueServerFunctionJob: vi.fn(),
  getJobById: vi.fn(),
  listActiveJobs: vi.fn(),
  listRecentJobs: vi.fn(),
  parseAgentTaskJobPayload: vi.fn(),
  requestJobCancel: vi.fn(async () => ({ id: 1, status: 'cancelled' })),
  retryFailedJob: vi.fn(),
}));

const baseJob = {
  id: 1,
  job_type: 'agent_task',
  status: 'running' as const,
  progress: 10,
  progress_message: null,
  payload_json: '{}',
  result_json: null,
  error_message: null,
  cancel_requested: 0,
  attempt_count: 1,
  max_attempts: 1,
  queued_at: null,
  started_at: null,
  finished_at: null,
  created_at: '',
  created_by: null,
  updated_at: '',
  updated_by: null,
};

describe('p-102 — JobsService.cancelOwnAgentTask (non-admin, ownership-scoped)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels when the job belongs to the requesting user', async () => {
    const { getJobById, parseAgentTaskJobPayload, requestJobCancel } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    (getJobById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(baseJob);
    (parseAgentTaskJobPayload as ReturnType<typeof vi.fn>).mockReturnValueOnce({ actorUserId: 7 });

    const service = new JobsService();
    const result = await service.cancelOwnAgentTask(1, 7);

    expect(result.body).toEqual({ success: true, item: { id: 1, status: 'cancelled' } });
    expect(requestJobCancel).toHaveBeenCalledWith(1);
  });

  it('returns 404 (not 403) when the job belongs to a different user — avoids leaking existence', async () => {
    const { getJobById, parseAgentTaskJobPayload, requestJobCancel } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    (getJobById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(baseJob);
    (parseAgentTaskJobPayload as ReturnType<typeof vi.fn>).mockReturnValueOnce({ actorUserId: 999 });

    const service = new JobsService();
    const result = await service.cancelOwnAgentTask(1, 7);

    expect(result.statusCode).toBe(404);
    expect(requestJobCancel).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-agent_task job even if it belongs to the user', async () => {
    const { getJobById } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    (getJobById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...baseJob, job_type: 'edge_function' });

    const service = new JobsService();
    const result = await service.cancelOwnAgentTask(1, 7);

    expect(result.statusCode).toBe(404);
  });

  it('returns 400 for a job that already finished', async () => {
    const { getJobById, parseAgentTaskJobPayload } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    (getJobById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...baseJob, status: 'completed' });
    (parseAgentTaskJobPayload as ReturnType<typeof vi.fn>).mockReturnValueOnce({ actorUserId: 7 });

    const service = new JobsService();
    const result = await service.cancelOwnAgentTask(1, 7);

    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when the job does not exist', async () => {
    const { getJobById } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    (getJobById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    const service = new JobsService();
    const result = await service.cancelOwnAgentTask(1, 7);

    expect(result.statusCode).toBe(404);
  });
});
