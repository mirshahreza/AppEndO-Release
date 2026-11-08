import type { AiModelEntry, AiSettings } from '../../../shared/api/contracts/ai/types';
import { resolveEuaCapabilitiesFromSettings } from '../../../shared/api/contracts/ai/euaAssistSettings';
import { isFieldAssistReady, resolveFieldAssistChatModelId } from './fieldAssistModelResolver';

export function resolveEuaCapabilities(settings: AiSettings | null | undefined, ready = isFieldAssistReady(settings)) {
  return resolveEuaCapabilitiesFromSettings(ready, settings?.eua);
}

export function resolveEuaVisionModelId(
  settings: AiSettings,
  requestedModelId?: string,
): string | null {
  const preferred = requestedModelId?.trim()
    || settings.eua?.defaultVisionModelId?.trim()
    || settings.defaultModelId?.trim();

  const enabled = settings.models.filter((model) => model.enabled);
  if (!enabled.length) {
    return null;
  }

  const isVisionCapable = (model: AiModelEntry) => (
    model.capabilities.vision || model.capabilities.chat
  );

  if (preferred) {
    const match = enabled.find((model) => model.id === preferred && isVisionCapable(model));
    if (match) {
      return match.id;
    }
  }

  const visionModel = enabled.find((model) => model.capabilities.vision);
  if (visionModel) {
    return visionModel.id;
  }

  return resolveFieldAssistChatModelId(settings);
}
