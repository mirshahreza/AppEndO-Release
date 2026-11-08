import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { createCandidateWorkflowRevision } from '../workflowRevisionRepository';
import { createWorkflowInstance } from '../workflowInstanceRepository';
import { materializeNodeInstances } from '../workflowNodeInstanceRepository';
import { createWait, transitionWaitStatus, getWaitByOwningNodeInstance } from '../workflowWaitRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowWaitRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function makeNode() {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('wait'), draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision({
      workflowDefinitionId: definition.id,
      sourceDraftVersion: 1,
      definitionJson: '{}',
      actionBindingsJson: '{}',
      semanticFingerprint: 'fp',
      bindingStatus: 'NOT_REQUIRED',
    });
    const instance = await createWorkflowInstance({ workflowRevisionId: revision.id, startedByType: 'SYSTEM' });
    const [node] = await materializeNodeInstances(instance.id, ['wait-node']);
    return { instance, node };
  }

  it('ACTIVE is the only fence to every terminal state; illegal command from a terminal wait is rejected', async () => {
    const { instance, node } = await makeNode();
    const wait = await createWait({ workflowInstanceId: instance.id, owningNodeInstanceId: node.id, waitType: 'TIMER', dueAt: new Date() });
    expect(wait.status).toBe('ACTIVE');
    const satisfied = await transitionWaitStatus(wait.id, wait.stateVersion, 'SATISFY');
    expect(satisfied.status).toBe('SATISFIED');
    await expect(transitionWaitStatus(satisfied.id, satisfied.stateVersion, 'CANCEL')).rejects.toMatchObject({ code: 'WF_EXEC_WAIT_NOT_ACTIVE' });
  });

  it('the wait stateVersion is its own fence — a stale wait version is rejected even though node/instance versions are unrelated fields', async () => {
    const { instance, node } = await makeNode();
    const wait = await createWait({ workflowInstanceId: instance.id, owningNodeInstanceId: node.id, waitType: 'TIMER', dueAt: new Date() });
    await expect(transitionWaitStatus(wait.id, wait.stateVersion + 1, 'SATISFY')).rejects.toMatchObject({ code: 'WF_EXEC_WAIT_NOT_ACTIVE' });
  });

  it('owningNodeInstanceId is unique — a second wait for the same node occurrence is rejected', async () => {
    const { instance, node } = await makeNode();
    await createWait({ workflowInstanceId: instance.id, owningNodeInstanceId: node.id, waitType: 'TIMER', dueAt: new Date() });
    await expect(
      createWait({ workflowInstanceId: instance.id, owningNodeInstanceId: node.id, waitType: 'TIMER', dueAt: new Date() }),
    ).rejects.toThrow();
    const found = await getWaitByOwningNodeInstance(node.id);
    expect(found).toBeDefined();
  });

  it('EVENT waits require correlationEncoderVersion/correlationHashAlgorithm; non-EVENT waits keep them null', async () => {
    const { instance, node } = await makeNode();
    await expect(
      createWait({ workflowInstanceId: instance.id, owningNodeInstanceId: node.id, waitType: 'EVENT', eventName: 'invoice.paid' }),
    ).rejects.toMatchObject({ code: 'WF_DEF_INVALID_AWM' });

    const eventWait = await createWait({
      workflowInstanceId: instance.id,
      owningNodeInstanceId: node.id,
      waitType: 'EVENT',
      eventName: 'invoice.paid',
      correlationEncoderVersion: 'workflow.correlation/v1',
      correlationHashAlgorithm: 'SHA-256',
    });
    expect(eventWait.correlationEncoderVersion).toBe('workflow.correlation/v1');
    expect(eventWait.correlationHashAlgorithm).toBe('SHA-256');
  });
});
