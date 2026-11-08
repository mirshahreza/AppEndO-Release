import { describe, expect, it } from 'vitest';

import { omitsTemperatureParam, resolveEffectiveRequestParams, sanitizeRequestParams } from '../modelRequestParams';

describe('omitsTemperatureParam', () => {
  it('returns true for OpenAI o-series and gpt-5 models', () => {
    expect(omitsTemperatureParam('o3')).toBe(true);
    expect(omitsTemperatureParam('o4-mini')).toBe(true);
    expect(omitsTemperatureParam('gpt-5.4')).toBe(true);
    expect(omitsTemperatureParam('gpt-5.5')).toBe(true);
  });

  it('returns false for standard chat models', () => {
    expect(omitsTemperatureParam('gpt-4o')).toBe(false);
    expect(omitsTemperatureParam('gpt-4.1')).toBe(false);
  });
});

describe('sanitizeRequestParams', () => {
  it('strips temperature from explicit requestParams on fixed-temperature models', () => {
    expect(sanitizeRequestParams('gpt-5.4', {
      max_completion_tokens: 128000,
      temperature: 0.7,
    })).toEqual({ max_completion_tokens: 128000 });
  });

  it('maps max_tokens to max_completion_tokens for newer models', () => {
    expect(sanitizeRequestParams('gpt-5.4', {
      max_tokens: 4096,
      temperature: 0.7,
    })).toEqual({ max_completion_tokens: 4096 });
  });
});

describe('resolveEffectiveRequestParams', () => {
  it('sanitizes explicit requestParams', () => {
    expect(resolveEffectiveRequestParams({
      modelId: 'o3',
      requestParams: { max_completion_tokens: 8192, temperature: 0.7 },
    })).toEqual({ max_completion_tokens: 8192 });
  });

  it('maps legacy fields when requestParams is empty', () => {
    expect(resolveEffectiveRequestParams({
      modelId: 'gpt-4o',
      maxOutputTokens: 2048,
      temperatureDefault: 0.7,
    })).toEqual({ max_tokens: 2048, temperature: 0.7 });
  });

  it('omits temperature for o-series models in legacy fallback', () => {
    expect(resolveEffectiveRequestParams({
      modelId: 'o3',
      maxOutputTokens: 8192,
      temperatureDefault: 0.7,
    })).toEqual({ max_completion_tokens: 8192 });
  });
});
