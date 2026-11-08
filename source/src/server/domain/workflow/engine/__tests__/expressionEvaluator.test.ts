import { describe, expect, it } from 'vitest';
import { evaluateExpression, evaluateMapping, type EvaluationContext } from '../expressionEvaluator';
import type { CanonicalExpression, CanonicalMapping } from '../../awm/types';

const baseContext: EvaluationContext = {
  workflowInput: { total: 145_000_000, name: 'Acme' },
  variables: { approved: true, tags: ['a', 'b'] },
  nodeOutputs: { 'action-1': { text: 'hello' } },
  currentNodeInput: { x: 1 },
};

const lit = (value: unknown): CanonicalExpression => ({ op: 'LITERAL', value: value as never });

describe('evaluateExpression', () => {
  it('resolves LITERAL and PATH roots (WORKFLOW_INPUT, WORKFLOW_VARIABLE, NODE_OUTPUT, CURRENT_NODE_INPUT)', () => {
    expect(evaluateExpression(lit(42), baseContext)).toBe(42);
    expect(evaluateExpression({ op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: ['total'] } }, baseContext)).toBe(145_000_000);
    expect(evaluateExpression({ op: 'PATH', path: { root: { type: 'WORKFLOW_VARIABLE', variableKey: 'approved' }, segments: [] } }, baseContext)).toBe(true);
    expect(evaluateExpression({ op: 'PATH', path: { root: { type: 'NODE_OUTPUT', nodeKey: 'action-1' }, segments: ['text'] } }, baseContext)).toBe('hello');
    expect(evaluateExpression({ op: 'PATH', path: { root: { type: 'CURRENT_NODE_INPUT' }, segments: ['x'] } }, baseContext)).toBe(1);
  });

  it('throws WF_EXEC_EXPRESSION_FAILED for a top-level missing path', () => {
    const expr: CanonicalExpression = { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: ['doesNotExist'] } };
    expect(() => evaluateExpression(expr, baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('EQ/NE use typed canonical JSON equality, never coercing', () => {
    expect(evaluateExpression({ op: 'EQ', left: lit(1), right: lit('1') }, baseContext)).toBe(false);
    expect(evaluateExpression({ op: 'EQ', left: lit({ a: 1, b: 2 }), right: lit({ b: 2, a: 1 }) }, baseContext)).toBe(true);
    expect(evaluateExpression({ op: 'NE', left: lit([1, 2]), right: lit([2, 1]) }, baseContext)).toBe(true);
  });

  it('LT/GT accept two finite numbers or two strings using ordinal comparison, else fail', () => {
    expect(evaluateExpression({ op: 'LT', left: lit(1), right: lit(2) }, baseContext)).toBe(true);
    expect(evaluateExpression({ op: 'GT', left: lit('b'), right: lit('a') }, baseContext)).toBe(true);
    expect(() => evaluateExpression({ op: 'LT', left: lit(1), right: lit('a') }, baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('AND/OR short-circuit and require booleans', () => {
    expect(evaluateExpression({ op: 'AND', values: [lit(true), lit(false)] }, baseContext)).toBe(false);
    expect(evaluateExpression({ op: 'OR', values: [lit(false), lit(true)] }, baseContext)).toBe(true);
    expect(() => evaluateExpression({ op: 'AND', values: [lit(1) as CanonicalExpression] }, baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('ADD/SUB/MUL/DIV/MOD are finite-number-only; DIV/MOD by zero fails', () => {
    expect(evaluateExpression({ op: 'ADD', left: lit(2), right: lit(3) }, baseContext)).toBe(5);
    expect(evaluateExpression({ op: 'MOD', left: lit(7), right: lit(3) }, baseContext)).toBe(1);
    expect(() => evaluateExpression({ op: 'DIV', left: lit(1), right: lit(0) }, baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('CONCAT requires strings only', () => {
    expect(evaluateExpression({ op: 'CONCAT', values: [lit('a'), lit('b')] }, baseContext)).toBe('ab');
    expect(() => evaluateExpression({ op: 'CONCAT', values: [lit('a'), lit(1) as CanonicalExpression] }, baseContext)).toThrow();
  });

  it('IN requires an array set and uses typed equality', () => {
    expect(evaluateExpression({ op: 'IN', value: lit('a'), set: lit(['a', 'b']) }, baseContext)).toBe(true);
    expect(() => evaluateExpression({ op: 'IN', value: lit('a'), set: lit('not-an-array') }, baseContext)).toThrow();
  });

  it('COALESCE returns the first non-missing, non-null value', () => {
    const missing: CanonicalExpression = { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: ['nope'] } };
    expect(evaluateExpression({ op: 'COALESCE', values: [missing, lit(null), lit('fallback')] }, baseContext)).toBe('fallback');
  });

  it('IS_NULL/IS_NOT_NULL check JSON null exactly', () => {
    expect(evaluateExpression({ op: 'IS_NULL', value: lit(null) }, baseContext)).toBe(true);
    expect(evaluateExpression({ op: 'IS_NOT_NULL', value: lit(0) }, baseContext)).toBe(true);
  });

  it('PURE_FUNCTION is unreachable in practice and fails with the missing-platform-contract code', () => {
    const expr: CanonicalExpression = { op: 'PURE_FUNCTION', functionRef: { key: 'math.abs', version: '1' }, args: [] };
    expect(() => evaluateExpression(expr, baseContext)).toThrow(expect.objectContaining({ code: 'WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT' }));
  });

  it('CURRENT_ITEM / CURRENT_ITEM_INDEX resolve only when bound (LOOP/FOR_EACH iteration context)', () => {
    const itemContext: EvaluationContext = { ...baseContext, currentItem: { text: 'prev' }, currentItemIndex: 2 };
    expect(evaluateExpression({ op: 'PATH', path: { root: { type: 'CURRENT_ITEM' }, segments: ['text'] } }, itemContext)).toBe('prev');
    expect(evaluateExpression({ op: 'PATH', path: { root: { type: 'CURRENT_ITEM_INDEX' }, segments: [] } }, itemContext)).toBe(2);
    expect(evaluateExpression({ op: 'IS_NULL', value: { op: 'PATH', path: { root: { type: 'CURRENT_ITEM' }, segments: [] } } }, { ...baseContext, currentItem: null, currentItemIndex: 0 })).toBe(true);
    expect(() => evaluateExpression({ op: 'PATH', path: { root: { type: 'CURRENT_ITEM' }, segments: [] } }, baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });
});

describe('evaluateMapping', () => {
  it('omits object fields whose expression resolves to a missing path', () => {
    const mapping: CanonicalMapping = {
      type: 'OBJECT',
      fields: {
        present: { type: 'EXPRESSION', expression: lit('yes') },
        absent: { type: 'EXPRESSION', expression: { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: ['ghost'] } } },
        nested: { type: 'OBJECT', fields: { inner: { type: 'EXPRESSION', expression: lit(1) } } },
      },
    };
    expect(evaluateMapping(mapping, baseContext)).toEqual({ present: 'yes', nested: { inner: 1 } });
  });

  it('fails when an ARRAY item resolves to a missing path (no holes permitted)', () => {
    const mapping: CanonicalMapping = {
      type: 'OBJECT',
      fields: {
        items: {
          type: 'ARRAY',
          items: [{ type: 'EXPRESSION', expression: { op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments: ['ghost'] } } }],
        },
      },
    };
    expect(() => evaluateMapping(mapping, baseContext)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('preserves array order and evaluates full input/output mapping end to end', () => {
    const mapping: CanonicalMapping = {
      type: 'OBJECT',
      fields: {
        text: { type: 'EXPRESSION', expression: { op: 'PATH', path: { root: { type: 'NODE_OUTPUT', nodeKey: 'action-1' }, segments: ['text'] } } },
        list: { type: 'ARRAY', items: [{ type: 'EXPRESSION', expression: lit(1) }, { type: 'EXPRESSION', expression: lit(2) }] },
      },
    };
    expect(evaluateMapping(mapping, baseContext)).toEqual({ text: 'hello', list: [1, 2] });
  });
});
