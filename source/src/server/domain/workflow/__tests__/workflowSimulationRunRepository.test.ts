import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition } from '../workflowDefinitionRepository';
import { createSimulationRun, transitionSimulationRunTerminal } from '../workflowSimulationRunRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowSimulationRunRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('rejects create when both/neither of sourceDraftVersion/sourceRevisionId are supplied (before any DB call)', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('sim-xor'), draftDefinitionJson: '{}' });
    await expect(
      createSimulationRun({
        workflowDefinitionId: definition.id,
        sourceDraftVersion: 1,
        sourceRevisionId: 2,
        simulationResolvedSnapshotFingerprint: 'fp',
        mode: 'FULL',
        fixtureSetFingerprint: 'fixture-fp',
        createdByType: 'USER',
      } as never),
    ).rejects.toMatchObject({ code: 'WF_SIM_INVALID_SOURCE' });
  });

  it('creation always lands in RUNNING; exactly one terminal transition; second attempt is rejected (immutability)', async () => {
    const definition = await createTestWorkflowDefinition({ key: uniqueKey('sim-lifecycle'), draftDefinitionJson: '{}' });
    const run = await createSimulationRun({
      workflowDefinitionId: definition.id,
      sourceDraftVersion: 1,
      simulationResolvedSnapshotFingerprint: 'fp',
      mode: 'FULL',
      fixtureSetFingerprint: 'fixture-fp',
      createdByType: 'USER',
    });
    expect(run.status).toBe('RUNNING');

    const succeeded = await transitionSimulationRunTerminal(run.id, run.stateVersion, 'COMPLETE_SUCCESS', '{"paths":3}');
    expect(succeeded.status).toBe('SUCCEEDED');

    await expect(
      transitionSimulationRunTerminal(succeeded.id, succeeded.stateVersion, 'COMPLETE_FAILURE'),
    ).rejects.toMatchObject({ code: 'WF_SIM_INVALID_SOURCE' });
  });
});
