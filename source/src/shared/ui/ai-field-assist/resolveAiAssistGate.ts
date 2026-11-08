/**
 * Shared enablement for EUA field assist.
 * Autocomplete stays off until AI is on and a chat-capable default model exists.
 */
export type ResolveAiAssistGateInput = {
  aiAssist: boolean;
  isControlDisabled: boolean;
  actionsEnabled: boolean;
  contextMenuDisabled: boolean;
  autocompleteDisabled: boolean;
  contextSuggest?: boolean;
  contextSuggestDisabled?: boolean;
};

export type AiAssistGate = {
  shouldEnableAssist: boolean;
  shouldAssistContextMenu: boolean;
  shouldAutocomplete: boolean;
  shouldContextSuggest: boolean;
};

export function resolveAiAssistGate({
  aiAssist,
  isControlDisabled,
  actionsEnabled,
  contextMenuDisabled,
  autocompleteDisabled,
  contextSuggest = false,
  contextSuggestDisabled = false,
}: ResolveAiAssistGateInput): AiAssistGate {
  const shouldEnableAssist = aiAssist && !isControlDisabled;
  return {
    shouldEnableAssist,
    shouldAssistContextMenu: shouldEnableAssist && !contextMenuDisabled,
    shouldAutocomplete: shouldEnableAssist && !autocompleteDisabled && actionsEnabled,
    shouldContextSuggest: shouldEnableAssist && contextSuggest && !contextSuggestDisabled && actionsEnabled,
  };
}
