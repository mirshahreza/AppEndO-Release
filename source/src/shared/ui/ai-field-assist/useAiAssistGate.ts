import { useEffect } from 'react';
import { ensureEuaStatusLoaded } from './euaStatusCache';
import { resolveAiAssistGate, type AiAssistGate } from './resolveAiAssistGate';
import {
  useEuaDefaultModelId,
  useEuaFieldAssistReady,
  useEuaStatusSnapshot,
} from './useEuaCapability';

export type UseAiAssistGateOptions = {
  aiAssist?: boolean;
  isControlDisabled: boolean;
  contextSuggest?: boolean;
};

export type UseAiAssistGateResult = AiAssistGate & {
  actionsEnabled: boolean;
  defaultModelId: string | undefined;
  diffUndoDisabled: boolean;
};

export function useAiAssistGate({
  aiAssist = true,
  isControlDisabled,
  contextSuggest = false,
}: UseAiAssistGateOptions): UseAiAssistGateResult {
  const status = useEuaStatusSnapshot();
  const actionsEnabled = useEuaFieldAssistReady();
  const defaultModelId = useEuaDefaultModelId();
  const contextMenuDisabled = status?.capabilities['eua.contextMenu'] === false;
  const autocompleteDisabled = status?.capabilities['eua.autocomplete'] === false;
  const contextSuggestDisabled = status?.capabilities['eua.contextSuggest'] === false;
  const diffUndoDisabled = status?.capabilities['eua.diffUndo'] === false;
  const shouldEnableAssist = aiAssist && !isControlDisabled;

  useEffect(() => {
    if (shouldEnableAssist) {
      void ensureEuaStatusLoaded();
    }
  }, [shouldEnableAssist]);

  return {
    ...resolveAiAssistGate({
      aiAssist,
      isControlDisabled,
      actionsEnabled,
      contextMenuDisabled,
      autocompleteDisabled,
      contextSuggest,
      contextSuggestDisabled,
    }),
    actionsEnabled,
    defaultModelId,
    diffUndoDisabled,
  };
}
