import { describe, expect, it } from 'vitest';
import { resolveServerFunctionDraftOperation } from '../serverFunctionDraftOperation';

describe('resolveServerFunctionDraftOperation', () => {
  it('marks update when the open editor function matches the draft target', () => {
    expect(resolveServerFunctionDraftOperation({
      targetFunctionId: 'math.sum-two-numbers',
      pageFunctionId: 'math.sum-two-numbers',
    })).toEqual({
      operation: 'update',
      baseFunctionId: 'math.sum-two-numbers',
    });
  });

  it('marks create when another function is open but the draft targets a new id', () => {
    expect(resolveServerFunctionDraftOperation({
      targetFunctionId: 'math.multiply-two-numbers',
      pageFunctionId: 'math.sum-two-numbers',
      explicitFunctionId: 'math.multiply-two-numbers',
    })).toEqual({ operation: 'create' });
  });

  it('marks update for explicit patch without editor context', () => {
    expect(resolveServerFunctionDraftOperation({
      targetFunctionId: 'math.sum-two-numbers',
      explicitFunctionId: 'math.sum-two-numbers',
    })).toEqual({
      operation: 'update',
      baseFunctionId: 'math.sum-two-numbers',
    });
  });
});
