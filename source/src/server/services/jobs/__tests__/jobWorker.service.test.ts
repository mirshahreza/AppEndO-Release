import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../domain/jobs/jobRepository', () => ({
  claimNextPendingJob: vi.fn(),
  completeJob: vi.fn(async () => {}),
  failJob: vi.fn(async () => {}),
  isJobCancelRequested: vi.fn(async () => false),
  markJobCancelled: vi.fn(async () => {}),
  parseAgentTaskJobPayload: vi.fn(),
  parseServerFunctionJobPayload: vi.fn(),
  updateJobProgress: vi.fn(async () => {}),
}));

vi.mock('../jobServerFunctionExecutor', () => ({
  executeManagedFunctionForJob: vi.fn(async () => ({ statusCode: 200, body: { ok: true } })),
}));

vi.mock('../agentTaskJobExecutor', () => ({
  executeAgentTaskForJob: vi.fn(async () => ({ text: 'done', taskId: 't1', attemptId: 'a1', modelId: 'm', iterationCount: 1 })),
}));

vi.mock('../../../domain/ai/chatHistoryRepository', () => ({
  findChatSessionForUser: vi.fn(),
  updateChatSession: vi.fn(async () => ({})),
}));

vi.mock('../../notifications/notificationDispatch', () => ({
  dispatchNotification: vi.fn(async () => undefined),
}));

describe('V5 P11 § V5-21 — jobWorker.service dispatch (agent_task alongside pre-existing edge_function)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseJob = {
    id: 1,
    status: 'running' as const,
    progress: 5,
    progress_message: null,
    payload_json: '{}',
    result_json: null,
    error_message: null,
    cancel_requested: 0,
    attempt_count: 1,
    max_attempts: 3,
    queued_at: null,
    started_at: null,
    finished_at: null,
    created_at: '',
    created_by: null,
    updated_at: '',
    updated_by: null,
  };

  it('dispatches job_type "agent_task" to executeAgentTaskForJob and completes the job', async () => {
    const { claimNextPendingJob, completeJob, parseAgentTaskJobPayload } = await import('../../../domain/jobs/jobRepository');
    const { executeAgentTaskForJob } = await import('../agentTaskJobExecutor');
    const { executeManagedFunctionForJob } = await import('../jobServerFunctionExecutor');
    const { startJobWorker, stopJobWorker } = await import('../jobWorker.service');

    (claimNextPendingJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...baseJob, job_type: 'agent_task' });
    (parseAgentTaskJobPayload as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      taskId: 't1', attemptId: 'a1', actorUserId: 1, mode: 'agent', messages: [], executionProfile: 'agent_implement',
    });

    startJobWorker({ edgeDbQuery: vi.fn() as never, dataSourcesService: {} as never }, 1_000_000);
    await new Promise((resolve) => setTimeout(resolve, 10));
    stopJobWorker();

    expect(executeAgentTaskForJob).toHaveBeenCalledTimes(1);
    expect(executeManagedFunctionForJob).not.toHaveBeenCalled();
    expect(completeJob).toHaveBeenCalledWith(1, expect.objectContaining({ taskId: 't1' }));
  });

  it('still dispatches job_type "edge_function" to the pre-existing executor — zero regression to the original job kind', async () => {
    const { claimNextPendingJob, completeJob, parseServerFunctionJobPayload } = await import('../../../domain/jobs/jobRepository');
    const { executeManagedFunctionForJob } = await import('../jobServerFunctionExecutor');
    const { executeAgentTaskForJob } = await import('../agentTaskJobExecutor');
    const { startJobWorker, stopJobWorker } = await import('../jobWorker.service');

    (claimNextPendingJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...baseJob, job_type: 'edge_function' });
    (parseServerFunctionJobPayload as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      functionId: 'fn-1', userPayload: {}, metadata: {},
    });

    startJobWorker({ edgeDbQuery: vi.fn() as never, dataSourcesService: {} as never }, 1_000_000);
    await new Promise((resolve) => setTimeout(resolve, 10));
    stopJobWorker();

    expect(executeManagedFunctionForJob).toHaveBeenCalledTimes(1);
    expect(executeAgentTaskForJob).not.toHaveBeenCalled();
    expect(completeJob).toHaveBeenCalledWith(1, { ok: true });
  });

  it('fails an unrecognized job_type with a clear error, same as before this phase', async () => {
    const { claimNextPendingJob, failJob } = await import('../../../domain/jobs/jobRepository');
    const { startJobWorker, stopJobWorker } = await import('../jobWorker.service');

    (claimNextPendingJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...baseJob, job_type: 'something_else' });

    startJobWorker({ edgeDbQuery: vi.fn() as never, dataSourcesService: {} as never }, 1_000_000);
    await new Promise((resolve) => setTimeout(resolve, 10));
    stopJobWorker();

    expect(failJob).toHaveBeenCalledWith(1, expect.stringContaining('Unsupported job type'));
  });

  describe('p-102 — completion write-back + notification', () => {
    it('on success with a sessionId, appends the result to the chat session and notifies the user', async () => {
      const { claimNextPendingJob, parseAgentTaskJobPayload } = await import('../../../domain/jobs/jobRepository');
      const { findChatSessionForUser, updateChatSession } = await import('../../../domain/ai/chatHistoryRepository');
      const { dispatchNotification } = await import('../../notifications/notificationDispatch');
      const { startJobWorker, stopJobWorker } = await import('../jobWorker.service');

      (claimNextPendingJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...baseJob, job_type: 'agent_task' });
      (parseAgentTaskJobPayload as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        taskId: 't1', attemptId: 'a1', actorUserId: 7, sessionId: 99, title: 'My task',
        mode: 'agent', messages: [], executionProfile: 'agent_implement',
      });
      (findChatSessionForUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 99, messages: [{ role: 'user', content: 'do the thing' }],
      });

      startJobWorker({ edgeDbQuery: vi.fn() as never, dataSourcesService: {} as never }, 1_000_000);
      await new Promise((resolve) => setTimeout(resolve, 10));
      stopJobWorker();

      expect(findChatSessionForUser).toHaveBeenCalledWith(99, 7);
      expect(updateChatSession).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 99,
        userId: 7,
        messages: [
          { role: 'user', content: 'do the thing' },
          { role: 'assistant', content: 'done' },
        ],
      }));
      expect(dispatchNotification).toHaveBeenCalledWith(expect.objectContaining({
        userId: 7,
        title: 'My task',
        body: 'done',
        severity: 'info',
        eventType: 'agent_task',
      }));
    });

    it('without a sessionId, skips the write-back but still notifies the user', async () => {
      const { claimNextPendingJob, parseAgentTaskJobPayload } = await import('../../../domain/jobs/jobRepository');
      const { findChatSessionForUser } = await import('../../../domain/ai/chatHistoryRepository');
      const { dispatchNotification } = await import('../../notifications/notificationDispatch');
      const { startJobWorker, stopJobWorker } = await import('../jobWorker.service');

      (claimNextPendingJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...baseJob, job_type: 'agent_task' });
      (parseAgentTaskJobPayload as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        taskId: 't1', attemptId: 'a1', actorUserId: 7, mode: 'agent', messages: [], executionProfile: 'agent_implement',
      });

      startJobWorker({ edgeDbQuery: vi.fn() as never, dataSourcesService: {} as never }, 1_000_000);
      await new Promise((resolve) => setTimeout(resolve, 10));
      stopJobWorker();

      expect(findChatSessionForUser).not.toHaveBeenCalled();
      expect(dispatchNotification).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }));
    });

    it('on failure, notifies the user with an error severity and skips the session write-back', async () => {
      const { claimNextPendingJob, parseAgentTaskJobPayload, failJob } = await import('../../../domain/jobs/jobRepository');
      const { findChatSessionForUser } = await import('../../../domain/ai/chatHistoryRepository');
      const { dispatchNotification } = await import('../../notifications/notificationDispatch');
      const { executeAgentTaskForJob } = await import('../agentTaskJobExecutor');
      const { startJobWorker, stopJobWorker } = await import('../jobWorker.service');

      (claimNextPendingJob as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...baseJob, job_type: 'agent_task' });
      (parseAgentTaskJobPayload as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        taskId: 't1', attemptId: 'a1', actorUserId: 7, sessionId: 99, mode: 'agent', messages: [], executionProfile: 'agent_implement',
      });
      (executeAgentTaskForJob as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));

      startJobWorker({ edgeDbQuery: vi.fn() as never, dataSourcesService: {} as never }, 1_000_000);
      await new Promise((resolve) => setTimeout(resolve, 10));
      stopJobWorker();

      expect(failJob).toHaveBeenCalledWith(1, 'boom');
      expect(findChatSessionForUser).not.toHaveBeenCalled();
      expect(dispatchNotification).toHaveBeenCalledWith(expect.objectContaining({
        userId: 7,
        severity: 'error',
        body: 'boom',
        eventType: 'agent_task',
      }));
    });
  });
});
