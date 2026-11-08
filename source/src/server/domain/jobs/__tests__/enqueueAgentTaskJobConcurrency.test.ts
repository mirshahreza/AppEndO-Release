import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  baseJob: {
    findMany: vi.fn(),
    create: vi.fn(async () => ({ id: BigInt(1) })),
  },
}));

vi.mock('../../users/prismaHelpers', () => ({
  prisma: () => prismaMock,
  toUserId: (value: number) => BigInt(value),
  fromUserId: (value: bigint | number) => Number(value),
}));

const baseInput = {
  taskId: 'task-1',
  attemptId: 'attempt-1',
  actorUserId: 42,
  mode: 'agent' as const,
  messages: [{ role: 'user' as const, content: 'do the thing' }],
  executionProfile: 'agent_implement',
};

describe('p-102 — enqueueAgentTaskJob per-user concurrency cap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues normally when the user has no active agent_task jobs', async () => {
    prismaMock.baseJob.findMany.mockResolvedValueOnce([]);
    const { enqueueAgentTaskJob } = await import('../jobRepository');

    const jobId = await enqueueAgentTaskJob(baseInput);

    expect(jobId).toBe(1);
    expect(prismaMock.baseJob.create).toHaveBeenCalledTimes(1);
  });

  it('enqueues when the user is under the cap (1 of 2 active)', async () => {
    prismaMock.baseJob.findMany.mockResolvedValueOnce([
      { payloadJson: JSON.stringify({ ...baseInput, taskId: 'other' }) },
    ]);
    const { enqueueAgentTaskJob } = await import('../jobRepository');

    await expect(enqueueAgentTaskJob(baseInput)).resolves.toBe(1);
  });

  it('rejects once the user already has 2 active agent_task jobs', async () => {
    prismaMock.baseJob.findMany.mockResolvedValueOnce([
      { payloadJson: JSON.stringify({ ...baseInput, taskId: 'a' }) },
      { payloadJson: JSON.stringify({ ...baseInput, taskId: 'b' }) },
    ]);
    const { enqueueAgentTaskJob } = await import('../jobRepository');

    await expect(enqueueAgentTaskJob(baseInput)).rejects.toThrow(/already have 2 background agent task/i);
    expect(prismaMock.baseJob.create).not.toHaveBeenCalled();
  });

  it('does not count another user\'s active jobs against this user\'s cap', async () => {
    prismaMock.baseJob.findMany.mockResolvedValueOnce([
      { payloadJson: JSON.stringify({ ...baseInput, actorUserId: 999, taskId: 'a' }) },
      { payloadJson: JSON.stringify({ ...baseInput, actorUserId: 999, taskId: 'b' }) },
    ]);
    const { enqueueAgentTaskJob } = await import('../jobRepository');

    await expect(enqueueAgentTaskJob(baseInput)).resolves.toBe(1);
  });
});
