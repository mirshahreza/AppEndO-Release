import type { AiModelEntry } from '../api/contracts/ai/types';
import { isAiModelChatCapable } from '../api/contracts/ai/constants';

/** Preferred agent models (first enabled match wins). */
export const AGENT_MODEL_PRIORITY_IDS: readonly string[] = [
  'anthropic-claude-sonnet-5',
  'anthropic-claude-sonnet-4-6',
  'openai-gpt-4-1',
  'anthropic-claude-opus-4-8',
  'gemini-3-1-pro',
  'gemini-2-5-pro',
  'openai-gpt-5-4',
  'azure-openai-gpt-4-1',
  'anthropic-claude-haiku-4-5',
  'gemini-2-5-flash',
];

/** Fast/cheap models for classifiers and summarizers (first enabled match wins). */
export const FAST_CLASSIFIER_MODEL_PRIORITY_IDS: readonly string[] = [
  'gemini-2-5-flash-lite',
  'anthropic-claude-haiku-4-5',
  'gemini-2-5-flash',
  'openai-gpt-4-1-mini',
  'openai-gpt-4-1-nano',
];

const isAgentCapableModel = (model: AiModelEntry): boolean => (
  model.enabled
  && isAiModelChatCapable(model)
  && Boolean(model.capabilities.tools)
);

/**
 * Pick the strongest enabled tools-capable model for Agent/Plan runs.
 * Falls back to `fallbackModelId` when no priority match exists.
 */
export const resolvePreferredAgentModelId = (
  models: readonly AiModelEntry[],
  fallbackModelId: string,
): string => {
  const capable = models.filter(isAgentCapableModel);
  if (capable.length === 0) {
    return fallbackModelId;
  }

  for (const preferredId of AGENT_MODEL_PRIORITY_IDS) {
    const match = capable.find((model) => model.id === preferredId);
    if (match) return match.id;
  }

  const byContext = [...capable].sort(
    (left, right) => (right.contextWindowTokens ?? 0) - (left.contextWindowTokens ?? 0),
  );
  return byContext[0]?.id ?? fallbackModelId;
};

export const resolveFastClassifierModelId = (
  models: readonly AiModelEntry[],
  fallbackModelId: string,
): string => {
  const capable = models.filter((model) => model.enabled && isAiModelChatCapable(model));
  if (capable.length === 0) {
    return fallbackModelId;
  }

  for (const preferredId of FAST_CLASSIFIER_MODEL_PRIORITY_IDS) {
    const match = capable.find((model) => model.id === preferredId);
    if (match) return match.id;
  }

  return capable[0]?.id ?? fallbackModelId;
};

export const shouldAutoUpgradeAgentModel = (
  selectedModelId: string | undefined,
  defaultModelId: string,
): boolean => {
  const base = selectedModelId?.trim() || defaultModelId;
  return !selectedModelId?.trim()
    || base === defaultModelId
    || base === 'gemini-2-5-flash-lite'
    || base === 'openai-gpt-4-1-nano'
    || base === 'openai-gpt-4-1-mini';
};
