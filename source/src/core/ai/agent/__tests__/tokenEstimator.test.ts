import { describe, expect, it } from 'vitest';
import { estimateTokens, resolveTokenEstimatorProfile } from '../tokenEstimator';

describe('tokenEstimator (TOK-17)', () => {
  it('resolves model-specific profiles', () => {
    expect(resolveTokenEstimatorProfile('gpt-4o-mini')).toBe('openai');
    expect(resolveTokenEstimatorProfile('gemini-2.5-flash')).toBe('gemini');
    expect(resolveTokenEstimatorProfile('llama-local')).toBe('default');
  });

  it('estimates more tokens for CJK than ASCII-only text of similar length', () => {
    const ascii = estimateTokens('hello world test case', 'gpt-4o');
    const cjk = estimateTokens('你好世界测试用例', 'gpt-4o');
    expect(cjk).toBeGreaterThan(ascii);
  });

  it('returns at least one token for non-empty input', () => {
    expect(estimateTokens('a')).toBeGreaterThanOrEqual(1);
    expect(estimateTokens('')).toBe(0);
  });

  it('gemini profile differs slightly from default for long prose', () => {
    const text = 'export const foo = () => ({ ok: true });'.repeat(20);
    const gemini = estimateTokens(text, 'gemini-2.5-flash');
    const defaultEstimate = estimateTokens(text);
    expect(gemini).not.toBe(defaultEstimate);
  });
});
