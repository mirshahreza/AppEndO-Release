import type { AiModelEntry, AiSettings } from '../../../shared/api/contracts/ai/types';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import {
  shouldUseDedicatedOpenAiImageApi,
  shouldUseOpenAiResponsesImageApi,
} from '../../../core/ai/imageEdit/openAiImageEdit';
import { HttpError } from '../../errors/HttpError';

export type ResolvedImageEditorModel = {
  entry: AiModelEntry;
  usedFallback: boolean;
  requestedName?: string;
};

const canOutputEditedImage = (entry: AiModelEntry): boolean => (
  isAiModelChatCapable(entry)
  && (shouldUseDedicatedOpenAiImageApi(entry) || shouldUseOpenAiResponsesImageApi(entry))
);

export const resolveImageEditorOutputModel = (
  settings: AiSettings,
  requestedModelId?: string,
): ResolvedImageEditorModel => {
  const enabledModels = settings.models.filter((model) => model.enabled && isAiModelChatCapable(model));
  const outputCapable = enabledModels.filter(canOutputEditedImage);

  if (outputCapable.length === 0) {
    throw new HttpError(
      400,
      'No image-editing AI model is configured. Enable a model such as GPT-5.5, gpt-image-1, or dall-e-2 in AI settings.',
    );
  }

  const trimmedRequest = requestedModelId?.trim();
  if (trimmedRequest) {
    const requested = enabledModels.find((model) => model.id === trimmedRequest);
    if (requested && canOutputEditedImage(requested)) {
      return { entry: requested, usedFallback: false };
    }

    const fallback = outputCapable.find((model) => model.isDefault) ?? outputCapable[0];
    return {
      entry: fallback,
      usedFallback: true,
      requestedName: requested?.name ?? trimmedRequest,
    };
  }

  const fallback = outputCapable.find((model) => model.id === settings.defaultModelId)
    ?? outputCapable.find((model) => model.isDefault)
    ?? outputCapable[0];

  return { entry: fallback, usedFallback: false };
};
