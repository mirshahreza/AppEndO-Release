import { describe, expect, it } from 'vitest';
import {
  buildPromptDecompositionUserMessage,
  parsePromptTaskDecomposition,
  shouldRunPromptTaskDecomposition,
} from '../promptTaskDecomposition';

describe('promptTaskDecomposition', () => {
  it('builds English analyst wrapper around user prompt', () => {
    const message = buildPromptDecompositionUserMessage('Build a users CRUD page');
    expect(message).toContain('As a software engineer and analyst');
    expect(message).toContain('smallest actionable work units');
    expect(message).toContain('Build a users CRUD page');
  });

  it('parses JSON decomposition', () => {
    const parsed = parsePromptTaskDecomposition(JSON.stringify({
      summary: 'Add sum API and UI',
      workUnits: ['Retrieve vibe-server-function shard', 'Draft server function', 'Draft component layout'],
      assumptions: ['Uses existing auth'],
      openQuestions: [],
    }));

    expect(parsed?.summary).toBe('Add sum API and UI');
    expect(parsed?.workUnits).toHaveLength(3);
    expect(parsed?.assumptions).toEqual(['Uses existing auth']);
  });

  it('skips decomposition for informational Ask-style prompts', () => {
    const userTest = 'ask: what is the grid standard? or where is VibeHarness defined?';
    expect(shouldRunPromptTaskDecomposition('agent_lookup', userTest)).toBe(false);
    expect(shouldRunPromptTaskDecomposition('ask_lookup', userTest)).toBe(false);
  });

  it('runs decomposition for implementation profile', () => {
    expect(shouldRunPromptTaskDecomposition('agent_implement', 'Build a CRUD with a grid')).toBe(true);
    expect(shouldRunPromptTaskDecomposition('plan_authoring', 'Build a CRUD with a grid')).toBe(false);
  });
});
