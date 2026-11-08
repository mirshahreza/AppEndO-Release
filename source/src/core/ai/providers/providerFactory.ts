import type { AiModelEntry, AiProviderConfig } from '../../../shared/api/contracts/ai/types';
import {
  resolveAiProviderConfig,
  resolveModelRuntimeBaseUrl,
} from '../../../shared/api/contracts/ai/validators';
import type { AiSettings } from '../../../shared/api/contracts/ai/types';
import type { IAiProvider } from '../IAiProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { AzureOpenAiProvider } from './AzureOpenAiProvider';
import { GeminiProvider } from './GeminiProvider';
import { OllamaProvider } from './OllamaProvider';
import { OpenAiCompatibleProvider } from './OpenAiCompatibleProvider';
import { OpenAiProvider } from './OpenAiProvider';
import type { ProviderRuntimeConfig } from './providerUtils';
import { resolveEffectiveRequestParams } from './modelRequestParams';

const toRuntimeConfig = (
  entry: AiModelEntry,
  providerConfig?: AiProviderConfig,
): ProviderRuntimeConfig => ({
  displayName: entry.name,
  modelId: entry.modelId,
  baseUrl: resolveModelRuntimeBaseUrl(entry, providerConfig),
  apiKey: providerConfig?.apiKey,
  apiVersion: entry.apiVersion,
  deploymentName: entry.deploymentName,
  organizationId: providerConfig?.organizationId,
  timeoutMs: entry.timeoutMs,
  requestParams: resolveEffectiveRequestParams(entry),
});

export const createProviderForModel = (
  entry: AiModelEntry,
  providerConfig?: AiProviderConfig,
): IAiProvider => {
  const config = toRuntimeConfig(entry, providerConfig);

  switch (entry.provider) {
    case 'google-gemini':
      return new GeminiProvider(config);
    case 'openai':
      return new OpenAiProvider(config);
    case 'azure-openai':
      return new AzureOpenAiProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'openai-compatible':
      return new OpenAiCompatibleProvider(config);
    case 'openrouter':
      return new OpenAiCompatibleProvider(config);
    default:
      throw new Error(`Unsupported provider "${entry.provider}".`);
  }
};

export const createProviderForSettingsModel = (
  settings: AiSettings,
  entry: AiModelEntry,
): IAiProvider => {
  const providerConfig = resolveAiProviderConfig(settings, entry.provider);
  return createProviderForModel(entry, providerConfig);
};

export const testProviderConnection = async (provider: IAiProvider): Promise<string> => {
  if ('testConnection' in provider && typeof provider.testConnection === 'function') {
    return provider.testConnection();
  }
  return provider.chat([{ role: 'user', content: 'ping' }]);
};
