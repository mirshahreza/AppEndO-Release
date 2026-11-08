import { describe, expect, it } from 'vitest';
import { workflowModelSchema, workflowNodeDefinitionSchema, canonicalExpressionSchema } from '../schemas';

const basePolicies = {
  recoveryDetectionBoundMs: 1,
  limits: {
    maxNodes: 1,
    maxEdges: 1,
    maxPayloadBytes: 1,
    maxJsonDepth: 1,
    maxExpressionNodes: 1,
    maxStructuralPathCandidates: 1,
    maxDelayMs: 1,
    maxWaitTimeoutMs: 1,
    maxWorkItemTitleLength: 1,
  },
};

describe('workflowModelSchema', () => {
  it('accepts a minimal valid empty draft', () => {
    const draft = {
      schemaVersion: '1',
      key: 'k',
      name: 'n',
      inputSchema: { type: 'INLINE', schema: {} },
      outputSchema: { type: 'INLINE', schema: {} },
      variables: [],
      start: { type: 'MANUAL_API', targetNodeKey: 'x' },
      nodes: [],
      edges: [],
      policies: basePolicies,
    };
    expect(() => workflowModelSchema.parse(draft)).not.toThrow();
  });

  it('rejects an unknown top-level field (strict shape)', () => {
    const draft = {
      schemaVersion: '1',
      key: 'k',
      name: 'n',
      inputSchema: { type: 'INLINE', schema: {} },
      outputSchema: { type: 'INLINE', schema: {} },
      variables: [],
      start: { type: 'MANUAL_API', targetNodeKey: 'x' },
      nodes: [],
      edges: [],
      policies: basePolicies,
      unknownField: 'nope',
    };
    expect(() => workflowModelSchema.parse(draft)).toThrow();
  });
});

describe('workflowNodeDefinitionSchema — every V1 node discriminant', () => {
  it.each([
    ['ACTION', { kind: 'ACTION', key: 'k', actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'a', actionVersion: '1' }, providerId: 'p', providerVersion: '1' }, config: { type: 'OBJECT', fields: {} }, input: { type: 'OBJECT', fields: {} } }],
    ['LOOP', { kind: 'LOOP', key: 'k', condition: { op: 'LITERAL', value: true }, actionRef: { type: 'EXACT_PROVIDER', action: { actionKey: 'a', actionVersion: '1' }, providerId: 'p', providerVersion: '1' }, config: { type: 'OBJECT', fields: {} }, input: { type: 'OBJECT', fields: {} } }],
    ['DECISION', { kind: 'DECISION', key: 'k', mode: 'EXACT_ONE' }],
    ['SWITCH', { kind: 'SWITCH', key: 'k', value: { op: 'LITERAL', value: 1 } }],
    ['PARALLEL_SPLIT', { kind: 'PARALLEL_SPLIT', key: 'k' }],
    ['PARALLEL_JOIN', { kind: 'PARALLEL_JOIN', key: 'k', mode: 'ALL' }],
    ['DELAY', { kind: 'DELAY', key: 'k', delay: { type: 'DURATION_MS', value: { op: 'LITERAL', value: 1000 } } }],
    ['WAIT_EVENT', { kind: 'WAIT_EVENT', key: 'k', eventName: 'e', correlation: { op: 'LITERAL', value: 'x' } }],
    [
      'WORK_ITEM',
      {
        kind: 'WORK_ITEM',
        key: 'k',
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'r' },
        allowedOutcomes: ['APPROVE'],
        title: { op: 'LITERAL', value: 't' },
        input: { type: 'OBJECT', fields: {} },
        outputSchema: { type: 'INLINE', schema: {} },
      },
    ],
    ['SUBFLOW', { kind: 'SUBFLOW', key: 'k', workflowDefinitionRef: { workflowDefinitionKey: 'w' }, input: { type: 'OBJECT', fields: {} } }],
    ['END', { kind: 'END', key: 'k', output: { type: 'OBJECT', fields: {} } }],
    ['FAIL', { kind: 'FAIL', key: 'k', errorCode: { op: 'LITERAL', value: 'ERR' }, safeMessage: { op: 'LITERAL', value: 'msg' } }],
  ])('%s round-trips', (_kind, payload) => {
    expect(() => workflowNodeDefinitionSchema.parse(payload)).not.toThrow();
  });

  it('rejects cross-kind payload fields (e.g. DECISION carrying an ACTION-only field)', () => {
    const invalid = { kind: 'DECISION', key: 'k', mode: 'EXACT_ONE', actionRef: { type: 'EXACT_PROVIDER' } };
    expect(() => workflowNodeDefinitionSchema.parse(invalid)).toThrow();
  });

  it('rejects an unknown node kind', () => {
    expect(() => workflowNodeDefinitionSchema.parse({ kind: 'NOT_A_NODE', key: 'k' })).toThrow();
  });
});

describe('canonicalExpressionSchema — recursive AST', () => {
  it('accepts a nested AND/EQ/PATH expression', () => {
    const expr = {
      op: 'AND',
      values: [
        { op: 'EQ', left: { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: ['total'] } }, right: { op: 'LITERAL', value: 100 } },
        { op: 'NOT', value: { op: 'IS_NULL', value: { op: 'PATH', path: { root: { type: 'CURRENT_NODE_INPUT' }, segments: [] } } } },
      ],
    };
    expect(() => canonicalExpressionSchema.parse(expr)).not.toThrow();
  });

  it('rejects an unregistered op', () => {
    expect(() => canonicalExpressionSchema.parse({ op: 'EVAL', code: 'process.exit()' })).toThrow();
  });
});
