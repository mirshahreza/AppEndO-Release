import { describe, expect, it } from 'vitest';
import {
  isOpenAiImageEditProvider,
  shouldUseDedicatedOpenAiImageApi,
  shouldUseOpenAiResponsesImageApi,
  supportsOpenAiImageEdits,
  supportsOpenAiImageEditsForEntry,
} from '../openAiImageEdit';

describe('openAiImageEdit', () => {
  it('supports dall-e-2 and gpt-image edit models', () => {
    expect(supportsOpenAiImageEdits('dall-e-2')).toBe(true);
    expect(supportsOpenAiImageEdits('DALL-E-2')).toBe(true);
    expect(supportsOpenAiImageEdits('gpt-image-1')).toBe(true);
    expect(supportsOpenAiImageEdits('gpt-image-1.5')).toBe(true);
    expect(supportsOpenAiImageEdits('chatgpt-image-latest')).toBe(true);
    expect(supportsOpenAiImageEdits('dall-e-3')).toBe(false);
  });

  it('matches deployment names for azure-style entries', () => {
    expect(supportsOpenAiImageEditsForEntry({
      modelId: 'custom-alias',
      deploymentName: 'gpt-image-1',
    })).toBe(true);
  });

  it('recognizes supported image edit providers', () => {
    expect(isOpenAiImageEditProvider('openai')).toBe(true);
    expect(isOpenAiImageEditProvider('azure-openai')).toBe(true);
    expect(isOpenAiImageEditProvider('openai-compatible')).toBe(true);
    expect(isOpenAiImageEditProvider('google-gemini')).toBe(false);
  });

  it('routes dedicated image models through the Images API', () => {
    expect(shouldUseDedicatedOpenAiImageApi({
      provider: 'openai',
      modelId: 'gpt-image-1',
      deploymentName: null,
    })).toBe(true);
    expect(shouldUseDedicatedOpenAiImageApi({
      provider: 'openai',
      modelId: 'gpt-5.5',
      deploymentName: null,
    })).toBe(false);
  });

  it('routes mainline models through the Responses image_generation tool', () => {
    expect(shouldUseOpenAiResponsesImageApi({
      provider: 'openai',
      modelId: 'gpt-5.5',
      deploymentName: null,
    })).toBe(true);
    expect(shouldUseOpenAiResponsesImageApi({
      provider: 'openai',
      modelId: 'gpt-image-1',
      deploymentName: null,
    })).toBe(false);
  });
});
