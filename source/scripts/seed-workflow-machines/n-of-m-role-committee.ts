/**
 * p-89 WFM-05 — `n-of-m-role-committee`
 * 3 voter Work Items (DEVELOPER users) + PARALLEL_JOIN THRESHOLD 2.
 * Run: `npx tsx scripts/seed-workflow-machines/n-of-m-role-committee.ts`
 */
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import { scanAndRunDueEscalations } from '../../src/server/domain/workflow/engine/workItemEscalationService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  parallelSplitNode, parallelJoinNode, lit, workflowInputPath, workflowVariable, nodeOutput,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickRoleMembers, pickUnlockedUser,
  dispatchUntilAllWaiting, completeWi, drainAutomated, assertEnd,
} from './_seedHelpers';

const KEY = 'n-of-m-role-committee';

function buildModel(voterIds: [number, number, number]): WorkflowModel {
  const [a, b, c] = voterIds;
  const proposalInput = {
    type: 'OBJECT' as const,
    fields: {
      proposal: { type: 'EXPRESSION' as const, expression: workflowInputPath(['proposal']) },
      requesterUserId: { type: 'EXPRESSION' as const, expression: workflowInputPath(['requesterUserId']) },
    },
  };
  return baseModel({
    key: KEY,
    name: 'N-of-M role committee',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: { requesterUserId: { type: 'integer' }, proposal: { type: 'string' } },
        required: ['requesterUserId', 'proposal'],
      },
    },
    nodes: [
      parallelSplitNode('ps-vote'),
      workItemNode('voter-a', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'USER', userId: String(a) },
        allowedOutcomes: ['APPROVE'],
        title: lit('Committee vote A'),
        input: proposalInput,
      }),
      workItemNode('voter-b', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'USER', userId: String(b) },
        allowedOutcomes: ['APPROVE'],
        title: lit('Committee vote B'),
        input: proposalInput,
      }),
      workItemNode('voter-c', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'USER', userId: String(c) },
        allowedOutcomes: ['APPROVE'],
        title: lit('Committee vote C'),
        input: proposalInput,
      }),
      parallelJoinNode('pj-threshold', 'THRESHOLD', true, 2),
      endNode('end-passed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('PASSED') } },
      }),
    ],
    edges: [
      unconditionalEdge('e-ps-a', 'ps-vote', 'voter-a'),
      unconditionalEdge('e-ps-b', 'ps-vote', 'voter-b'),
      unconditionalEdge('e-ps-c', 'ps-vote', 'voter-c'),
      workItemOutcomeEdge('e-a-ok', 'voter-a', 'pj-threshold', 'APPROVE'),
      workItemOutcomeEdge('e-b-ok', 'voter-b', 'pj-threshold', 'APPROVE'),
      workItemOutcomeEdge('e-c-ok', 'voter-c', 'pj-threshold', 'APPROVE'),
      unconditionalEdge('e-join-end', 'pj-threshold', 'end-passed'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'ps-vote' },
  });
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const members = await pickRoleMembers('DEVELOPER', 3);
  const voters: [number, number, number] = [members[0]!.userId, members[1]!.userId, members[2]!.userId];
  console.log(`[seed] voters: ${voters.join(', ')}`);
  const { revisionId } = await ensurePublished(KEY, buildModel(voters));
  const requester = await pickUnlockedUser();
  if (!requester) throw new Error('no requester');

  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { requesterUserId: requester.userId, proposal: 'Adopt workspace retention policy' },
    startedByType: 'USER',
    startedById: requester.userId,
  });
  console.log(`[seed] instance #${instance.id}`);

  const keys = ['voter-a', 'voter-b', 'voter-c'];
  const waiting = await dispatchUntilAllWaiting(instance.id, keys, 'seed-wfm-05');
  if (waiting.length < 3) throw new Error(`expected 3 waiting votes, got ${waiting.length}`);

  const byKey = Object.fromEntries(waiting.map((n) => [n.semanticNodeKey, n]));
  await completeWi(byKey['voter-a']!.id, voters[0], 'APPROVE');
  await completeWi(byKey['voter-b']!.id, voters[1], 'APPROVE');
  // leave voter-c open — THRESHOLD 2 + cancelRemaining should pass
  await drainAutomated(instance.id, 'seed-wfm-05');
  await scanAndRunDueEscalations();
  await drainAutomated(instance.id, 'seed-wfm-05');
  await assertEnd(instance.id, 'end-passed');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
