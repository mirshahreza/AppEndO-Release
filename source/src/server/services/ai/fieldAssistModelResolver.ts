import { aiManager } from '../../../core/ai/AiManager';
import type { AiSettings } from '../../../shared/api/contracts/ai/types';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';

/**
 * Resolves a chat-capable model for EUA field assist.
 * Prefers platform default when it supports chat; otherwise first enabled chat model.
 */
export function resolveFieldAssistChatModelId(
  settings: AiSettings,
  requestedModelId?: string,
): string | null {
  const chatModelIds = settings.models
    .filter((model) => model.enabled && isAiModelChatCapable(model))
    .map((model) => model.id);

  if (chatModelIds.length === 0) {
    return null;
  }

  const tryResolve = (modelId: string): string | null => {
    try {
      const { entry } = aiManager.resolveModel(modelId);
      return isAiModelChatCapable(entry) ? entry.id : null;
    } catch {
      return null;
    }
  };

  const trimmedRequest = requestedModelId?.trim();
  if (trimmedRequest) {
    return tryResolve(trimmedRequest);
  }

  const candidateIds = [
    settings.defaultModelId,
    ...chatModelIds,
  ].filter((id, index, list) => Boolean(id) && list.indexOf(id) === index);

  for (const candidateId of candidateIds) {
    const resolved = tryResolve(candidateId);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export function isFieldAssistReady(settings: AiSettings | null | undefined): boolean {
  if (!settings?.enabled) {
    return false;
  }
  return resolveFieldAssistChatModelId(settings) !== null;
}
