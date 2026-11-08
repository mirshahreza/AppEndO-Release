import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeGetJob,
  executeListJobs,
  executeRunJob,
  GET_JOB_TOOL_NAME,
  LIST_JOBS_TOOL_NAME,
  RUN_JOB_TOOL_NAME,
} from '../jobsTools';

const mockJobs = [
  {
    id: 42,
    job_type: 'edge_function',
    status: 'completed',
    progress: 100,
    progress_message: 'Done',
    payload_json: '{"functionId":"custom.hello"}',
    result_json: null,
    error_message: null,
    cancel_requested: 0,
    attempt_count: 1,
    max_attempts: 3,
    queued_at: '2026-06-15T10:00:00.000Z',
    started_at: '2026-06-15T10:00:01.000Z',
    finished_at: '2026-06-15T10:00:02.000Z',
    created_at: '2026-06-15T10:00:00.000Z',
    created_by: 1,
    updated_at: '2026-06-15T10:00:02.000Z',
    updated_by: 1,
  },
];

vi.mock('../../../../../domain/jobs/jobRepository', () => ({
  listRecentJobs: vi.fn(async () => mockJobs),
  getJobById: vi.fn(async (jobId: number) => mockJobs.find((job) => job.id === jobId)),
  enqueueServerFunctionJob: vi.fn(async () => 99),
}));

vi.mock('../../../../../domain/functions/functionRepository', () => ({
  findManagedFunctionById: vi.fn(async (functionId: string) => (
    functionId === 'custom.hello'
      ? { id: functionId, name: 'Hello', method: 'GET', path: '/api/custom/hello' }
      : null
  )),
}));

describe('appendo-jobs pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers jobs pack tools', () => {
    const registry = createPhase1ToolRegistry('agent', ['jobs']);
    registerBuiltinCapabilityPacks(registry, ['appendo-jobs']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-jobs').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('lists recent jobs', async () => {
    const result = await executeListJobs({ limit: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.totalCount).toBe(1);
      expect(result.data?.items[0]?.id).toBe(42);
    }
  });

  it('loads a job by id', async () => {
    const result = await executeGetJob({ jobId: 42 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.item.id).toBe(42);
    }
  });

  it('enqueues run_job for a managed function', async () => {
    const result = await executeRunJob({ functionId: 'custom.hello', payload: { name: 'test' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.jobId).toBe(99);
    }
  });

  it('exposes catalog tool names', () => {
    expect(LIST_JOBS_TOOL_NAME).toBe('list_jobs');
    expect(GET_JOB_TOOL_NAME).toBe('get_job');
    expect(RUN_JOB_TOOL_NAME).toBe('run_job');
  });
});
