export type MonacoPositionLike = {
  lineNumber: number;
  column: number;
};

export type MonacoRangeLike = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type MonacoModelLike = {
  getValueLength: () => number;
  getOffsetAt: (position: MonacoPositionLike) => number;
  getPositionAt: (offset: number) => MonacoPositionLike;
};

export type MonacoSelectionLike = {
  isEmpty: () => boolean;
};

export type MonacoEditorLike = {
  getValue: () => string;
  getModel: () => MonacoModelLike | null;
  getPosition: () => MonacoPositionLike | null;
  getSelection: () => MonacoSelectionLike | null;
  setPosition?: (position: MonacoPositionLike) => void;
  focus?: () => void;
  executeEdits?: (
    source: string,
    edits: Array<{ range: MonacoRangeLike; text: string }>,
  ) => boolean;
};

export type MonacoApiLike = {
  Range: new (
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number,
  ) => MonacoRangeLike;
};

export const monacoIsCursorAtEnd = (editor: MonacoEditorLike | null | undefined): boolean => {
  if (!editor) {
    return false;
  }

  const selection = editor.getSelection();
  if (selection && !selection.isEmpty()) {
    return false;
  }

  const model = editor.getModel();
  const position = editor.getPosition();
  if (!model || !position) {
    return false;
  }

  return model.getOffsetAt(position) === model.getValueLength();
};

export const monacoAutocompleteCursorPosition = (
  editor: MonacoEditorLike | null | undefined,
  text: string,
): number => (monacoIsCursorAtEnd(editor) ? text.length : 0);

export const monacoCaretRange = (
  editor: MonacoEditorLike,
  monaco: MonacoApiLike,
): MonacoRangeLike | null => {
  const position = editor.getPosition();
  if (!position) {
    return null;
  }

  return new monaco.Range(
    position.lineNumber,
    position.column,
    position.lineNumber,
    position.column,
  );
};

export const buildMonacoGhostDecorations = (
  editor: MonacoEditorLike,
  monaco: MonacoApiLike,
  completion: string,
): Array<{ range: MonacoRangeLike; options: { after: { content: string; inlineClassName: string }; showIfCollapsed: boolean } }> => {
  if (!completion) {
    return [];
  }

  const range = monacoCaretRange(editor, monaco);
  if (!range) {
    return [];
  }

  return [{
    range,
    options: {
      after: {
        content: completion,
        inlineClassName: 'ai-monaco-ghost',
      },
      showIfCollapsed: true,
    },
  }];
};

export const insertMonacoTextAtCursor = (
  editor: MonacoEditorLike,
  monaco: MonacoApiLike,
  text: string,
): boolean => {
  if (!text) {
    return false;
  }

  const range = monacoCaretRange(editor, monaco);
  if (!range || !editor.executeEdits) {
    return false;
  }

  const applied = editor.executeEdits('ai-autocomplete', [{ range, text }]);
  if (!applied) {
    return false;
  }

  const model = editor.getModel();
  if (model && editor.setPosition) {
    editor.setPosition(model.getPositionAt(model.getValueLength()));
  }
  editor.focus?.();
  return true;
};
