import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../../domain/workflow/workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../../domain/workflow/publication/workflowPublicationService';
import { getWorkflowInstanceById } from '../../../domain/workflow/workflowInstanceRepository';
import { baseModel, endNode } from '../../../domain/workflow/engine/__tests__/fixtures';
import { executeManagedFunctionForJob } from '../jobServerFunctionExecutor';
import { RESERVED_SCHEDULED_START_FUNCTION_ID } from '../../../domain/workflow/publication/bindingAdapters/scheduleBindingAdapter';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const unusedDbQuery = async () => ({ data: [], count: 0 });

/**
 * WFV2-3 — proves the reserved `workflow-engine.scheduled-start` functionId is intercepted natively
 * (never runs through the sandbox) and actually starts a real, durable Workflow instance — closing
 * the gap p-61/p-62 flagged (SCHEDULE start-binding was type-checked but never actually fired).
 */
describe.skipIf(!dbReady)('executeManagedFunctionForJob — reserved SCHEDULE-start native intercept (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const publishMinimalWorkflow = async () => {
    const model = baseModel({ nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('scheduled-start-native'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('PUBLISHED');
    return revision;
  };

  it('starts a real workflow instance directly, without compiling/running any sandbox code', async () => {
    const revision = await publishMinimalWorkflow();

    const result = await executeManagedFunctionForJob(
      RESERVED_SCHEDULED_START_FUNCTION_ID,
      { workflowRevisionId: revision.id },
      unusedDbQuery,
    );

    expect(result.statusCode).toBe(200);
    const body = result.body as { success: boolean; instanceId: number };
    expect(body.success).toBe(true);

    const instance = await getWorkflowInstanceById(body.instanceId);
    expect(instance?.status).toBe('RUNNING');
    expect(instance?.startedByType).toBe('SYSTEM');
    expect(instance?.startType).toBe('SCHEDULE');
  });

  it('throws (fails the job) when the payload is missing a numeric workflowRevisionId', async () => {
    await expect(
      executeManagedFunctionForJob(RESERVED_SCHEDULED_START_FUNCTION_ID, {}, unusedDbQuery),
    ).rejects.toThrow(/workflowRevisionId/);
  });

  it('propagates a real WF_DEF_NOT_STARTABLE rejection for a revision that does not exist', async () => {
    await expect(
      executeManagedFunctionForJob(RESERVED_SCHEDULED_START_FUNCTION_ID, { workflowRevisionId: 999_999_999 }, unusedDbQuery),
    ).rejects.toMatchObject({ code: 'WF_DEF_NOT_STARTABLE' });
  });
});
