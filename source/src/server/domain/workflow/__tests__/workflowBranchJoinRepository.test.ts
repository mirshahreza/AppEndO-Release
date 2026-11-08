import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { createCandidateWorkflowRevision } from '../workflowRevisionRepository';
import { createWorkflowInstance } from '../workflowInstanceRepository';
import { materializeNodeInstances } from '../workflowNodeInstanceRepository';
import { createBranchTokensForSplit } from '../workflowBranchTokenRepository';
import { recordJoinArrival, listJoinArrivalsForNode } from '../workflowJoinArrivalRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowBranchTokenRepository / workflowJoinArrivalRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function makeInstanceWithJoinNode() {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('parallel'), draftDefinitionJson: '{}' });
    const revision = await createCandidateWorkflowRevision({
      workflowDefinitionId: definition.id,
      sourceDraftVersion: 1,
      definitionJson: '{}',
      actionBindingsJson: '{}',
      semanticFingerprint: 'fp',
      bindingStatus: 'NOT_REQUIRED',
    });
    const instance = await createWorkflowInstance({ workflowRevisionId: revision.id, startedByType: 'SYSTEM' });
    const [joinNode] = await materializeNodeInstances(instance.id, ['join']);
    return { instance, joinNode };
  }

  it('unique (workflowInstanceId, splitNodeKey, branchEdgeKey) — a branch edge is tokenized at most once per split', async () => {
    const { instance } = await makeInstanceWithJoinNode();
    await createBranchTokensForSplit(instance.id, [
      { splitNodeKey: 'split', joinNodeKey: 'join', branchEdgeKey: 'edge-a' },
      { splitNodeKey: 'split', joinNodeKey: 'join', branchEdgeKey: 'edge-b' },
    ]);
    await expect(
      createBranchTokensForSplit(instance.id, [{ splitNodeKey: 'split', joinNodeKey: 'join', branchEdgeKey: 'edge-a' }]),
    ).rejects.toThrow();
  });

  it('unique (joinNodeInstanceId, branchTokenId) proves exactly-once arrival under a concurrent double-insert race', async () => {
    const { instance, joinNode } = await makeInstanceWithJoinNode();
    const [token] = await createBranchTokensForSplit(instance.id, [{ splitNodeKey: 'split', joinNodeKey: 'join', branchEdgeKey: 'edge-a' }]);

    const results = await Promise.allSettled([
      recordJoinArrival({ workflowInstanceId: instance.id, joinNodeInstanceId: joinNode.id, branchTokenId: token.id }),
      recordJoinArrival({ workflowInstanceId: instance.id, joinNodeInstanceId: joinNode.id, branchTokenId: token.id }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const arrivals = await listJoinArrivalsForNode(joinNode.id);
    expect(arrivals).toHaveLength(1);
  });
});
