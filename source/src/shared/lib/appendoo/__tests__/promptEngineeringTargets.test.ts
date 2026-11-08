import { describe, expect, it } from 'vitest';
import {
  extractPromptEngineeringTargets,
  hasPromptEngineeringTargets,
  mergePromptTargetsIntoPageContext,
  promptTargetsConflictWithPage,
} from '../promptEngineeringTargets';

describe('promptEngineeringTargets', () => {
  it('extracts canonical function ids and api paths', () => {
    expect(extractPromptEngineeringTargets('build UI for math.sum-two-numbers')).toEqual({
      functionId: 'math.sum-two-numbers',
      functionName: 'sum-two-numbers',
    });
    expect(extractPromptEngineeringTargets('wire /api/math/sum-two-numbers')).toEqual({
      functionId: 'math.sum-two-numbers',
      functionName: 'sum-two-numbers',
      apiPath: '/api/math/sum-two-numbers',
    });
  });

  it('extracts kebab-case function names from UI requests', () => {
    const targets = extractPromptEngineeringTargets('Build a user interface for sum-two-numbers');
    expect(targets.functionName).toBe('sum-two-numbers');
  });

  it('merges prompt targets over unrelated page context', () => {
    const merged = mergePromptTargetsIntoPageContext(
      {
        path: '/us/studio/users',
        pageLabel: 'Users',
        pageKey: 'users',
      },
      {
        functionId: 'math.sum-two-numbers',
        functionName: 'sum-two-numbers',
      },
    );

    expect(merged?.functionId).toBe('math.sum-two-numbers');
    expect(merged?.pageKey).toBe('users');
  });

  it('detects cross-page prompt targets', () => {
    expect(hasPromptEngineeringTargets({ functionId: 'math.sum-two-numbers' })).toBe(true);
    expect(promptTargetsConflictWithPage(
      { path: '/us/studio/users', pageLabel: 'Users', pageKey: 'users' },
      { functionId: 'math.sum-two-numbers', functionName: 'sum-two-numbers' },
    )).toBe(true);
  });
});
