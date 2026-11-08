import React, { useLayoutEffect, useState } from 'react';

type CaretPoint = {
  top: number;
  left: number;
};

type EditorViewLike = {
  view: {
    coordsAtPos: (pos: number) => { top: number; left: number };
  };
  state: {
    selection: { from: number };
  };
  on: (event: string, cb: () => void) => void;
  off: (event: string, cb: () => void) => void;
};

type AiAutocompleteCaretGhostProps = {
  editor: EditorViewLike | null;
  wrapper: HTMLElement | null;
  completion: string;
};

/**
 * Ghost completion anchored to the TipTap caret — used when the field is
 * contenteditable rather than a native textarea.
 */
export const AiAutocompleteCaretGhost: React.FC<AiAutocompleteCaretGhostProps> = ({
  editor,
  wrapper,
  completion,
}) => {
  const [point, setPoint] = useState<CaretPoint | null>(null);

  useLayoutEffect(() => {
    if (!editor || !wrapper || !completion) {
      setPoint(null);
      return;
    }

    const sync = () => {
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        const wrapRect = wrapper.getBoundingClientRect();
        setPoint({
          top: coords.top - wrapRect.top,
          left: coords.left - wrapRect.left,
        });
      } catch {
        setPoint(null);
      }
    };

    sync();
    editor.on('transaction', sync);
    wrapper.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);

    return () => {
      editor.off('transaction', sync);
      wrapper.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [completion, editor, wrapper]);

  if (!completion || !point) {
    return null;
  }

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-[1] whitespace-pre text-slate-400"
      style={{ top: point.top, left: point.left }}
    >
      {completion}
    </span>
  );
};
