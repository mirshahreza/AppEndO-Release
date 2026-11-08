import { describe, expect, it } from 'vitest';
import { evaluateAutomatedAcceptancePromptGates } from '../goldenEvalAcceptancePrompts';

describe('goldenEvalAcceptancePrompts (§13.2 automated)', () => {
  it('passes automated MQA-15 prompt gates', async () => {
    const results = await evaluateAutomatedAcceptancePromptGates();
    expect(results.every((result) => result.passed), results.flatMap((r) => r.failures).join('; ')).toBe(true);
    expect(results.map((result) => result.promptNumber).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
