import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../publication/workflowPublicationService';
import { startWorkflowInstance } from '../startService';
import { dispatchNode } from '../dispatchService';
import { getWorkItemByNodeInstance, getWorkItemById } from '../../workItemRepository';
import { getNodeInstanceByOccurrence } from '../../workflowNodeInstanceRepository';
import { scanAndRunDueEscalations } from '../workItemEscalationService';
import { updateBusinessHoursCalendar } from '../../workflowBusinessHoursCalendarRepository';
import { registerCoreActionPack } from '../../actions/corePack';
import { lit, baseModel, workItemNode, workItemOutcomeEdge, endNode } from './fixtures';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const leaseOwner = 'escalation-business-hours-worker';

registerCoreActionPack();

describe.skipIf(!dbReady)('WORK_ITEM escalation respectBusinessHours (HWF-2.2, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
    // A calendar so restrictive (0 working days) that ANY respectBusinessHours=true step can never
    // become due — the cleanest possible proof the calendar path is actually consulted, without
    // depending on wall-clock timing at test-run time.
    await updateBusinessHoursCalendar({ workingDays: [], startTime: '09:00', endTime: '17:00', holidays: [] });
  });

  afterAll(async () => {
    // Restore a sane default so this shared-dev-DB singleton doesn't stay zeroed out for whatever
    // other session/test reads it next.
    await updateBusinessHoursCalendar({ workingDays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00', holidays: [] });
    await shutdownWorkflowE2eEnvironment(pool);
  });

  async function publishStartAndDispatch(respectBusinessHours: boolean) {
    const model = baseModel({
      nodes: [
        workItemNode('w1', {
          assignment: { strategy: 'ROLE', roleId: 'DEVELOPER' },
          allowedOutcomes: ['DONE'],
          escalationPolicy: {
            steps: [{ key: 'e1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 0, respectBusinessHours }, action: { type: 'RAISE_PRIORITY', priority: 5 }, maxExecutions: 1 }],
          },
        } as never),
        endNode('end-1'),
      ],
      edges: [workItemOutcomeEdge('e-w1-end', 'w1', 'end-1', 'DONE')],
      start: { type: 'MANUAL_API', targetNodeKey: 'w1' },
    });
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('esc-bh'), draftDefinitionJson: JSON.stringify(model) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);
    const { instance } = await startWorkflowInstance({ workflowRevisionId: revision.id, input: {}, startedByType: 'USER', startedById: 1 });
    const w1Node = await getNodeInstanceByOccurrence(instance.id, 'w1');
    await dispatchNode({ nodeInstanceId: w1Node!.id, leaseOwnerId: leaseOwner });
    return getWorkItemByNodeInstance(w1Node!.id);
  }

  it('a step with respectBusinessHours=true never fires against a zero-working-day calendar, even with afterMs=0', async () => {
    const workItem = await publishStartAndDispatch(true);
    await scanAndRunDueEscalations();
    const after = await getWorkItemById(workItem!.id);
    expect(after!.priority).toBe(0); // RAISE_PRIORITY never ran
  });

  it('the same afterMs=0 step WITHOUT respectBusinessHours fires immediately regardless of the calendar', async () => {
    const workItem = await publishStartAndDispatch(false);
    await scanAndRunDueEscalations();
    const after = await getWorkItemById(workItem!.id);
    expect(after!.priority).toBe(5); // RAISE_PRIORITY ran — calendar correctly ignored
  });
});
