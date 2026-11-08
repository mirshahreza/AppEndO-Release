type PmEditorLike = {
  state: {
    selection: { empty: boolean; from: number };
    doc: { content: { size: number } };
  };
};

/** True when the caret is at the end of the ProseMirror document (ghost autocomplete can run). */
export const isPmSelectionAtEnd = (editor: PmEditorLike | null | undefined): boolean => {
  if (!editor) return false;
  const { selection, doc } = editor.state;
  if (!selection.empty) return false;
  return selection.from === doc.content.size - 1;
};

export const markdownAutocompleteCursorPosition = (
  editor: PmEditorLike | null | undefined,
  markdown: string,
): number => (isPmSelectionAtEnd(editor) ? markdown.length : 0);

/** Alias for HTML / generic TipTap editors that share the ProseMirror caret-at-end rule. */
export const tiptapAutocompleteCursorPosition = markdownAutocompleteCursorPosition;

type InsertableEditor = {
  commands: { insertContent: (value: string, options?: unknown) => unknown };
  getHTML?: () => string;
};

/** Inserts the ghost suffix at the TipTap caret and returns the resulting HTML when available. */
export const insertTipTapCompletion = (
  editor: InsertableEditor | null | undefined,
  suffix: string,
): string | null => {
  if (!editor || !suffix) {
    return null;
  }
  editor.commands.insertContent(suffix);
  return editor.getHTML?.() ?? suffix;
};
