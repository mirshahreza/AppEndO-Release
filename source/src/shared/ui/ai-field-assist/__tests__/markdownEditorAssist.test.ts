import { describe, expect, it } from 'vitest';
import {
  insertTipTapCompletion,
  isPmSelectionAtEnd,
  markdownAutocompleteCursorPosition,
} from '../markdownEditorAssist';

const editorAt = (from: number, size: number, empty = true) => ({
  state: {
    selection: { empty, from },
    doc: { content: { size } },
  },
});

describe('markdownEditorAssist', () => {
  it('treats the last ProseMirror position as the document end', () => {
    expect(isPmSelectionAtEnd(editorAt(3, 4))).toBe(true);
    expect(isPmSelectionAtEnd(editorAt(1, 2))).toBe(true);
    expect(isPmSelectionAtEnd(editorAt(2, 4))).toBe(false);
    expect(isPmSelectionAtEnd(editorAt(3, 4, false))).toBe(false);
    expect(isPmSelectionAtEnd(null)).toBe(false);
  });

  it('reports markdown length only when the caret is at the end', () => {
    expect(markdownAutocompleteCursorPosition(editorAt(5, 6), 'Hello')).toBe(5);
    expect(markdownAutocompleteCursorPosition(editorAt(2, 6), 'Hello')).toBe(0);
  });

  it('inserts the ghost suffix at the TipTap caret', () => {
    let html = '<p>Hello</p>';
    const editor = {
      commands: {
        insertContent: (suffix: string) => {
          html = `<p>Hello${suffix}</p>`;
        },
      },
      getHTML: () => html,
    };
    expect(insertTipTapCompletion(editor, ' world')).toBe('<p>Hello world</p>');
    expect(insertTipTapCompletion(null, ' world')).toBeNull();
  });
});
