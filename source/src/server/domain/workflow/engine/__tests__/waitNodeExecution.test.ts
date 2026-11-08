import { describe, expect, it } from 'vitest';
import { evaluateDelayNode, evaluateWaitEventNode } from '../nodeExecution';
import { encodeCorrelationValue, WORKFLOW_EVENT_CORRELATION_ENCODER_VERSION, WORKFLOW_EVENT_CORRELATION_HASH_ALGORITHM } from '../eventCorrelation';
import type { EvaluationContext } from '../expressionEvaluator';
import type { CanonicalExpression, DelayNodeDefinition, WaitEventNodeDefinition } from '../../awm/types';

const lit = (value: unknown): CanonicalExpression => ({ op: 'LITERAL', value: value as never });
const inputPath = (segments: (string | number)[]): CanonicalExpression => ({ op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments } });

const baseContext: EvaluationContext = { workflowInput: { orderId: 'ord-1' }, variables: {}, nodeOutputs: {}, currentNodeInput: null };
const now = new Date('2026-01-01T00:00:00.000Z');

describe('encodeCorrelationValue', () => {
  it('produces a deterministic hash for the same scalar value', () => {
    const a = encodeCorrelationValue('ord-1');
    const b = encodeCorrelationValue('ord-1');
    expect(a.correlationValueHash).toBe(b.correlationValueHash);
    expect(a.correlationEncoderVersion).toBe(WORKFLOW_EVENT_CORRELATION_ENCODER_VERSION);
    expect(a.correlationHashAlgorithm).toBe(WORKFLOW_EVENT_CORRELATION_HASH_ALGORITHM);
  });

  it('produces different hashes for different values, including type-distinct equivalents', () => {
    const str = encodeCorrelationValue('1');
    const num = encodeCorrelationValue(1);
    const bool = encodeCorrelationValue(true);
    const nul = encodeCorrelationValue(null);
    const hashes = new Set([str.correlationValueHash, num.correlationValueHash, bool.correlationValueHash, nul.correlationValueHash]);
    expect(hashes.size).toBe(4);
  });

  it('rejects non-scalar (object/array) values', () => {
    expect(() => encodeCorrelationValue({ a: 1 } as never)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
    expect(() => encodeCorrelationValue([1, 2] as never)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });
});

describe('evaluateDelayNode', () => {
  const limits = { maxDelayMs: 60_000 };

  it('DURATION_MS: computes dueAt anchored to the supplied now', () => {
    const node: DelayNodeDefinition = { kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(5000) } };
    const decision = evaluateDelayNode(node, baseContext, limits, now);
    expect(decision).toEqual({ kind: 'CREATE_WAIT', waitType: 'TIMER', resolvedWait: { waitType: 'TIMER', dueAt: '2026-01-01T00:00:05.000Z' } });
  });

  it('DURATION_MS: zero is due immediately but still durable', () => {
    const node: DelayNodeDefinition = { kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(0) } };
    const decision = evaluateDelayNode(node, baseContext, limits, now);
    expect(decision).toEqual({ kind: 'CREATE_WAIT', waitType: 'TIMER', resolvedWait: { waitType: 'TIMER', dueAt: now.toISOString() } });
  });

  it('DURATION_MS: rejects a negative computed value', () => {
    const node: DelayNodeDefinition = { kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(-1) } };
    expect(() => evaluateDelayNode(node, baseContext, limits, now)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('DURATION_MS: rejects a non-integer computed value', () => {
    const node: DelayNodeDefinition = { kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(1.5) } };
    expect(() => evaluateDelayNode(node, baseContext, limits, now)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('DURATION_MS: rejects a value exceeding configured maxDelayMs', () => {
    const node: DelayNodeDefinition = { kind: 'DELAY', key: 'd1', delay: { type: 'DURATION_MS', value: lit(100_000) } };
    expect(() => evaluateDelayNode(node, baseContext, limits, now)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('UNTIL: persists the exact evaluated instant', () => {
    const node: DelayNodeDefinition = { kind: 'DELAY', key: 'd1', delay: { type: 'UNTIL', value: lit('2030-06-15T12:00:00.000Z') } };
    const decision = evaluateDelayNode(node, baseContext, limits, now);
    expect(decision).toEqual({ kind: 'CREATE_WAIT', waitType: 'TIMER', resolvedWait: { waitType: 'TIMER', dueAt: '2030-06-15T12:00:00.000Z' } });
  });

  it('UNTIL: rejects a non-parseable instant', () => {
    const node: DelayNodeDefinition = { kind: 'DELAY', key: 'd1', delay: { type: 'UNTIL', value: lit('not-a-date') } };
    expect(() => evaluateDelayNode(node, baseContext, limits, now)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });
});

describe('evaluateWaitEventNode', () => {
  const limits = { maxWaitTimeoutMs: 60_000 };

  it('untimed: derives the correlation encoding and omits timeoutAt', () => {
    const node: WaitEventNodeDefinition = { kind: 'WAIT_EVENT', key: 'w1', eventName: 'order.paid', correlation: inputPath(['orderId']) };
    const decision = evaluateWaitEventNode(node, baseContext, limits, now);
    expect(decision.kind).toBe('CREATE_WAIT');
    if (decision.kind !== 'CREATE_WAIT') throw new Error('unreachable');
    expect(decision.waitType).toBe('EVENT');
    expect(decision.resolvedWait.eventName).toBe('order.paid');
    expect(decision.resolvedWait.timeoutAt).toBeUndefined();
    expect(decision.resolvedWait.correlationValueHash).toBe(encodeCorrelationValue('ord-1').correlationValueHash);
  });

  it('timed: computes timeoutAt anchored to now', () => {
    const node: WaitEventNodeDefinition = {
      kind: 'WAIT_EVENT',
      key: 'w1',
      eventName: 'order.paid',
      correlation: inputPath(['orderId']),
      timeout: { afterMs: lit(10_000), outcomeKey: 'timedOut' },
    };
    const decision = evaluateWaitEventNode(node, baseContext, limits, now);
    if (decision.kind !== 'CREATE_WAIT') throw new Error('unreachable');
    expect(decision.resolvedWait.timeoutAt).toBe('2026-01-01T00:00:10.000Z');
  });

  it('timed: rejects a timeout exceeding configured maxWaitTimeoutMs', () => {
    const node: WaitEventNodeDefinition = {
      kind: 'WAIT_EVENT',
      key: 'w1',
      eventName: 'order.paid',
      correlation: inputPath(['orderId']),
      timeout: { afterMs: lit(1_000_000), outcomeKey: 'timedOut' },
    };
    expect(() => evaluateWaitEventNode(node, baseContext, limits, now)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('rejects a correlation expression that evaluates to a non-scalar', () => {
    const node: WaitEventNodeDefinition = { kind: 'WAIT_EVENT', key: 'w1', eventName: 'order.paid', correlation: { op: 'LITERAL', value: { a: 1 } } };
    expect(() => evaluateWaitEventNode(node, baseContext, limits, now)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });
});
