import { useCallback, useEffect, useRef } from 'react';
import type { EuaAssistSurface } from '../../api/contracts/ai/euaFieldAssist';
import { resolveAiEditorKeyAction, toAiEditorKeyEvent } from './aiEditorKeyAction';
import {
  buildMonacoGhostDecorations,
  insertMonacoTextAtCursor,
  monacoAutocompleteCursorPosition,
  monacoIsCursorAtEnd,
  type MonacoApiLike,
  type MonacoEditorLike,
} from './monacoEditorAssist';
import { useAiFieldAutocomplete } from './useAiFieldAutocomplete';
import './monacoAiGhost.css';

type Disposable = { dispose: () => void };

type MonacoDecorationsCollection = {
  set: (decorations: ReturnType<typeof buildMonacoGhostDecorations>) => void;
  clear: () => void;
};

type MonacoEditorWithEvents = MonacoEditorLike & {
  onDidChangeModelContent?: (listener: () => void) => Disposable;
  onDidChangeCursorPosition?: (listener: () => void) => Disposable;
  onKeyDown?: (listener: (event: MonacoKeyboardEvent) => void) => Disposable;
  createDecorationsCollection?: (
    decorations?: ReturnType<typeof buildMonacoGhostDecorations>,
  ) => MonacoDecorationsCollection;
};

type MonacoKeyboardEvent = {
  browserEvent: KeyboardEvent;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export type UseMonacoAiAutocompleteOptions = {
  enabled: boolean;
  editor: MonacoEditorLike | null;
  monaco: MonacoApiLike | null;
  fieldLabel?: string;
  modelId?: string;
  surface?: EuaAssistSurface;
  onAccept?: (nextValue: string) => void;
};

export function useMonacoAiAutocomplete({
  enabled,
  editor,
  monaco,
  fieldLabel,
  modelId,
  surface = 'admin',
  onAccept,
}: UseMonacoAiAutocompleteOptions) {
  const editorRef = useRef(editor as MonacoEditorWithEvents | null);
  editorRef.current = editor as MonacoEditorWithEvents | null;
  const monacoRef = useRef(monaco);
  monacoRef.current = monaco;
  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const decorationsRef = useRef<MonacoDecorationsCollection | null>(null);

  const getText = useCallback(() => editorRef.current?.getValue() ?? '', []);
  const getCursorPosition = useCallback(
    () => monacoAutocompleteCursorPosition(editorRef.current, getText()),
    [getText],
  );

  const autocomplete = useAiFieldAutocomplete({
    enabled,
    getText,
    getCursorPosition,
    fieldLabel,
    modelId,
    surface,
  });
  const autocompleteRef = useRef(autocomplete);
  autocompleteRef.current = autocomplete;

  const clearGhost = useCallback(() => {
    decorationsRef.current?.clear();
  }, []);

  useEffect(() => {
    const activeEditor = editor as MonacoEditorWithEvents | null;
    const activeMonaco = monaco;
    if (!activeEditor || !activeMonaco || !enabled || !autocomplete.completion) {
      clearGhost();
      return;
    }

    if (!decorationsRef.current && activeEditor.createDecorationsCollection) {
      decorationsRef.current = activeEditor.createDecorationsCollection([]);
    }

    decorationsRef.current?.set(
      buildMonacoGhostDecorations(activeEditor, activeMonaco, autocomplete.completion),
    );
  }, [autocomplete.completion, clearGhost, editor, enabled, monaco]);

  useEffect(() => {
    const activeEditor = editor as MonacoEditorWithEvents | null;
    if (!activeEditor) {
      decorationsRef.current = null;
      return;
    }

    if (activeEditor.createDecorationsCollection) {
      decorationsRef.current = activeEditor.createDecorationsCollection([]);
    }

    const contentSub = activeEditor.onDidChangeModelContent?.(() => {
      const text = activeEditor.getValue();
      autocompleteRef.current.handleInputChange({
        text,
        cursorPosition: monacoAutocompleteCursorPosition(activeEditor, text),
      });
    });
    const cursorSub = activeEditor.onDidChangeCursorPosition?.(() => {
      if (!monacoIsCursorAtEnd(activeEditor)) {
        autocompleteRef.current.dismiss();
        decorationsRef.current?.clear();
      }
    });
    const keySub = activeEditor.onKeyDown?.((event) => {
      if (!event.browserEvent) {
        return;
      }
      const current = autocompleteRef.current;
      const action = resolveAiEditorKeyAction(toAiEditorKeyEvent(event.browserEvent), {
        shouldAutocomplete: enabledRef.current,
        hasCompletion: Boolean(current.completion),
      });
      if (!action) {
        return;
      }

      if (action === 'accept-completion') {
        const suffix = current.completion;
        const nextValue = current.acceptCompletion();
        const activeMonaco = monacoRef.current;
        if (nextValue === null || !suffix || !activeMonaco) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const inserted = insertMonacoTextAtCursor(activeEditor, activeMonaco, suffix);
        if (!inserted) {
          onAcceptRef.current?.(nextValue);
        }
        decorationsRef.current?.clear();
        return;
      }

      if (action === 'dismiss-completion') {
        event.preventDefault();
        event.stopPropagation();
        current.dismiss();
        decorationsRef.current?.clear();
        return;
      }

      if (action === 'request-suggestion') {
        event.preventDefault();
        event.stopPropagation();
        current.requestSuggestion(true);
      }
    });

    return () => {
      contentSub?.dispose();
      cursorSub?.dispose();
      keySub?.dispose();
      decorationsRef.current?.clear();
      decorationsRef.current = null;
    };
  }, [editor]);

  return autocomplete;
}
