import { describe, expect, it } from 'vitest';

import {
  buildOpenAiTokenLimitField,
  isMaxTokensUnsupportedError,
  supportsOpenAiResponsesImageGeneration,
  usesMaxCompletionTokens,
} from '../openAiModelRouting';

describe('usesMaxCompletionTokens', () => {
  it('returns true for newer OpenAI reasoning and GPT-5 models', () => {
    expect(usesMaxCompletionTokens('gpt-5.4')).toBe(true);
    expect(usesMaxCompletionTokens('gpt-5.5')).toBe(true);
    expect(usesMaxCompletionTokens('gpt-4.1')).toBe(true);
    expect(usesMaxCompletionTokens('gpt-4.1-mini')).toBe(true);
    expect(usesMaxCompletionTokens('o3')).toBe(true);
    expect(usesMaxCompletionTokens('o4-mini')).toBe(true);
  });

  it('returns false for legacy chat models', () => {
    expect(usesMaxCompletionTokens('gpt-4o')).toBe(false);
    expect(usesMaxCompletionTokens('gpt-4o-mini')).toBe(false);
    expect(usesMaxCompletionTokens('gpt-3.5-turbo')).toBe(false);
  });
});

describe('buildOpenAiTokenLimitField', () => {
  it('maps max_output_tokens setting to the correct API field', () => {
    expect(buildOpenAiTokenLimitField('gpt-4o', 2048)).toEqual({ max_tokens: 2048 });
    expect(buildOpenAiTokenLimitField('gpt-5.4', 4096)).toEqual({ max_completion_tokens: 4096 });
  });

  it('uses fallback when max output tokens are unset', () => {
    expect(buildOpenAiTokenLimitField('gpt-4o', undefined)).toEqual({ max_tokens: 8192 });
    expect(buildOpenAiTokenLimitField('o3', undefined, 512)).toEqual({ max_completion_tokens: 512 });
  });
});

describe('supportsOpenAiResponsesImageGeneration', () => {
  it('returns true for mainline models with Responses image_generation support', () => {
    expect(supportsOpenAiResponsesImageGeneration('gpt-5.5')).toBe(true);
    expect(supportsOpenAiResponsesImageGeneration('gpt-5.4-mini')).toBe(true);
    expect(supportsOpenAiResponsesImageGeneration('gpt-4o')).toBe(true);
    expect(supportsOpenAiResponsesImageGeneration('o3')).toBe(true);
  });

  it('returns false for dedicated image models and responses-only codex models', () => {
    expect(supportsOpenAiResponsesImageGeneration('gpt-image-1')).toBe(false);
    expect(supportsOpenAiResponsesImageGeneration('dall-e-2')).toBe(false);
    expect(supportsOpenAiResponsesImageGeneration('gpt-5-codex')).toBe(false);
    expect(supportsOpenAiResponsesImageGeneration('gpt-5-pro')).toBe(false);
  });
});

describe('isMaxTokensUnsupportedError', () => {
  it('detects OpenAI max_tokens migration errors', () => {
    expect(isMaxTokensUnsupportedError(
      "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
    )).toBe(true);
    expect(isMaxTokensUnsupportedError('Invalid API key')).toBe(false);
  });
});
