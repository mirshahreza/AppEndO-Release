import { describe, expect, it } from 'vitest';
import { classifyRetrievalProfile } from '../explorerBenchmark';

describe('V5 P05 § V5-8 — classifyRetrievalProfile', () => {
  it('classifies a failing-test signal as BUILD_FAILURE regardless of prompt text', () => {
    expect(classifyRetrievalProfile({ userPrompt: 'fix this', hasFailingTestSignature: true })).toBe('BUILD_FAILURE');
  });

  it('classifies a request with an active server function page context as APPENDO_SERVER_FUNCTION_UI', () => {
    expect(classifyRetrievalProfile({ userPrompt: 'add a field', pageContextFunctionId: 'math.sum-two-numbers' })).toBe('APPENDO_SERVER_FUNCTION_UI');
  });

  it('classifies bug-shaped language as BUG_FIX', () => {
    expect(classifyRetrievalProfile({ userPrompt: 'the login crashes with an error' })).toBe('BUG_FIX');
  });

  it('classifies dependency-shaped language as DEPENDENCY_UPGRADE', () => {
    expect(classifyRetrievalProfile({ userPrompt: 'upgrade the react version in package.json' })).toBe('DEPENDENCY_UPGRADE');
  });

  it('classifies question-shaped language as REPOSITORY_QUESTION', () => {
    expect(classifyRetrievalProfile({ userPrompt: 'how does the retrieve gate work?' })).toBe('REPOSITORY_QUESTION');
  });

  it('defaults to FEATURE for plain implementation requests', () => {
    expect(classifyRetrievalProfile({ userPrompt: 'add a dark mode toggle' })).toBe('FEATURE');
  });
});
