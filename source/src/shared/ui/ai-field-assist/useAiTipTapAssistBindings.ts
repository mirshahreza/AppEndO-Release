import { useCallback, type KeyboardEvent } from 'react';
import { resolveAiEditorKeyAction, toAiEditorKeyEvent } from './aiEditorKeyAction';
import type { useAiFieldAutocomplete } from './useAiFieldAutocomplete';

type AutocompleteApi = ReturnType<typeof useAiFieldAutocomplete>;

export type UseAiTipTapAssistBindingsOptions = {
  shouldAutocomplete: boolean;
  autocomplete: AutocompleteApi;
  onAccept: (nextValue: string, suffix: string) => void;
  diffUndoDisabled?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
};

export function useAiTipTapAssistBindings({
  shouldAutocomplete,
  autocomplete,
  onAccept,
  diffUndoDisabled = true,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: UseAiTipTapAssistBindingsOptions) {
  const handleEditorKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const action = resolveAiEditorKeyAction(toAiEditorKeyEvent(event), {
      shouldAutocomplete,
      hasCompletion: Boolean(autocomplete.completion),
      diffUndoDisabled,
      canUndo,
      canRedo,
    });

    if (action === 'accept-completion') {
      const suffix = autocomplete.completion;
      const nextValue = autocomplete.acceptCompletion();
      if (nextValue !== null && suffix) {
        event.preventDefault();
        onAccept(nextValue, suffix);
      }
      return;
    }

    if (action === 'dismiss-completion') {
      event.preventDefault();
      autocomplete.dismiss();
      return;
    }

    if (action === 'request-suggestion') {
      event.preventDefault();
      autocomplete.requestSuggestion(true);
      return;
    }

    if (action === 'undo-ai') {
      event.preventDefault();
      onUndo?.();
      return;
    }

    if (action === 'redo-ai') {
      event.preventDefault();
      onRedo?.();
    }
  }, [
    autocomplete,
    canRedo,
    canUndo,
    diffUndoDisabled,
    onAccept,
    onRedo,
    onUndo,
    shouldAutocomplete,
  ]);

  return { handleEditorKeyDown };
}
