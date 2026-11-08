import {
  AI_PROVIDER_SETUP_TEMPLATES,
  DEFAULT_AI_CAPABILITIES,
  buildAiProviderConfigFromTemplate,
} from '../../../../shared/api/contracts/ai/constants';
import type { AiGlobalSettings, AiModelEntry, AiProviderConfig, AiProviderKind } from '../../../../shared/api/contracts/ai/types';

export const EMPTY_AI_MODEL_FORM: AiModelEntry = {
  id: '',
  name: '',
  provider: 'google-gemini',
  providerLabel: 'Google Gemini',
  modelId: '',
  enabled: true,
  isDefault: false,
  baseUrl: '',
  apiVersion: '',
  deploymentName: '',
  capabilities: { ...DEFAULT_AI_CAPABILITIES },
  contextWindowTokens: undefined,
  maxOutputTokens: undefined,
  temperatureDefault: undefined,
  timeoutMs: 60000,
  requestParams: undefined,
};

const defaultCreateProviderTemplateId = AI_PROVIDER_SETUP_TEMPLATES[0]?.id ?? 'openai';

export const EMPTY_AI_PROVIDER_FORM: AiProviderConfig = buildAiProviderConfigFromTemplate(defaultCreateProviderTemplateId);

export const DEFAULT_AI_GLOBAL: AiGlobalSettings = {
  enabled: true,
  defaultModelId: '',
  chatRateLimitPerMinute: 20,
};

export const PROVIDER_BADGE_CLASS = 'bg-violet-50 text-violet-700 border-violet-100';

/** Default model badge beside the model name (auto width). */
export const AI_MODELS_STATUS_BADGE_CLASS =
  'inline-flex h-5 shrink-0 items-center gap-1 rounded-md border bg-white px-2 text-[10px] font-semibold whitespace-nowrap';

/** Set as default action beside the model name (auto width). */
export const AI_MODELS_SET_DEFAULT_BUTTON_CLASS =
  'inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold whitespace-nowrap shadow-sm';

/** Test + delete icon slots on model rows. */
export const AI_MODELS_ACTION_SLOT_WIDTH = 20;
export const AI_MODELS_ACTION_SEPARATOR_SLOT_WIDTH = 7;
export const AI_MODELS_ACTION_CELL_HORIZONTAL_PADDING = 3;
export const AI_MODELS_ACTION_COLUMN_WIDTH =
  AI_MODELS_ACTION_CELL_HORIZONTAL_PADDING * 2
  + (AI_MODELS_ACTION_SLOT_WIDTH * 2)
  + AI_MODELS_ACTION_SEPARATOR_SLOT_WIDTH;

export const AI_MODELS_ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-md transition-colors';

export const slugifyModelId = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
);

export const providerRequiresApiKey = (provider: AiProviderKind) => provider !== 'ollama';

export const providerRequiresAzureFields = (provider: AiProviderKind) => provider === 'azure-openai';

/** Providers backed by an OpenAI-style client, which exposes GET /models for browsing. */
export const providerSupportsRemoteModelList = (provider: AiProviderKind) => (
  provider === 'openai' || provider === 'openai-compatible' || provider === 'openrouter'
);
