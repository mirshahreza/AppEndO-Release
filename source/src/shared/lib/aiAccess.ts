import type { AiModelPublicEntry, AiProviderKind, AiProviderPublicConfig } from '../api/contracts/ai/types';

const providerRequiresApiKey = (provider: AiProviderKind) => provider !== 'ollama';

export function isAiGloballyEnabled(enabled: boolean | undefined): boolean {
  return enabled === true;
}

export function hasConfiguredAiProvider(
  providers: AiProviderPublicConfig[] | undefined,
  models: AiModelPublicEntry[] | undefined,
): boolean {
  if ((providers ?? []).some((provider) => !providerRequiresApiKey(provider.provider) || provider.hasApiKey)) {
    return true;
  }

  return (models ?? []).some((model) => model.enabled && model.provider === 'ollama');
}
