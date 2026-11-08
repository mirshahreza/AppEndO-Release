import { describe, expect, it } from 'vitest';
import type { WorkflowModel, WorkflowNodeDefinition } from '../../awm/types';
import { runPolicyLimitValidation } from '../rules/policyLimitValidation';
import { baseModel, endNode, lit, mappingOf } from './fixtures';

const codes = (model: WorkflowModel) => runPolicyLimitValidation(model).map((i) => i.code);

describe('runPolicyLimitValidation', () => {
  it('accepts a minimal model within all default limits', () => {
    expect(runPolicyLimitValidation(baseModel())).toHaveLength(0);
  });

  it('flags node count exceeding maxNodes', () => {
    const model = baseModel({ policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxNodes: 0 } } });
    expect(codes(model)).toContain('WF_DEF_INVALID_AWM');
  });

  it('flags edge count exceeding maxEdges', () => {
    const model = baseModel({
      nodes: [endNode('a'), endNode('b')],
      edges: [{ key: 'e1', fromNodeKey: 'a', toNodeKey: 'b', selector: { type: 'UNCONDITIONAL' } }],
      policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxEdges: 0 } },
    });
    expect(codes(model)).toContain('WF_DEF_INVALID_AWM');
  });

  it('flags JSON depth exceeding maxJsonDepth', () => {
    const model = baseModel({ policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxJsonDepth: 1 } } });
    expect(codes(model)).toContain('WF_DEF_INVALID_AWM');
  });

  it('flags payload size exceeding maxPayloadBytes', () => {
    const model = baseModel({ policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxPayloadBytes: 1 } } });
    expect(codes(model)).toContain('WF_EXEC_PAYLOAD_LIMIT_EXCEEDED');
  });

  describe('DELAY node literal value', () => {
    it('rejects a non-numeric literal delay value', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit('not-a-number') } }];
      expect(codes(baseModel({ nodes }))).toContain('WF_DEF_INVALID_AWM');
    });

    it('rejects a negative literal DURATION_MS delay', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(-5) } }];
      expect(codes(baseModel({ nodes }))).toContain('WF_DEF_INVALID_AWM');
    });

    it('rejects a literal DURATION_MS exceeding maxDelayMs', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(1000) } }];
      const model = baseModel({ nodes, policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxDelayMs: 100 } } });
      expect(codes(model)).toContain('WF_DEF_INVALID_AWM');
    });

    it('accepts a valid literal DURATION_MS delay within limits', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(500) } }];
      expect(runPolicyLimitValidation(baseModel({ nodes }))).toHaveLength(0);
    });

    it('accepts a valid literal UNTIL instant string (not numeric)', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DELAY', key: 'd1', delay: { type: 'UNTIL', value: lit('2030-01-01T00:00:00.000Z') } }];
      expect(runPolicyLimitValidation(baseModel({ nodes }))).toHaveLength(0);
    });

    it('rejects a non-parseable literal UNTIL instant', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DELAY', key: 'd1', delay: { type: 'UNTIL', value: lit('not-a-date') } }];
      expect(codes(baseModel({ nodes }))).toContain('WF_DEF_INVALID_AWM');
    });

    it('does not apply maxDelayMs to a literal UNTIL instant', () => {
      const nodes: WorkflowNodeDefinition[] = [{ kind: 'DELAY', key: 'd1', delay: { type: 'UNTIL', value: lit('2099-01-01T00:00:00.000Z') } }];
      const model = baseModel({ nodes, policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxDelayMs: 1 } } });
      expect(runPolicyLimitValidation(model)).toHaveLength(0);
    });
  });

  describe('WAIT_EVENT literal timeout', () => {
    it('rejects a negative literal timeout.afterMs', () => {
      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'WAIT_EVENT', key: 'w1', eventName: 'e', correlation: lit(true), timeout: { afterMs: lit(-1), outcomeKey: 'TO' } },
      ];
      expect(codes(baseModel({ nodes }))).toContain('WF_DEF_INVALID_AWM');
    });

    it('rejects a literal timeout exceeding maxWaitTimeoutMs', () => {
      const nodes: WorkflowNodeDefinition[] = [
        { kind: 'WAIT_EVENT', key: 'w1', eventName: 'e', correlation: lit(true), timeout: { afterMs: lit(10_000), outcomeKey: 'TO' } },
      ];
      const model = baseModel({ nodes, policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxWaitTimeoutMs: 100 } } });
      expect(codes(model)).toContain('WF_DEF_INVALID_AWM');
    });
  });

  describe('WORK_ITEM literal shape and escalation policy', () => {
    const workItemNode = (overrides: Partial<Extract<WorkflowNodeDefinition, { kind: 'WORK_ITEM' }>> = {}): WorkflowNodeDefinition => ({
      kind: 'WORK_ITEM',
      key: 'wi1',
      workItemType: 'APPROVAL',
      assignment: { strategy: 'USER', userId: 'u1' },
      allowedOutcomes: ['DONE'],
      title: lit('a title'),
      input: mappingOf({}),
      outputSchema: { type: 'INLINE', schema: {} },
      ...overrides,
    });

    it('rejects an empty literal title', () => {
      expect(codes(baseModel({ nodes: [workItemNode({ title: lit('') })] }))).toContain('WF_DEF_INVALID_AWM');
    });

    it('rejects a literal title exceeding maxWorkItemTitleLength', () => {
      const model = baseModel({
        nodes: [workItemNode({ title: lit('x'.repeat(10)) })],
        policies: { ...baseModel().policies, limits: { ...baseModel().policies.limits, maxWorkItemTitleLength: 5 } },
      });
      expect(codes(model)).toContain('WF_DEF_INVALID_AWM');
    });

    it('rejects a non-string literal summary', () => {
      expect(codes(baseModel({ nodes: [workItemNode({ summary: lit(123) })] }))).toContain('WF_DEF_INVALID_AWM');
    });

    it('rejects zero declared allowedOutcomes', () => {
      expect(codes(baseModel({ nodes: [workItemNode({ allowedOutcomes: [] })] }))).toContain('WF_DEF_INVALID_AWM');
    });

    it('rejects duplicate escalation step keys', () => {
      const model = baseModel({
        nodes: [
          workItemNode({
            escalationPolicy: {
              steps: [
                { key: 'step1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 1000 }, action: { type: 'RAISE_PRIORITY', priority: 1 }, maxExecutions: 1 },
                { key: 'step1', trigger: { type: 'AFTER_OPEN_MS', afterMs: 2000 }, action: { type: 'RAISE_PRIORITY', priority: 2 }, maxExecutions: 1 },
              ],
            },
          }),
        ],
      });
      expect(codes(model)).toContain('WF_DEF_INVALID_AWM');
    });

    it('accepts a NOTIFY escalation step (in-app notifications are a platform capability)', () => {
      const model = baseModel({
        nodes: [
          workItemNode({
            escalationPolicy: {
              steps: [
                {
                  key: 'notify1',
                  trigger: { type: 'AFTER_OPEN_MS', afterMs: 1000 },
                  action: { type: 'NOTIFY', notificationRef: { bindingType: 'x', bindingId: 'y' }, input: mappingOf({}) },
                  maxExecutions: 1,
                },
              ],
            },
          }),
        ],
      });
      expect(codes(model)).not.toContain('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT');
    });

    it('accepts a well-formed WORK_ITEM with no escalation policy', () => {
      expect(runPolicyLimitValidation(baseModel({ nodes: [workItemNode()] }))).toHaveLength(0);
    });
  });

  describe('retry policy shape (node-level and workflow default)', () => {
    it('rejects an EXPONENTIAL retry policy with a multiplier below 1', () => {
      const nodes: WorkflowNodeDefinition[] = [
        {
          kind: 'ACTION',
          key: 'a1',
          actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'x', actionVersion: '1' }, providerId: 'p', providerVersion: '1' },
          config: mappingOf({}),
          input: mappingOf({}),
          retryPolicy: { maxAttempts: 3, strategy: 'EXPONENTIAL', initialDelayMs: 100, multiplier: 0.5, retryOn: [] },
        },
      ];
      expect(codes(baseModel({ nodes }))).toContain('WF_DEF_INVALID_RETRY_POLICY');
    });

    it('rejects a non-finite initialDelayMs', () => {
      const nodes: WorkflowNodeDefinition[] = [
        {
          kind: 'ACTION',
          key: 'a1',
          actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'x', actionVersion: '1' }, providerId: 'p', providerVersion: '1' },
          config: mappingOf({}),
          input: mappingOf({}),
          retryPolicy: { maxAttempts: 3, strategy: 'FIXED', initialDelayMs: Number.POSITIVE_INFINITY, retryOn: [] },
        },
      ];
      expect(codes(baseModel({ nodes }))).toContain('WF_DEF_INVALID_RETRY_POLICY');
    });

    it('validates the workflow-level defaultRetryPolicy shape too', () => {
      const model = baseModel({
        policies: {
          ...baseModel().policies,
          defaultRetryPolicy: { maxAttempts: 3, strategy: 'EXPONENTIAL', initialDelayMs: 100, multiplier: -1, retryOn: [] },
        },
      });
      expect(codes(model)).toContain('WF_DEF_INVALID_RETRY_POLICY');
    });

    it('accepts a well-formed EXPONENTIAL retry policy', () => {
      const nodes: WorkflowNodeDefinition[] = [
        {
          kind: 'ACTION',
          key: 'a1',
          actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'x', actionVersion: '1' }, providerId: 'p', providerVersion: '1' },
          config: mappingOf({}),
          input: mappingOf({}),
          retryPolicy: { maxAttempts: 3, strategy: 'EXPONENTIAL', initialDelayMs: 100, multiplier: 2, maxDelayMs: 10_000, retryOn: [] },
        },
      ];
      expect(runPolicyLimitValidation(baseModel({ nodes }))).toHaveLength(0);
    });
  });
});
