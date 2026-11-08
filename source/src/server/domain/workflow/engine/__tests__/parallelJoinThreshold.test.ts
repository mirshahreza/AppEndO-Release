import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { registerCoreActionPack } from '../../actions/corePack';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { getBranchTokenById } from '../../workflowBranchTokenRepository';
import { baseModel, parallelSplitNode, parallelJoinNode, actionNode, endNode, unconditionalEdge, mappingOf, lit } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'threshold-join-worker';
const noRetry = { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 0, retryOn: [] };
const trivialTemplateInput = () => mappingOf({ template: lit('ok'), variables: lit({}) });

registerCoreActionPack();

async function publishAndStart(model: ReturnType<typeof baseModel>) {
  const definition = await createTestWorkflowDefinition({ key: uniqueKey('threshold-join'), draftDefinitionJson: JSON.stringify(model) });
  const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
  expect(revision.publicationStatus).toBe('PUBLISHED');
  return startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
}

/** 3-branch split, THRESHOLD(2) join — van der Aalst N-out-of-M / Discriminator pattern (WFV2-18). */
function threeBranchThresholdModel(thresholdCount: number, cancelRemaining?: boolean) {
  return baseModel({
    nodes: [
      parallelSplitNode('split1'),
      actionNode('branchA', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      actionNode('branchB', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      actionNode('branchC', { retryPolicy: noRetry, input: trivialTemplateInput() }),
      parallelJoinNode('join1', 'THRESHOLD', cancelRemaining, thresholdCount),
      endNode('end-1'),
    ],
    edges: [
      unconditionalEdge('e-split-a', 'split1', 'branchA'),
      unconditionalEdge('e-split-b', 'split1', 'branchB'),
      unconditionalEdge('e-split-c', 'split1', 'branchC'),
      unconditionalEdge('e-a-join', 'branchA', 'join1'),
      unconditionalEdge('e-b-join', 'branchB', 'join1'),
      unconditionalEdge('e-c-join', 'branchC', 'join1'),
      unconditionalEdge('e-join-end', 'join1', 'end-1'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'split1' },
  });
}

describe.skipIf(!dbReady)('PARALLEL_JOIN mode THRESHOLD (WFV2-18, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('publish rejects a THRESHOLD join whose thresholdCount is out of 1..branchCount range', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('threshold-bad'), draftDefinitionJson: JSON.stringify(threeBranchThresholdModel(4)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    expect(revision.publicationStatus).toBe('REJECTED');
  });

  it('stays PENDING after only 1 of 3 branches arrive (threshold is 2)', async () => {
    const { instance } = await publishAndStart(threeBranchThresholdModel(2));
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    await dispatchNode({ nodeInstanceId: branchA!.id, leaseOwnerId: leaseOwner });

    const join1 = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(join1!.status).toBe('PENDING');
  });

  it('becomes READY exactly when the 2nd of 3 branches arrives (threshold is 2), 3rd branch left untouched without cancelRemaining', async () => {
    const { instance } = await publishAndStart(threeBranchThresholdModel(2));
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    const branchB = await getNodeInstanceByOccurrence(instance.id, 'branchB');
    await dispatchNode({ nodeInstanceId: branchA!.id, leaseOwnerId: leaseOwner });
    await dispatchNode({ nodeInstanceId: branchB!.id, leaseOwnerId: leaseOwner });

    const join1 = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(join1!.status).toBe('READY');

    const branchC = await getNodeInstanceByOccurrence(instance.id, 'branchC');
    expect(branchC!.status).toBe('READY'); // still runnable — no cancelRemaining requested
  });

  it('with cancelRemaining=true, reaching the threshold cancels the still-pending 3rd branch', async () => {
    const { instance } = await publishAndStart(threeBranchThresholdModel(2, true));
    const split1 = await getNodeInstanceByOccurrence(instance.id, 'split1');
    await dispatchNode({ nodeInstanceId: split1!.id, leaseOwnerId: leaseOwner });

    const branchA = await getNodeInstanceByOccurrence(instance.id, 'branchA');
    const branchB = await getNodeInstanceByOccurrence(instance.id, 'branchB');
    await dispatchNode({ nodeInstanceId: branchA!.id, leaseOwnerId: leaseOwner });
    await dispatchNode({ nodeInstanceId: branchB!.id, leaseOwnerId: leaseOwner });

    const join1 = await getNodeInstanceByOccurrence(instance.id, 'join1');
    expect(join1!.status).toBe('READY');

    const branchC = await getNodeInstanceByOccurrence(instance.id, 'branchC');
    expect(branchC!.status).toBe('CANCELLED');
    const tokenC = await getBranchTokenById(branchC!.branchTokenId!);
    expect(tokenC!.status).toBe('CANCELLED');
  });
});
