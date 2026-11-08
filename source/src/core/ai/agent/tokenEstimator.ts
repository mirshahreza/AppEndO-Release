/** Lightweight token estimator (TOK-17) — no tiktoken dependency. */

export type TokenEstimatorProfile = 'default' | 'openai' | 'gemini';

const CJK_CHAR_PATTERN = /[\u2E80-\u9FFF\uF900-\uFAFF]/;

export const resolveTokenEstimatorProfile = (modelId: string): TokenEstimatorProfile => {
  const id = modelId.toLowerCase();
  if (id.includes('gpt') || id.includes('openai') || id.includes('claude')) {
    return 'openai';
  }
  if (id.includes('gemini')) {
    return 'gemini';
  }
  return 'default';
};

const charWeight = (char: string, profile: TokenEstimatorProfile): number => {
  if (CJK_CHAR_PATTERN.test(char)) {
    return profile === 'openai' ? 1.6 : 1.5;
  }
  if (/\s/.test(char)) {
    return 0.15;
  }
  return profile === 'gemini' ? 0.22 : 0.25;
};

/** Estimate tokens for a string; optional modelId tunes the heuristic. */
export const estimateTokens = (text: string, modelId?: string): number => {
  if (!text) return 0;
  const profile = modelId ? resolveTokenEstimatorProfile(modelId) : 'default';
  let total = 0;
  for (const char of text) {
    total += charWeight(char, profile);
  }
  return Math.max(1, Math.ceil(total));
};
