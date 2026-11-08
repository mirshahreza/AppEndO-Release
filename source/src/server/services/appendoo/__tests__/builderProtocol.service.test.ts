import { describe, expect, it } from 'vitest';
import type { ChangeNode } from '../../../../shared/api/contracts/appendoo/changeGraph.types';
import { builderProtocolService } from '../builderProtocol.service';
import { buildSemanticPlan } from '../../../../shared/lib/appendoo/semanticPlanBuilder';
import {
  buildGeSfUi001ContextPack,
  GE_SF_UI_001_PROMPT,
} from '../../../../shared/lib/appendoo/goldenEvalServerFunctionUi';
import { serverFunctionsScope } from '../../ai/__tests__/e2eEngineeringPipeline.helpers';

/**
 * AE-HARDEN-7 (builder input sufficiency) requires a VALIDATED semantic plan with a full
 * UISemanticDesign for every runPhase/runOrchestratedPhases call — a plan-less builder run
 * is rejected by design (see semanticPlanAuthorityGates.assertBuilderInputSufficient).
 */
const validPlan = buildSemanticPlan({
  applicationScope: serverFunctionsScope(),
  contextPack: buildGeSfUi001ContextPack(),
  userPrompt: GE_SF_UI_001_PROMPT,
});

const sampleNode = (
  operationType: ChangeNode['operationType'],
  changeSetId: string,
  nodeId: string,
  capabilityId: string,
): ChangeNode => ({
  nodeId,
  operationId: `op:${nodeId}`,
  changeSetId,
  operationType,
  targetRef: {
    targetKind: operationType.includes('SERVER_FUNCTION') ? 'function' : 'page',
    targetId: nodeId,
    ref: nodeId,
  },
  inputs: {},
  expectedOutputs: [],
  dependencies: [],
  requiredCapabilityIds: [capabilityId],
  capabilitySnapshotVersion: '1.0.0:agent:',
  providerBinding: {
    capabilityId,
    providerBindingId: `binding:${capabilityId.replace('capability:', '')}`,
    capabilitySnapshotVersion: '1.0.0:agent:',
  },
  workspaceMutationScope: [`appendoo/ws/${changeSetId}/**`],
  state: 'PLANNED',
  attempts: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
});

describe('builderProtocolService', () => {
  it('runs validate phase for supported operation', () => {
    const changeNode = sampleNode('CREATE_PAGE', 'cs-svc-1', 'node-svc-1', 'capability:appendo-designer');
    const context = builderProtocolService.createContext({
      workspaceId: 'ws-svc-1',
      revisionId: 'rev-svc-1',
      changeSetId: 'cs-svc-1',
      changeNode,
      validatedCapabilities: [{ capabilityId: 'capability:appendo-designer' }],
    });

    const result = builderProtocolService.runPhase(context, 'validate', [], [], undefined, validPlan);

    expect(result.ok).toBe(true);
    expect(result.phase).toBe('validate');
  });

  it('runs execute phase in workspace scope', () => {
    const changeNode = sampleNode(
      'CREATE_SERVER_FUNCTION',
      'cs-svc-2',
      'node-svc-2',
      'capability:appendo-server-functions',
    );
    const context = builderProtocolService.createContext({
      workspaceId: 'ws-svc-2',
      revisionId: 'rev-svc-2',
      changeSetId: 'cs-svc-2',
      changeNode,
      validatedCapabilities: [{ capabilityId: 'capability:appendo-server-functions' }],
    });

    const result = builderProtocolService.runPhase(context, 'execute', [], [], undefined, validPlan);
    expect(result.ok).toBe(true);
    expect(result.phase).toBe('execute');
    if (result.phase === 'execute') {
      expect(result.mutations[0]?.path).toContain('workspace/server-functions/custom/');
    }
  });

  it('lists default builder registry entries', () => {
    const registry = builderProtocolService.listRegistry();
    expect(registry.some((entry) => entry.builderType === 'PageComponentBuilder')).toBe(true);
    expect(registry.find((entry) => entry.builderType === 'WorkflowBuilder')?.enabled).toBe(false);
  });

  it('runs reconcile and rollback scaffold phases', () => {
    const changeNode = sampleNode('CREATE_PAGE', 'cs-svc-3', 'node-svc-3', 'capability:appendo-designer');
    const context = builderProtocolService.createContext({
      workspaceId: 'ws-svc-3',
      revisionId: 'rev-svc-3',
      changeSetId: 'cs-svc-3',
      changeNode,
      validatedCapabilities: [{ capabilityId: 'capability:appendo-designer' }],
    });

    const execute = builderProtocolService.runPhase(context, 'execute', [], [], undefined, validPlan);
    expect(execute.phase).toBe('execute');

    const reconcile = builderProtocolService.runPhase(
      context,
      'reconcile',
      [],
      execute.phase === 'execute' ? execute.mutations : [],
    );
    expect(reconcile.ok).toBe(true);
    expect(reconcile.phase).toBe('reconcile');

    const rollback = builderProtocolService.runPhase(
      context,
      'rollback',
      [],
      [],
      execute.phase === 'execute' ? execute.rollbackData : undefined,
    );
    expect(rollback.ok).toBe(true);
    expect(rollback.phase).toBe('rollback');
  });

  it('runs orchestrated builder phases end-to-end', () => {
    const changeNode = sampleNode(
      'CREATE_SERVER_FUNCTION',
      'cs-svc-4',
      'node-svc-4',
      'capability:appendo-server-functions',
    );
    const context = builderProtocolService.createContext({
      workspaceId: 'ws-svc-4',
      revisionId: 'rev-svc-4',
      changeSetId: 'cs-svc-4',
      changeNode,
      validatedCapabilities: [{ capabilityId: 'capability:appendo-server-functions' }],
    });

    const orchestrated = builderProtocolService.runOrchestratedPhases(context, validPlan);
    expect(orchestrated.ok).toBe(true);
    expect(orchestrated.completedPhases).toEqual(['validate', 'preview', 'execute', 'reconcile']);
  });
});
