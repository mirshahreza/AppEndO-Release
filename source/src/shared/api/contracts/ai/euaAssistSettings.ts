import {
  buildDefaultEuaCapabilities,
  EUA_CAPABILITY_KEYS,
  type EuaCapabilityKey,
} from './euaFieldAssist';

export type EuaCapabilityToggleLabels = Record<EuaCapabilityKey, string>;

export const EUA_CAPABILITY_TOGGLE_LABELS: EuaCapabilityToggleLabels = {
  'eua.contextMenu': 'Textarea context menu',
  'eua.autocomplete': 'Autocomplete / ghost text',
  'eua.singleLineAssist': 'Single-line input assist',
  'eua.diffUndo': 'Diff preview and undo',
  'eua.contextSuggest': 'Context-aware suggestions',
  'eua.structuredExtract': 'Structured extract / fill from text',
  'eua.voiceFormFill': 'Voice form fill (published)',
  'eua.voiceTtsConfirm': 'Voice confirmation (published)',
  'eua.textToForm': 'Text-to-form (published)',
  'eua.sectionScopedFill': 'Section-scoped fill',
  'eua.imageEditorAi': 'Image editor AI',
  'eua.imageOcr': 'Image OCR → text',
  'eua.imageAltText': 'Image alt text',
  'eua.semanticValidation': 'Semantic field validation (LLM)',
  'eua.vocabContextAuthoring': 'Edit vocab guidance on page (admin)',
};

export type EuaAssistSettings = {
  capabilities: Record<EuaCapabilityKey, boolean>;
  defaultTextModelId?: string;
  defaultVisionModelId?: string;
  userRateLimitPerMinute?: number;
  piiWarningEnabled: boolean;
  piiOptInRequired: boolean;
};

export const DEFAULT_EUA_ASSIST_SETTINGS: EuaAssistSettings = {
  capabilities: EUA_CAPABILITY_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {} as Record<EuaCapabilityKey, boolean>),
  piiWarningEnabled: true,
  piiOptInRequired: false,
};

export function resolveEuaCapabilitiesFromSettings(
  aiReady: boolean,
  euaSettings?: Partial<EuaAssistSettings> | null,
): Record<EuaCapabilityKey, boolean> {
  const base = buildDefaultEuaCapabilities(aiReady);
  if (!aiReady || !euaSettings?.capabilities) {
    return base;
  }

  return EUA_CAPABILITY_KEYS.reduce((acc, key) => {
    const toggle = euaSettings.capabilities?.[key];
    acc[key] = toggle === false ? false : base[key];
    return acc;
  }, {} as Record<EuaCapabilityKey, boolean>);
}

export function normalizeEuaAssistSettings(input: unknown): EuaAssistSettings {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const rawCapabilities = raw.capabilities && typeof raw.capabilities === 'object'
    ? raw.capabilities as Record<string, unknown>
    : {};

  const capabilities = EUA_CAPABILITY_KEYS.reduce((acc, key) => {
    const value = rawCapabilities[key];
    acc[key] = value === false ? false : DEFAULT_EUA_ASSIST_SETTINGS.capabilities[key];
    return acc;
  }, {} as Record<EuaCapabilityKey, boolean>);

  const defaultTextModelId = typeof raw.defaultTextModelId === 'string'
    ? raw.defaultTextModelId.trim() || undefined
    : undefined;
  const defaultVisionModelId = typeof raw.defaultVisionModelId === 'string'
    ? raw.defaultVisionModelId.trim() || undefined
    : undefined;
  const userRateLimitPerMinute = typeof raw.userRateLimitPerMinute === 'number'
    && Number.isFinite(raw.userRateLimitPerMinute)
    && raw.userRateLimitPerMinute > 0
    ? Math.floor(raw.userRateLimitPerMinute)
    : undefined;

  return {
    capabilities,
    defaultTextModelId,
    defaultVisionModelId,
    userRateLimitPerMinute,
    piiWarningEnabled: raw.piiWarningEnabled === false ? false : true,
    piiOptInRequired: raw.piiOptInRequired === true,
  };
}
