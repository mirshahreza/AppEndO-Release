import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { createCandidateWorkflowRevision } from '../workflowRevisionRepository';
import { createWorkflowInstance } from '../workflowInstanceRepository';
import { appendTrace, listTraceByInstance } from '../workflowTraceRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowTraceRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function makeInstance() {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('trace'), draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision({
      workflowDefinitionId: definition.id,
      sourceDraftVersion: 1,
      definitionJson: '{}',
      actionBindingsJson: '{}',
      semanticFingerprint: 'fp',
      bindingStatus: 'NOT_REQUIRED',
    });
    return createWorkflowInstance({ workflowRevisionId: revision.id, startedByType: 'SYSTEM' });
  }

  it('allocates monotonic sequenceNumbers unique per (instanceId, sequenceNumber)', async () => {
    const instance = await makeInstance();
    const first = await appendTrace({ workflowInstanceId: instance.id, traceType: 'INSTANCE_STARTED', actorType: 'SYSTEM', coreEvidenceJson: '{}' });
    const second = await appendTrace({ workflowInstanceId: instance.id, traceType: 'NODE_READY', actorType: 'SYSTEM', coreEvidenceJson: '{}' });
    expect(first.sequenceNumber).toBe(1);
    expect(second.sequenceNumber).toBe(2);
  });

  it('read-back ordering is sequenceNumber ASC even when occurredAt is out of order', async () => {
    const instance = await makeInstance();
    const early = await appendTrace({
      workflowInstanceId: instance.id,
      traceType: 'INSTANCE_STARTED',
      actorType: 'SYSTEM',
      coreEvidenceJson: '{}',
    });
    const later = await appendTrace({
      workflowInstanceId: instance.id,
      traceType: 'INSTANCE_SUCCEEDED',
      actorType: 'SYSTEM',
      coreEvidenceJson: '{}',
    });
    const rows = await listTraceByInstance(instance.id);
    expect(rows.map((r) => r.id)).toEqual([early.id, later.id]);
    expect(rows.map((r) => r.sequenceNumber)).toEqual([1, 2]);
  });
});
