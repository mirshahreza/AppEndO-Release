import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { createCandidateWorkflowRevision } from '../workflowRevisionRepository';
import { createWorkflowInstance } from '../workflowInstanceRepository';
import { materializeNodeInstances, getNodeInstanceByOccurrence, claimReadyOrRetryingNode, transitionNodeInstanceStatus } from '../workflowNodeInstanceRepository';
import { createStartedAttempt } from '../workflowExecutionAttemptRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowNodeInstanceRepository / workflowExecutionAttemptRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function makeInstance() {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('node'), draftDefinitionJson: '{}' });
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

  it('enforces the unique (workflowInstanceId, semanticNodeKey) node-occurrence fence', async () => {
    const instance = await makeInstance();
    await materializeNodeInstances(instance.id, ['start', 'approve']);
    await expect(materializeNodeInstances(instance.id, ['start'])).rejects.toThrow();
    const found = await getNodeInstanceByOccurrence(instance.id, 'approve');
    expect(found?.status).toBe('PENDING');
  });

  it('concurrent claim race on one READY node: exactly one caller wins', async () => {
    const instance = await makeInstance();
    const [node] = await materializeNodeInstances(instance.id, ['start']);
    const ready = await transitionNodeInstanceStatus(node.id, node.stateVersion, 'ELIGIBILITY_SATISFIED');
    expect(ready.status).toBe('READY');

    const results = await Promise.allSettled([
      claimReadyOrRetryingNode(ready.id, ready.stateVersion, 'worker-a', 30_000),
      claimReadyOrRetryingNode(ready.id, ready.stateVersion, 'worker-b', 30_000),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
  });

  it('attempt sequencing is unique within one node instance (nodeInstanceId, attemptNumber)', async () => {
    const instance = await makeInstance();
    const [node] = await materializeNodeInstances(instance.id, ['action-node']);
    const first = await createStartedAttempt({
      workflowInstanceId: instance.id,
      nodeInstanceId: node.id,
      logicalInvocationId: 'logical-1',
      idempotencyKey: 'idem-1',
    });
    const second = await createStartedAttempt({
      workflowInstanceId: instance.id,
      nodeInstanceId: node.id,
      logicalInvocationId: 'logical-2',
      idempotencyKey: 'idem-2',
    });
    expect(first.attemptNumber).toBe(1);
    expect(second.attemptNumber).toBe(2);
  });
});
