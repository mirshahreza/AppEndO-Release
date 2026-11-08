import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../domain/functions/functionRepository', () => ({
  findManagedFunctionById: vi.fn(),
}));

vi.mock('../../../domain/jobs/jobRepository', () => ({
  countJobsByStatus: vi.fn(),
  enqueueAgentTaskJob: vi.fn(async () => 1),
  enqueueServerFunctionJob: vi.fn(),
  getJobById: vi.fn(),
  listActiveJobs: vi.fn(),
  listRecentJobs: vi.fn(),
  parseAgentTaskJobPayload: vi.fn(),
  requestJobCancel: vi.fn(),
  retryFailedJob: vi.fn(),
}));

const baseBody = {
  mode: 'agent' as const,
  messages: [{ role: 'user' as const, content: 'refactor the export pipeline' }],
};

describe('p-102 — JobsService.enqueueOwnAgentTask (non-admin, self-scoped enqueue)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues a background agent task for a valid Agent-mode request', async () => {
    const { enqueueAgentTaskJob } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    const service = new JobsService();
    const result = await service.enqueueOwnAgentTask(baseBody, 7);

    expect(result.statusCode).toBe(201);
    expect(result.body).toEqual(expect.objectContaining({ success: true, jobId: 1 }));
    expect((result.body as { taskId?: string }).taskId).toEqual(expect.any(String));
    expect((result.body as { attemptId?: string }).attemptId).toEqual(expect.any(String));

    expect(enqueueAgentTaskJob).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 7,
      createdBy: 7,
      mode: 'agent',
      executionProfile: 'agent_implement',
      messages: [{ role: 'user', content: 'refactor the export pipeline', toolCallId: undefined, name: undefined }],
    }));
  });

  it('rejects ask/plan mode — background execution is Agent-mode only per the p-102 design', async () => {
    const { enqueueAgentTaskJob } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    const service = new JobsService();
    const result = await service.enqueueOwnAgentTask({ ...baseBody, mode: 'ask' }, 7);

    expect(result.statusCode).toBe(400);
    expect(enqueueAgentTaskJob).not.toHaveBeenCalled();
  });

  it('rejects an invalid request body with a 400, not a throw', async () => {
    const { JobsService } = await import('../jobs.service');
    const service = new JobsService();

    const result = await service.enqueueOwnAgentTask({ mode: 'agent', messages: [] }, 7);

    expect(result.statusCode).toBe(400);
  });

  it('propagates the repository concurrency-cap error as a 429, not a 500', async () => {
    const { enqueueAgentTaskJob } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    (enqueueAgentTaskJob as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('You already have 2 background agent task(s) in progress (limit 2).'),
    );

    const service = new JobsService();
    const result = await service.enqueueOwnAgentTask(baseBody, 7);

    expect(result.statusCode).toBe(429);
    expect((result.body as { error?: string }).error).toMatch(/already have 2/);
  });

  it('passes sessionId + capability/MCP scope through to the envelope untouched', async () => {
    const { enqueueAgentTaskJob } = await import('../../../domain/jobs/jobRepository');
    const { JobsService } = await import('../jobs.service');

    const service = new JobsService();
    await service.enqueueOwnAgentTask({
      ...baseBody,
      sessionId: 99,
      enabledCapabilityPackIds: ['appendo-files'],
      enabledMcpServerIds: ['mcp-1'],
      title: 'My background task',
    }, 7);

    expect(enqueueAgentTaskJob).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 99,
      enabledCapabilityPackIds: ['appendo-files'],
      enabledMcpServerIds: ['mcp-1'],
      title: 'My background task',
    }));
  });
});
