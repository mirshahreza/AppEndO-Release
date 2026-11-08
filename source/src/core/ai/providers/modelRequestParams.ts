import type { AiModelEntry } from '../../../shared/api/contracts/ai/types';
import {
  buildOpenAiTokenLimitField,
  isUnsupportedTemperatureError,
  usesMaxCompletionTokens,
} from './openAiModelRouting';

/** Models that reject custom temperature — only the API default (1) is allowed. */
const FIXED_TEMPERATURE_MODEL_PATTERNS = [
  /^o\d/,
  /^gpt-5(?:\.|$|-)/,
];

export const omitsTemperatureParam = (modelId: string): boolean => {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return false;
  return FIXED_TEMPERATURE_MODEL_PATTERNS.some((pattern) => pattern.test(normalized));
};

type RequestParamsSource = Pick<
  AiModelEntry,
  'modelId' | 'requestParams' | 'maxOutputTokens' | 'temperatureDefault'
>;

const normalizeTokenFields = (
  modelId: string,
  params: Record<string, unknown>,
): Record<string, unknown> => {
  const normalized = { ...params };

  if (!usesMaxCompletionTokens(modelId)) {
    return normalized;
  }

  if ('max_tokens' in normalized && !('max_completion_tokens' in normalized)) {
    const { max_tokens: maxTokens, ...rest } = normalized;
    if (typeof maxTokens === 'number') {
      return { ...rest, max_completion_tokens: maxTokens };
    }
  }

  return normalized;
};

export const sanitizeRequestParams = (
  modelId: string,
  params: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!params || Object.keys(params).length === 0) {
    return undefined;
  }

  let normalized = normalizeTokenFields(modelId, params);

  if (omitsTemperatureParam(modelId) && 'temperature' in normalized) {
    const { temperature: _temperature, ...rest } = normalized;
    normalized = rest;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

/**
 * Resolves API body parameters for a model invocation.
 * Explicit `requestParams` wins; legacy scalar fields are mapped only as a fallback.
 */
export const resolveEffectiveRequestParams = (
  entry: RequestParamsSource,
): Record<string, unknown> | undefined => {
  if (entry.requestParams && Object.keys(entry.requestParams).length > 0) {
    return sanitizeRequestParams(entry.modelId, entry.requestParams);
  }

  const params: Record<string, unknown> = {};

  if (entry.maxOutputTokens !== undefined) {
    Object.assign(params, buildOpenAiTokenLimitField(entry.modelId, entry.maxOutputTokens));
  }

  if (entry.temperatureDefault !== undefined && !omitsTemperatureParam(entry.modelId)) {
    params.temperature = entry.temperatureDefault;
  }

  return sanitizeRequestParams(entry.modelId, params);
};

export const migrateModelRequestParams = (entry: AiModelEntry): AiModelEntry => {
  const requestParams = resolveEffectiveRequestParams(entry);
  return {
    ...entry,
    requestParams,
    maxOutputTokens: undefined,
    temperatureDefault: undefined,
  };
};

export { isUnsupportedTemperatureError } from './openAiModelRouting';
