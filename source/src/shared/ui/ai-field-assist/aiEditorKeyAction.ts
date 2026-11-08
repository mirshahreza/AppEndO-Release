export type AiEditorKeyEvent = {
  key: string;
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type AiEditorKeyActionState = {
  shouldAutocomplete: boolean;
  hasCompletion: boolean;
  diffUndoDisabled?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
};

export type AiEditorKeyAction =
  | 'accept-completion'
  | 'dismiss-completion'
  | 'request-suggestion'
  | 'undo-ai'
  | 'redo-ai';

const isMod = (event: AiEditorKeyEvent): boolean => event.ctrlKey || event.metaKey;

export function resolveAiEditorKeyAction(
  event: AiEditorKeyEvent,
  state: AiEditorKeyActionState,
): AiEditorKeyAction | null {
  if (state.shouldAutocomplete) {
    if (event.key === 'Tab' && state.hasCompletion && !event.shiftKey) {
      return 'accept-completion';
    }
    if (event.key === 'Escape' && state.hasCompletion) {
      return 'dismiss-completion';
    }
    if (isMod(event) && event.code === 'Space') {
      return 'request-suggestion';
    }
  }

  if (state.diffUndoDisabled) {
    return null;
  }

  if (isMod(event) && event.key.toLowerCase() === 'z') {
    if (event.shiftKey) {
      return state.canRedo ? 'redo-ai' : null;
    }
    return state.canUndo ? 'undo-ai' : null;
  }

  if (isMod(event) && event.key.toLowerCase() === 'y' && state.canRedo) {
    return 'redo-ai';
  }

  return null;
}

export function toAiEditorKeyEvent(event: {
  key: string;
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): AiEditorKeyEvent {
  return {
    key: event.key,
    code: event.code,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  };
}
