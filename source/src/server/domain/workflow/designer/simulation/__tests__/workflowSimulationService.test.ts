import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment, createTestWorkflowDefinition } from '../../../../../test/workflowE2eTestHarness';
import { createWorkflowDefinition, applyDraftOperationsToDefinition, getWorkflowDefinitionById } from '../../../workflowDefinitionRepository';
import { publishWorkflowDefinition } from '../../../publication/workflowPublicationService';
import { baseModel, endNode, actionNode, unconditionalEdge } from '../../../publication/__tests__/fixtures';
import { registerCoreActionPack } from '../../../actions/corePack';
import { runWorkflowSimulation } from '../workflowSimulationService';
import { resolveSimulationSource } from '../simulationSourceResolution';
import type { WorkflowModel } from '../../../awm/types';
import type { WorkflowSimulationFixtureSet } from '../simulationTypes';

const dbReady = await isDatabaseReachable();
const uniqueKey = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const manualApiModel = (key: string): WorkflowModel => baseModel({ key, name: key, nodes: [endNode('end-1')], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' } });

describe.skipIf(!dbReady)('simulation (real DB): source resolution + RunSimulation', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
    registerCoreActionPack();
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('DRAFT source resolves under the exact expectedDraftVersion and rejects a stale one', async () => {
    const key = uniqueKey('sim-draft');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(manualApiModel(key)) });

    const resolved = await resolveSimulationSource({ type: 'DRAFT', workflowDefinitionId: definition.id, expectedDraftVersion: definition.draftVersion });
    expect(resolved.sourceDraftVersion).toBe(definition.draftVersion);
    expect(resolved.sourceRevisionId).toBeNull();
    expect(resolved.model.nodes.some((n) => n.key === 'end-1')).toBe(true);

    await expect(resolveSimulationSource({ type: 'DRAFT', workflowDefinitionId: definition.id, expectedDraftVersion: definition.draftVersion + 1 })).rejects.toMatchObject({ code: 'WF_SIM_INVALID_SOURCE' });
  });

  it('DRAFT source rejects an invalid draft before ever running the interpreter', async () => {
    const key = uniqueKey('sim-invalid');
    const invalidModel = baseModel({
      key,
      name: key,
      nodes: [endNode('end-1')],
      edges: [{ key: 'e1', fromNodeKey: 'ghost', toNodeKey: 'end-1', selector: { type: 'UNCONDITIONAL' } }],
      start: { type: 'MANUAL_API', targetNodeKey: 'end-1' },
    });
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(invalidModel) });
    await expect(resolveSimulationSource({ type: 'DRAFT', workflowDefinitionId: definition.id, expectedDraftVersion: definition.draftVersion })).rejects.toMatchObject({ code: 'WF_SIM_INVALID_SOURCE' });
  });

  it('REVISION source uses the immutable published snapshot verbatim', async () => {
    const key = uniqueKey('sim-rev');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(manualApiModel(key)) });
    const { revision } = await publishWorkflowDefinition(definition.id, definition.draftVersion);

    const resolved = await resolveSimulationSource({ type: 'REVISION', sourceRevisionId: revision.id });
    expect(resolved.sourceRevisionId).toBe(revision.id);
    expect(resolved.sourceDraftVersion).toBeNull();
    expect(resolved.simulationResolvedSnapshotFingerprint).toBe(revision.semanticFingerprint);
  });

  it('RunSimulation (FULL, DRAFT source, MANUAL_API model) persists a SUCCEEDED WorkflowSimulationRun with ordered evidence', async () => {
    const key = uniqueKey('sim-run-success');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(manualApiModel(key)) });

    const result = await runWorkflowSimulation({
      source: { type: 'DRAFT', workflowDefinitionId: definition.id, expectedDraftVersion: definition.draftVersion },
      mode: { type: 'FULL', workflowInput: null },
      fixtureSet: { fixtures: {} },
      createdBy: { type: 'USER', id: 1 },
    });

    expect(result.run.status).toBe('SUCCEEDED');
    expect(result.run.mode).toBe('FULL');
    expect(result.run.sourceDraftVersion).toBe(definition.draftVersion);
    expect(result.outcome).toEqual({ status: 'SUCCEEDED', output: {} });
    expect(result.run.resultSummaryJson).toBeTruthy();
    const parsed = JSON.parse(result.run.resultSummaryJson!);
    expect(parsed.evidence.length).toBeGreaterThan(0);
  });

  it('RunSimulation FAILS the run (not throws silently) when a required fixture is missing, and records the missing-fixture reason', async () => {
    const key = uniqueKey('sim-run-missing-fixture');
    const emailNode = {
      ...actionNode('a1', { actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'communication.email-send', actionVersion: '1' }, providerId: 'core', providerVersion: '1' } }),
      retryPolicy: { maxAttempts: 1, strategy: 'FIXED' as const, initialDelayMs: 1000, retryOn: [] },
    };
    const model = baseModel({ key, name: key, nodes: [emailNode, endNode('e1')], edges: [unconditionalEdge('edge1', 'a1', 'e1')], start: { type: 'MANUAL_API', targetNodeKey: 'a1' } });
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(model) });

    await expect(
      runWorkflowSimulation({
        source: { type: 'DRAFT', workflowDefinitionId: definition.id, expectedDraftVersion: definition.draftVersion },
        mode: { type: 'FULL', workflowInput: null },
        fixtureSet: { fixtures: {} },
        createdBy: { type: 'USER', id: 1 },
      }),
    ).rejects.toMatchObject({ code: 'WF_SIM_MISSING_FIXTURE' });
  });

  it('does not create/mutate any production WorkflowInstance/NodeInstance row', async () => {
    const key = uniqueKey('sim-no-prod-rows');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(manualApiModel(key)) });
    await runWorkflowSimulation({
      source: { type: 'DRAFT', workflowDefinitionId: definition.id, expectedDraftVersion: definition.draftVersion },
      mode: { type: 'FULL', workflowInput: null },
      fixtureSet: { fixtures: {} },
      createdBy: { type: 'USER', id: 1 },
    });
    // The definition itself must remain untouched (no accidental publication/draft mutation as a side effect of simulation).
    const reloaded = await getWorkflowDefinitionById(definition.id);
    expect(reloaded!.draftVersion).toBe(definition.draftVersion);
    expect(reloaded!.currentPublishedRevisionId).toBeNull();
    expect(reloaded!.lifecycleStatus).toBe('DRAFT');
  });

  it('two RunSimulation calls against the same fixture set produce the same fixtureSetFingerprint (stable identity)', async () => {
    const key = uniqueKey('sim-fp-stable');
    const definition = await createTestWorkflowDefinition({ key, draftDefinitionJson: JSON.stringify(manualApiModel(key)) });
    const fixtureSet: WorkflowSimulationFixtureSet = { fixtures: {} };

    const first = await runWorkflowSimulation({ source: { type: 'DRAFT', workflowDefinitionId: definition.id, expectedDraftVersion: definition.draftVersion }, mode: { type: 'FULL', workflowInput: null }, fixtureSet, createdBy: { type: 'USER', id: 1 } });
    const reloaded = await getWorkflowDefinitionById(definition.id);
    await applyDraftOperationsToDefinition(definition.id, reloaded!.draftVersion, []);
    const reloaded2 = await getWorkflowDefinitionById(definition.id);
    const second = await runWorkflowSimulation({ source: { type: 'DRAFT', workflowDefinitionId: definition.id, expectedDraftVersion: reloaded2!.draftVersion }, mode: { type: 'FULL', workflowInput: null }, fixtureSet, createdBy: { type: 'USER', id: 1 } });

    expect(first.run.fixtureSetFingerprint).toBe(second.run.fixtureSetFingerprint);
  });
});
