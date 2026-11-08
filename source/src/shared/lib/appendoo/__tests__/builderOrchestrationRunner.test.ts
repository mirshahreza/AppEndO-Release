import { describe, expect, it } from 'vitest';
import { runOrchestratedBuilderPhases } from '../builderOrchestrationRunner';

describe('builderOrchestrationRunner', () => {
  it('runs validate → preview → execute → reconcile in order', () => {
    const phases: string[] = [];
    const result = runOrchestratedBuilderPhases((phase) => {
      phases.push(phase);
      if (phase === 'validate' || phase === 'preview') {
        return { ok: true, phase, errors: [], warnings: [], plannedMutations: [], mutations: [], reconciledMutations: [] } as never;
      }
      if (phase === 'execute') {
        return {
          ok: true,
          phase: 'execute',
          mutations: [{ artifactId: 'a1', path: 'appendoo/ws/cs-1/runtime/config/x.json', fingerprint: 'fp', mutation: 'modified' }],
          semanticRelationships: [],
          appliedKnowledgeRefs: [],
          usedCapabilityRefs: [],
          warnings: [],
          verificationHints: [],
        };
      }
      return {
        ok: true,
        phase: 'reconcile',
        reconciledMutations: [{ artifactId: 'a1', path: 'appendoo/ws/cs-1/runtime/config/x.json', fingerprint: 'fp', mutation: 'modified' }],
        driftDetected: false,
        warnings: [],
      };
    });

    expect(result.ok).toBe(true);
    expect(phases).toEqual(['validate', 'preview', 'execute', 'reconcile']);
    expect(result.executeMutations).toHaveLength(1);
  });
});
