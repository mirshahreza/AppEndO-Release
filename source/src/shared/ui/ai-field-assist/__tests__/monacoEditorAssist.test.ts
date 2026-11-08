import { describe, expect, it } from 'vitest';
import {
  buildMonacoGhostDecorations,
  insertMonacoTextAtCursor,
  monacoAutocompleteCursorPosition,
  monacoIsCursorAtEnd,
  type MonacoApiLike,
  type MonacoEditorLike,
  type MonacoModelLike,
  type MonacoPositionLike,
} from '../monacoEditorAssist';

class FakeRange {
  constructor(
    readonly startLineNumber: number,
    readonly startColumn: number,
    readonly endLineNumber: number,
    readonly endColumn: number,
  ) {}
}

const monacoApi: MonacoApiLike = { Range: FakeRange };

const createEditor = ({
  text,
  offset,
  selectionEmpty = true,
}: {
  text: string;
  offset: number;
  selectionEmpty?: boolean;
}): MonacoEditorLike & { edits: Array<{ text: string }> } => {
  const positionFromOffset = (value: number): MonacoPositionLike => ({
    lineNumber: 1,
    column: value + 1,
  });
  const model: MonacoModelLike = {
    getValueLength: () => text.length,
    getOffsetAt: (position) => position.column - 1,
    getPositionAt: (value) => positionFromOffset(value),
  };
  const edits: Array<{ text: string }> = [];
  return {
    edits,
    getValue: () => text,
    getModel: () => model,
    getPosition: () => positionFromOffset(offset),
    getSelection: () => ({ isEmpty: () => selectionEmpty }),
    executeEdits: (_source, nextEdits) => {
      edits.push(...nextEdits);
      return true;
    },
  };
};

describe('monacoEditorAssist', () => {
  it('reports the document end only when the caret is at the last offset', () => {
    expect(monacoIsCursorAtEnd(createEditor({ text: 'Hello', offset: 5 }))).toBe(true);
    expect(monacoIsCursorAtEnd(createEditor({ text: 'Hello', offset: 2 }))).toBe(false);
    expect(monacoIsCursorAtEnd(createEditor({ text: 'Hello', offset: 5, selectionEmpty: false }))).toBe(false);
    expect(monacoAutocompleteCursorPosition(createEditor({ text: 'Hello', offset: 5 }), 'Hello')).toBe(5);
    expect(monacoAutocompleteCursorPosition(createEditor({ text: 'Hello', offset: 2 }), 'Hello')).toBe(0);
  });

  it('builds a caret ghost decoration and inserts the suffix at the cursor', () => {
    const editor = createEditor({ text: 'Hello', offset: 5 });
    const decorations = buildMonacoGhostDecorations(editor, monacoApi, ' world');
    expect(decorations).toHaveLength(1);
    expect(decorations[0]?.options.after.content).toBe(' world');
    expect(insertMonacoTextAtCursor(editor, monacoApi, ' world')).toBe(true);
    expect(editor.edits[0]?.text).toBe(' world');
  });
});
