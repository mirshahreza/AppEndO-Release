import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../publication/workflowPublicationService';
import { startWorkflowInstance } from '../engine/startService';
import { dispatchNode } from '../engine/dispatchService';
import { getNodeInstanceByOccurrence } from '../workflowNodeInstanceRepository';
import { listDeadLetters, resolveDeadLetter } from '../workflowDeadLetterRepository';
import { baseModel, endNode, actionNode, unconditionalEdge } from '../publication/__tests__/fixtures';
import { registerCoreActionPack } from '../actions/corePack';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!dbReady)('WFV2-12 dead-letter park (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
    registerCoreActionPack();
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('parks an OPEN dead letter when an ACTION fails with no ON_ERROR edge', async () => {
    const key = uniqueKey('dlq');
    // Default actionNode uses test.noop which fails deterministically (same pattern as WFV2-1 tests).
    const model = baseModel({
      key,
      name: key,
      nodes: [
        actionNode('fail-act', { retryPolicy: { maxAttempts: 1, strategy: 'FIXED', initialDelayMs: 0, retryOn: [] } }),
        endNode('end-1'),
      ],
      edges: [unconditionalEdge('e1', 'fail-act', 'end-1')],
      start: { type: 'MANUAL_API', targetNodeKey: 'fail-act' },
    });

    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({
      workflowRevisionId: revision.id,
      input: {},
      startedByType: 'USER',
      startedById: 1,
    });

    const actionNodeInstance = await getNodeInstanceByOccurrence(instance.id, 'fail-act');
    expect(actionNodeInstance).toBeTruthy();

    await dispatchNode({ nodeInstanceId: actionNodeInstance!.id, leaseOwnerId: 'dead-letter-test' });

    const open = await listDeadLetters({ status: 'OPEN' });
    const parked = open.find((d) => d.workflowInstanceId === instance.id && d.nodeKey === 'fail-act');
    expect(parked).toBeTruthy();
    expect(parked!.status).toBe('OPEN');
    expect(parked!.errorCode).toBeTruthy();

    const resolved = await resolveDeadLetter({
      deadLetterId: parked!.id,
      expectedStateVersion: parked!.stateVersion,
      resolution: 'RESOLVED',
      resolvedByUserId: 1,
      resolutionNote: 'acknowledged in test',
    });
    expect(resolved.status).toBe('RESOLVED');
  });
});
