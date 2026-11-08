import { describe, expect, it } from 'vitest';
import { evaluateWorkItemCreation } from '../nodeExecution';
import type { EvaluationContext } from '../expressionEvaluator';
import type { CanonicalExpression, WorkItemNodeDefinition } from '../../awm/types';

const lit = (value: unknown): CanonicalExpression => ({ op: 'LITERAL', value: value as never });
const inputPath = (segments: (string | number)[]): CanonicalExpression => ({ op: 'PATH', path: { root: { type: 'WORKFLOW_INPUT' }, segments } });

const baseContext: EvaluationContext = { workflowInput: { requesterId: '77' }, variables: {}, nodeOutputs: {}, currentNodeInput: null };
const limits = { maxWorkItemTitleLength: 50 };

const baseNode = (overrides: Partial<WorkItemNodeDefinition> = {}): WorkItemNodeDefinition => ({
  kind: 'WORK_ITEM',
  key: 'w1',
  workItemType: 'APPROVAL',
  assignment: { strategy: 'USER', userId: '42' },
  allowedOutcomes: ['APPROVE', 'REJECT'],
  title: lit('Approve request'),
  input: { type: 'OBJECT', fields: {} },
  outputSchema: { type: 'INLINE', schema: {} },
  ...overrides,
});

describe('evaluateWorkItemCreation', () => {
  it('USER strategy: resolves the literal userId string to a numeric assignee', () => {
    const resolved = evaluateWorkItemCreation(baseNode(), baseContext, limits);
    expect(resolved.assignmentStrategy).toBe('USER');
    expect(resolved.resolvedAssignment).toEqual({ type: 'USER', userId: 42 });
    expect(JSON.parse(resolved.assignmentEvidenceJson)).toMatchObject({ resolvedType: 'USER', resolvedUserId: 42 });
  });

  it('ROLE strategy: resolves the literal roleId', () => {
    const resolved = evaluateWorkItemCreation(baseNode({ assignment: { strategy: 'ROLE', roleId: 'APPROVERS' } }), baseContext, limits);
    expect(resolved.resolvedAssignment).toEqual({ type: 'ROLE', roleId: 'APPROVERS' });
    expect(JSON.parse(resolved.assignmentEvidenceJson)).toMatchObject({ resolvedType: 'ROLE', resolvedRoleId: 'APPROVERS' });
  });

  it('EXPRESSION strategy: resolves to a USER descriptor', () => {
    const expr: CanonicalExpression = {
      op: 'LITERAL',
      value: { type: 'USER', id: '77' },
    };
    const resolved = evaluateWorkItemCreation(baseNode({ assignment: { strategy: 'EXPRESSION', expression: expr } }), baseContext, limits);
    expect(resolved.resolvedAssignment).toEqual({ type: 'USER', userId: 77 });
  });

  it('EXPRESSION strategy: resolves dynamically from workflow input to a ROLE descriptor', () => {
    const expr: CanonicalExpression = { op: 'LITERAL', value: { type: 'ROLE', id: 'REVIEWERS' } };
    const resolved = evaluateWorkItemCreation(baseNode({ assignment: { strategy: 'EXPRESSION', expression: expr } }), baseContext, limits);
    expect(resolved.resolvedAssignment).toEqual({ type: 'ROLE', roleId: 'REVIEWERS' });
  });

  it('EXPRESSION strategy: rejects a shape that is not exactly {type,id}', () => {
    const expr: CanonicalExpression = { op: 'LITERAL', value: { type: 'TEAM', id: 'x' } };
    expect(() => evaluateWorkItemCreation(baseNode({ assignment: { strategy: 'EXPRESSION', expression: expr } }), baseContext, limits)).toThrow(
      expect.objectContaining({ code: 'WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED' }),
    );
  });

  it('EXPRESSION strategy: rejects an arbitrary candidate list rather than one descriptor', () => {
    const expr: CanonicalExpression = { op: 'LITERAL', value: [{ type: 'USER', id: '1' }, { type: 'USER', id: '2' }] };
    expect(() => evaluateWorkItemCreation(baseNode({ assignment: { strategy: 'EXPRESSION', expression: expr } }), baseContext, limits)).toThrow(
      expect.objectContaining({ code: 'WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED' }),
    );
  });

  it('USER strategy: rejects a non-numeric userId string', () => {
    expect(() => evaluateWorkItemCreation(baseNode({ assignment: { strategy: 'USER', userId: 'not-a-number' } }), baseContext, limits)).toThrow(
      expect.objectContaining({ code: 'WF_EXEC_ASSIGNMENT_RESOLUTION_FAILED' }),
    );
  });

  it('evaluates title/summary once and persists verbatim', () => {
    const resolved = evaluateWorkItemCreation(baseNode({ summary: lit('needs review') }), baseContext, limits);
    expect(resolved.titleText).toBe('Approve request');
    expect(resolved.summaryText).toBe('needs review');
  });

  it('rejects an empty title', () => {
    expect(() => evaluateWorkItemCreation(baseNode({ title: lit('') }), baseContext, limits)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('rejects a title exceeding maxWorkItemTitleLength', () => {
    expect(() => evaluateWorkItemCreation(baseNode({ title: lit('x'.repeat(51)) }), baseContext, limits)).toThrow(expect.objectContaining({ code: 'WF_EXEC_EXPRESSION_FAILED' }));
  });

  it('evaluates input mapping and serializes to JSON', () => {
    const resolved = evaluateWorkItemCreation(
      baseNode({ input: { type: 'OBJECT', fields: { requesterId: { type: 'EXPRESSION', expression: inputPath(['requesterId']) } } } }),
      baseContext,
      limits,
    );
    expect(JSON.parse(resolved.inputJson)).toEqual({ requesterId: '77' });
  });

  it('defaults priority to 0 and carries allowedOutcomes/outputSchema through', () => {
    const resolved = evaluateWorkItemCreation(baseNode(), baseContext, limits);
    expect(resolved.priority).toBe(0);
    expect(resolved.allowedOutcomes).toEqual(['APPROVE', 'REJECT']);
    expect(JSON.parse(resolved.outputSchemaJson)).toEqual({ type: 'INLINE', schema: {} });
  });
});
