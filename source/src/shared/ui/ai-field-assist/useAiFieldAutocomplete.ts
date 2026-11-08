import { useCallback, useEffect, useRef, useState } from 'react';
import type { EuaAssistSurface } from '../../api/contracts/ai/euaFieldAssist';
import { autocompleteFieldText } from '../../api/queries/euaFieldAssist';
import {
  EUA_AUTOCOMPLETE_DEBOUNCE_MS,
  EUA_AUTOCOMPLETE_MIN_CHARS,
} from './buildAutocompletePrompt';

type AutocompleteInputSnapshot = {
  text: string;
  cursorPosition: number;
};

type UseAiFieldAutocompleteOptions = {
  enabled: boolean;
  getText: () => string;
  getCursorPosition: () => number;
  fieldLabel?: string;
  modelId?: string;
  surface?: EuaAssistSurface;
};

type AutocompleteRequestKey = string;

function buildRequestKey(
  text: string,
  cursorPosition: number,
  modelId?: string,
): AutocompleteRequestKey {
  return `${cursorPosition}:${modelId ?? ''}:${text}`;
}

export function useAiFieldAutocomplete({
  enabled,
  getText,
  getCursorPosition,
  fieldLabel,
  modelId,
  surface = 'admin',
}: UseAiFieldAutocompleteOptions) {
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestKeyRef = useRef<AutocompleteRequestKey | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDebounce();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    lastRequestKeyRef.current = null;
    setCompletion('');
    setIsLoading(false);
  }, [clearDebounce]);

  const canSuggestAtCursor = useCallback((snapshot?: AutocompleteInputSnapshot) => {
    const text = snapshot?.text ?? getText();
    const cursorPosition = snapshot?.cursorPosition ?? getCursorPosition();
    if (cursorPosition !== text.length) {
      return false;
    }
    const textBeforeCursor = text.slice(0, cursorPosition);
    return textBeforeCursor.trim().length >= EUA_AUTOCOMPLETE_MIN_CHARS;
  }, [getCursorPosition, getText]);

  const fetchSuggestion = useCallback(async (immediate = false) => {
    if (!enabled) {
      return;
    }

    clearDebounce();

    const run = async () => {
      if (!canSuggestAtCursor()) {
        dismiss();
        return;
      }

      const text = getText();
      const cursorPosition = getCursorPosition();
      const requestKey = buildRequestKey(text, cursorPosition, modelId);

      if (requestKey === lastRequestKeyRef.current) {
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoading(true);

      try {
        const result = await autocompleteFieldText({
          text,
          cursorPosition,
          modelId,
          surface,
          fieldLabel,
        }, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        const latestText = getText();
        const latestCursor = getCursorPosition();
        const latestKey = buildRequestKey(latestText, latestCursor, modelId);
        if (latestKey !== requestKey) {
          return;
        }

        lastRequestKeyRef.current = requestKey;
        setCompletion(result.completion ?? '');
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setCompletion('');
        lastRequestKeyRef.current = null;
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    if (immediate) {
      void run();
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void run();
    }, EUA_AUTOCOMPLETE_DEBOUNCE_MS);
  }, [
    canSuggestAtCursor,
    clearDebounce,
    dismiss,
    enabled,
    fieldLabel,
    getCursorPosition,
    getText,
    modelId,
    surface,
  ]);

  const handleInputChange = useCallback((snapshot?: AutocompleteInputSnapshot) => {
    lastRequestKeyRef.current = null;
    setCompletion('');
    if (enabled && canSuggestAtCursor(snapshot)) {
      void fetchSuggestion(false);
    } else {
      clearDebounce();
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [canSuggestAtCursor, clearDebounce, enabled, fetchSuggestion]);

  const acceptCompletion = useCallback((): string | null => {
    if (!completion) {
      return null;
    }

    const text = getText();
    const cursorPosition = getCursorPosition();
    if (cursorPosition !== text.length) {
      dismiss();
      return null;
    }

    const nextValue = `${text}${completion}`;
    dismiss();
    return nextValue;
  }, [completion, dismiss, getCursorPosition, getText]);

  useEffect(() => () => {
    clearDebounce();
    abortControllerRef.current?.abort();
  }, [clearDebounce]);

  useEffect(() => {
    if (!enabled) {
      dismiss();
    }
  }, [dismiss, enabled]);

  return {
    completion,
    isLoading,
    dismiss,
    acceptCompletion,
    requestSuggestion: fetchSuggestion,
    handleInputChange,
    canSuggestAtCursor,
  };
}
