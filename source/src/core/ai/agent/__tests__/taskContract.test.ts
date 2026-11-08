import { describe, expect, it } from 'vitest';
import { resolveTaskContract } from '../taskContract';
import type { AssistantRequestRouting } from '../../../../shared/api/contracts/ai/appendooGateway.types';

const buildRouting = (overrides: Partial<AssistantRequestRouting> = {}): AssistantRequestRouting => ({
  requestClass: 'ENGINEERING_CHANGE',
  taskProfile: 'TOOL_SESSION',
  routerVersion: 'v-test',
  routingReason: 'test routing reason',
  confidence: 0.9,
  requiresClarification: false,
  useEngineeringPipeline: false,
  ...overrides,
});

describe('V5 P02 — resolveTaskContract', () => {
  it('derives ENGINEERING_CHANGE with a required validation acceptance criterion from real routing', () => {
    const contract = resolveTaskContract({
      taskId: 't1',
      rawUserRequest: 'fix the bug in clampPercentage',
      mode: 'agent',
      routing: buildRouting(),
    });
    expect(contract.taskClass).toBe('ENGINEERING_CHANGE');
    expect(contract.mutationExpectation).toBe('EXPECTED');
    expect(contract.acceptanceCriteria).toHaveLength(1);
    expect(contract.acceptanceCriteria[0].required).toBe(true);
    expect(contract.ambiguity.isAmbiguous).toBe(false);
  });

  it('propagates requiresClarification from the real router as ambiguity', () => {
    const contract = resolveTaskContract({
      taskId: 't1',
      rawUserRequest: 'do something',
      mode: 'agent',
      routing: buildRouting({ requiresClarification: true, routingReason: 'ambiguous target' }),
    });
    expect(contract.ambiguity.isAmbiguous).toBe(true);
    expect(contract.ambiguity.reason).toBe('ambiguous target');
  });

  it('maps ENGINEERING_QUERY/CONTEXT_QUERY to no required acceptance criteria (no mutation expected)', () => {
    const contract = resolveTaskContract({
      taskId: 't1',
      rawUserRequest: 'how does the retrieve gate work?',
      mode: 'agent',
      routing: buildRouting({ requestClass: 'CONTEXT_QUERY' }),
    });
    expect(contract.taskClass).toBe('ENGINEERING_QUERY');
    expect(contract.mutationExpectation).toBe('NOT_EXPECTED');
    expect(contract.acceptanceCriteria).toHaveLength(0);
  });

  it('falls back to a mode-derived contract when no routing is supplied (existing callers)', () => {
    const contract = resolveTaskContract({ taskId: 't1', rawUserRequest: 'x', mode: 'agent' });
    expect(contract.taskClass).toBe('ENGINEERING_CHANGE');
    expect(contract.sourceRefs).toContain('mode-default');
  });

  it('every contract has a stable per-call unique taskContractId and revision 1', () => {
    const a = resolveTaskContract({ taskId: 't1', rawUserRequest: 'x', mode: 'agent' });
    const b = resolveTaskContract({ taskId: 't1', rawUserRequest: 'x', mode: 'agent' });
    expect(a.taskContractId).not.toBe(b.taskContractId);
    expect(a.revision).toBe(1);
  });
});
