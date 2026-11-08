/** End-user AI field assist (EUA) — shared client/server contracts (p-53). */

export const EUA_CAPABILITY_KEYS = [
  'eua.contextMenu',
  'eua.autocomplete',
  'eua.singleLineAssist',
  'eua.diffUndo',
  'eua.contextSuggest',
  'eua.structuredExtract',
  'eua.voiceFormFill',
  'eua.voiceTtsConfirm',
  'eua.textToForm',
  'eua.sectionScopedFill',
  'eua.imageEditorAi',
  'eua.imageOcr',
  'eua.imageAltText',
  'eua.semanticValidation',
  'eua.vocabContextAuthoring',
] as const;

export type EuaCapabilityKey = (typeof EUA_CAPABILITY_KEYS)[number];

export type EuaAssistSurface = 'admin' | 'published';

export type EuaTransformAction =
  | 'expand'
  | 'summarize'
  | 'formal'
  | 'casual'
  | 'spell-grammar'
  | 'markdown-format'
  | 'translate'
  | 'custom';

export type EuaFieldMapEntry = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  sectionId?: string;
  validationHint?: string;
  currentValue?: string;
};

export type EuaFieldKind = 'multiline' | 'singleLine';

export type EuaFieldAssistTransformRequest = {
  action: EuaTransformAction;
  text: string;
  /** When set, only this substring is transformed and merged back into `text`. */
  selection?: string;
  selectionStart?: number;
  selectionEnd?: number;
  customPrompt?: string;
  targetLanguage?: string;
  modelId?: string;
  surface?: EuaAssistSurface;
  fieldLabel?: string;
  /** Shorter prompts and one-line output for `UiInput` assist (EUA-4). */
  fieldKind?: EuaFieldKind;
};

export type EuaFieldAssistTransformResponse = {
  success: boolean;
  text: string;
  modelId?: string;
  error?: string;
};

export type EuaFieldAssistAutocompleteRequest = {
  text: string;
  cursorPosition?: number;
  modelId?: string;
  surface?: EuaAssistSurface;
  fieldLabel?: string;
};

export type EuaFieldAssistAutocompleteResponse = {
  success: boolean;
  completion: string;
  modelId?: string;
  error?: string;
};

export type EuaContextSuggestMode = 'placeholder' | 'content';

export type EuaContextNeighborField = {
  label: string;
  value?: string;
};

export type EuaFieldAssistContextSuggestRequest = {
  mode: EuaContextSuggestMode;
  fieldLabel?: string;
  fieldKind?: EuaFieldKind;
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
  currentValue?: string;
  modelId?: string;
  surface?: EuaAssistSurface;
};

export type EuaFieldAssistContextSuggestResponse = {
  success: boolean;
  suggestion: string;
  modelId?: string;
  error?: string;
};

export type EuaExtractedFieldValue = {
  name: string;
  value: string;
};

export type EuaFieldAssistExtractRequest = {
  text: string;
  fields: EuaFieldMapEntry[];
  sectionTitle?: string;
  sectionDescription?: string;
  modelId?: string;
  surface?: EuaAssistSurface;
};

export type EuaFieldAssistExtractResponse = {
  success: boolean;
  fields: EuaExtractedFieldValue[];
  modelId?: string;
  error?: string;
};

export type EuaFieldAssistFillMode = 'extract' | 'narrative';

export type EuaFieldAssistFillRequest = {
  text: string;
  fields: EuaFieldMapEntry[];
  mode?: EuaFieldAssistFillMode;
  sectionId?: string;
  sectionTitle?: string;
  sectionDescription?: string;
  modelId?: string;
  surface?: EuaAssistSurface;
  formId?: string;
};

export type EuaFieldAssistFillResponse = {
  success: boolean;
  fields: EuaExtractedFieldValue[];
  transcript?: string;
  modelId?: string;
  error?: string;
};

export type EuaFieldAssistOcrRequest = {
  imageDataUrl: string;
  targetFieldLabel?: string;
  modelId?: string;
  surface?: EuaAssistSurface;
};

export type EuaFieldAssistOcrResponse = {
  success: boolean;
  text: string;
  modelId?: string;
  error?: string;
};

export type EuaFieldAssistAltTextRequest = {
  imageDataUrl: string;
  contextHint?: string;
  modelId?: string;
  surface?: EuaAssistSurface;
};

export type EuaFieldAssistAltTextResponse = {
  success: boolean;
  altText: string;
  modelId?: string;
  error?: string;
};

export type EuaAssistSettingsResponse = {
  success: boolean;
  settings: import('./euaAssistSettings').EuaAssistSettings;
};

export type EuaStatusResponse = {
  success: boolean;
  aiEnabled: boolean;
  /** Chat-capable default model from Settings (when ready). */
  defaultModelId?: string;
  capabilities: Record<EuaCapabilityKey, boolean>;
};

export function buildDefaultEuaCapabilities(ready: boolean): Record<EuaCapabilityKey, boolean> {
  return EUA_CAPABILITY_KEYS.reduce((acc, key) => {
    acc[key] = ready;
    return acc;
  }, {} as Record<EuaCapabilityKey, boolean>);
}

export function isKnownEuaCapabilityKey(value: string): value is EuaCapabilityKey {
  return (EUA_CAPABILITY_KEYS as readonly string[]).includes(value);
}
