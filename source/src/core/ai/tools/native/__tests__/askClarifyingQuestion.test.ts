import { describe, expect, it } from 'vitest';
import { askClarifyingQuestionTool } from '../askClarifyingQuestion';
import { testToolExecutionContext } from '../../../agent/__tests__/testAgentFixtures';

describe('askClarifyingQuestionTool', () => {
  it('returns question payload for the chat UI', async () => {
    const result = await askClarifyingQuestionTool.execute({
      question: 'Which function do you want?',
      options: '["math.sum-two-numbers","users.list"]',
      reason: 'Several functions matched the search',
    }, testToolExecutionContext);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        question: 'Which function do you want?',
        options: ['math.sum-two-numbers', 'users.list'],
        reason: 'Several functions matched the search',
      });
    }
  });

  it('rejects empty question', async () => {
    const result = await askClarifyingQuestionTool.execute({ question: '   ' }, testToolExecutionContext);
    expect(result.ok).toBe(false);
  });
});
